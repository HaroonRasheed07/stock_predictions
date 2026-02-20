# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import argparse
import json
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import tensorflow as tf


@dataclass(frozen=True)
class TrainConfig:
    input_csv: str
    horizon_hours: int
    seq_len: int
    batch_size: int
    epochs: int
    lr: float
    train_end: str
    val_end: str
    model_out: str
    scaler_out: str


def _feature_columns(df: pd.DataFrame, horizon_hours: int) -> List[str]:
    target_ret = f"target_ret_{horizon_hours}h"
    target_dir = f"target_dir_{horizon_hours}h"
    drop = {"timestamp", "symbol", "imputed", target_ret, target_dir}
    cols = [c for c in df.columns if c not in drop]
    cols = [c for c in cols if df[c].dtype.kind in ("i", "u", "f")]
    return cols


def _time_split(df: pd.DataFrame, train_end: str, val_end: str) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train_end_ts = pd.to_datetime(train_end)
    val_end_ts = pd.to_datetime(val_end)

    train = df.loc[df["timestamp"] <= train_end_ts].copy()
    val = df.loc[(df["timestamp"] > train_end_ts) & (df["timestamp"] <= val_end_ts)].copy()
    test = df.loc[df["timestamp"] > val_end_ts].copy()
    return train, val, test


def fit_scaler(train_df: pd.DataFrame, feature_cols: List[str]) -> Dict[str, Dict[str, float]]:
    mu = train_df[feature_cols].mean(axis=0)
    sd = train_df[feature_cols].std(axis=0, ddof=0).replace(0, np.nan)
    sd = sd.fillna(1.0)
    return {"mean": mu.to_dict(), "std": sd.to_dict()}


def apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict[str, Dict[str, float]]) -> pd.DataFrame:
    mu = pd.Series(scaler["mean"])
    sd = pd.Series(scaler["std"])
    df = df.copy()
    df[feature_cols] = (df[feature_cols] - mu[feature_cols].values) / sd[feature_cols].values
    return df


def _iter_symbol_arrays(
    df: pd.DataFrame,
    feature_cols: List[str],
    horizon_hours: int,
) -> Iterable[Tuple[np.ndarray, np.ndarray]]:
    target_ret = f"target_ret_{horizon_hours}h"
    for _, g in df.groupby("symbol", sort=False):
        g = g.sort_values("timestamp", kind="mergesort")
        x = g[feature_cols].to_numpy(dtype=np.float32)
        y = g[target_ret].to_numpy(dtype=np.float32)
        if len(x) == 0:
            continue
        yield x, y


def make_tf_dataset(
    df: pd.DataFrame,
    feature_cols: List[str],
    horizon_hours: int,
    seq_len: int,
    batch_size: int,
    shuffle: bool,
    weight_scale: Optional[float] = None,
) -> tf.data.Dataset:
    def gen():
        rng = np.random.default_rng(1234)
        arrays = []
        target_ret = f"target_ret_{horizon_hours}h"
        for _, g in df.groupby("symbol", sort=False):
            g = g.sort_values("timestamp", kind="mergesort")
            x = g[feature_cols].to_numpy(dtype=np.float32)
            y = g[target_ret].to_numpy(dtype=np.float32)
            sid = g["symbol_id"].to_numpy(dtype=np.int32)
            if len(x) == 0:
                continue
            arrays.append((x, y, sid))
        if shuffle:
            rng.shuffle(arrays)
        for x, y, sid in arrays:
            n = len(x)
            if n <= seq_len:
                continue
            for i in range(seq_len - 1, n):
                xs = x[i - seq_len + 1 : i + 1]
                ys = y[i]
                sids = sid[i]
                if np.isnan(xs).any() or np.isnan(ys):
                    continue
                if weight_scale is None or weight_scale <= 0:
                    w = np.float32(1.0)
                else:
                    w = np.float32(1.0 + 3.0 * min(abs(float(ys)) / float(weight_scale), 4.0))
                yield {"x": xs, "symbol_id": sids}, ys, w

    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            {
                "x": tf.TensorSpec(shape=(seq_len, len(feature_cols)), dtype=tf.float32),
                "symbol_id": tf.TensorSpec(shape=(), dtype=tf.int32),
            },
            tf.TensorSpec(shape=(), dtype=tf.float32),
            tf.TensorSpec(shape=(), dtype=tf.float32),
        ),
    )

    if shuffle:
        ds = ds.shuffle(buffer_size=50000, reshuffle_each_iteration=True)
    ds = ds.batch(batch_size, drop_remainder=True).prefetch(tf.data.AUTOTUNE)
    return ds


@tf.keras.utils.register_keras_serializable(package="cv360")
class TemporalAttention(tf.keras.layers.Layer):
    def __init__(self, units: int, **kwargs):
        super().__init__(**kwargs)
        self.units = int(units)
        self.W = tf.keras.layers.Dense(self.units, activation="tanh")
        self.v = tf.keras.layers.Dense(1, use_bias=False)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({"units": self.units})
        return cfg

    def call(self, x, training=None):
        s = self.v(self.W(x))
        a = tf.nn.softmax(s, axis=1)
        context = tf.reduce_sum(a * x, axis=1)
        return context


def build_model(seq_len: int, n_features: int, n_symbols: int) -> tf.keras.Model:
    x_inp = tf.keras.Input(shape=(seq_len, n_features), name="x")
    sid_inp = tf.keras.Input(shape=(), dtype=tf.int32, name="symbol_id")

    emb = tf.keras.layers.Embedding(input_dim=n_symbols, output_dim=8, name="symbol_emb")(sid_inp)
    emb = tf.keras.layers.Dense(8, activation="relu", name="symbol_emb_proj")(emb)
    emb_seq = tf.keras.layers.RepeatVector(seq_len, name="symbol_emb_repeat")(emb)
    inp = tf.keras.layers.Concatenate(name="x_with_symbol")([x_inp, emb_seq])

    x = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(96, return_sequences=True))(inp)
    x = tf.keras.layers.Dropout(0.2)(x)

    x = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(48, return_sequences=True))(x)
    x = tf.keras.layers.Dropout(0.2)(x)

    ctx = TemporalAttention(64, name="attn")(x)
    h = tf.keras.layers.Dense(64, activation="relu")(ctx)
    h = tf.keras.layers.Dropout(0.2)(h)

    mu = tf.keras.layers.Dense(1, name="mu")(h)
    log_sigma = tf.keras.layers.Dense(1, name="log_sigma")(h)

    out = tf.keras.layers.Concatenate(name="y_hat")([mu, log_sigma])
    return tf.keras.Model(inputs={"x": x_inp, "symbol_id": sid_inp}, outputs=out)


def gaussian_nll(y_true, y_pred):
    mu = y_pred[:, 0]
    log_sigma = y_pred[:, 1]
    sigma2 = tf.exp(2.0 * log_sigma) + 1e-6
    return 0.5 * tf.math.log(sigma2) + 0.5 * tf.square(y_true - mu) / sigma2


def combined_loss(y_true, y_pred):
    mu = y_pred[:, 0]
    nll = gaussian_nll(y_true, y_pred)
    huber = tf.keras.losses.Huber(delta=0.02, reduction=tf.keras.losses.Reduction.NONE)(y_true, mu)
    return nll + 0.25 * huber


def mae_on_mu(y_true, y_pred):
    mu = y_pred[:, 0]
    return tf.reduce_mean(tf.abs(y_true - mu))


def rmse_on_mu(y_true, y_pred):
    mu = y_pred[:, 0]
    return tf.sqrt(tf.reduce_mean(tf.square(y_true - mu)))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="cv360_features.csv")
    p.add_argument("--horizon", type=int, default=12)
    p.add_argument("--seq-len", type=int, default=48)
    p.add_argument("--batch-size", type=int, default=256)
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--train-end", default="2025-06-30 23:00:00")
    p.add_argument("--val-end", default="2025-10-31 23:00:00")
    p.add_argument("--model-out", default="cv360_model.h5")
    p.add_argument("--scaler-out", default="cv360_scaler.json")
    args = p.parse_args()

    cfg = TrainConfig(
        input_csv=args.input,
        horizon_hours=args.horizon,
        seq_len=args.seq_len,
        batch_size=args.batch_size,
        epochs=args.epochs,
        lr=args.lr,
        train_end=args.train_end,
        val_end=args.val_end,
        model_out=args.model_out,
        scaler_out=args.scaler_out,
    )

    df = pd.read_csv(cfg.input_csv)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()

    feature_cols = _feature_columns(df, cfg.horizon_hours)
    if not feature_cols:
        raise ValueError("No feature columns found")

    target_ret = f"target_ret_{cfg.horizon_hours}h"
    df = df.dropna(subset=feature_cols + [target_ret])

    train_df, val_df, test_df = _time_split(df, cfg.train_end, cfg.val_end)
    if len(train_df) == 0 or len(val_df) == 0 or len(test_df) == 0:
        raise ValueError("Time split produced empty train/val/test. Adjust --train-end/--val-end.")

    symbols = sorted(train_df["symbol"].unique().tolist())
    symbol_to_id = {s: i for i, s in enumerate(symbols)}
    if len(symbol_to_id) < 2:
        raise ValueError("Need at least 2 symbols for training")

    for d in (train_df, val_df, test_df):
        d["symbol_id"] = d["symbol"].map(symbol_to_id).astype("Int64")
        if d["symbol_id"].isna().any():
            missing = sorted(d.loc[d["symbol_id"].isna(), "symbol"].unique().tolist())
            raise ValueError(f"Found symbols in split not present in train: {missing}")
        d["symbol_id"] = d["symbol_id"].astype(np.int32)

    move_scale = float(train_df[target_ret].abs().quantile(0.90))
    if not np.isfinite(move_scale) or move_scale <= 0:
        move_scale = 0.01

    scaler = fit_scaler(train_df, feature_cols)
    with open(cfg.scaler_out, "w", encoding="utf-8") as f:
        json.dump(
            {
                "feature_cols": feature_cols,
                "mean": scaler["mean"],
                "std": scaler["std"],
                "horizon_hours": cfg.horizon_hours,
                "seq_len": cfg.seq_len,
                "symbol_to_id": symbol_to_id,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    train_df = apply_scaler(train_df, feature_cols, scaler)
    val_df = apply_scaler(val_df, feature_cols, scaler)
    test_df = apply_scaler(test_df, feature_cols, scaler)

    train_ds = make_tf_dataset(
        train_df,
        feature_cols,
        cfg.horizon_hours,
        cfg.seq_len,
        cfg.batch_size,
        shuffle=True,
        weight_scale=move_scale,
    )
    val_ds = make_tf_dataset(
        val_df,
        feature_cols,
        cfg.horizon_hours,
        cfg.seq_len,
        cfg.batch_size,
        shuffle=False,
        weight_scale=move_scale,
    )
    test_ds = make_tf_dataset(
        test_df,
        feature_cols,
        cfg.horizon_hours,
        cfg.seq_len,
        cfg.batch_size,
        shuffle=False,
        weight_scale=move_scale,
    )

    model = build_model(cfg.seq_len, len(feature_cols), n_symbols=len(symbol_to_id))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=cfg.lr),
        loss=combined_loss,
        metrics=[mae_on_mu, rmse_on_mu],
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5),
    ]

    model.fit(train_ds, validation_data=val_ds, epochs=cfg.epochs, callbacks=callbacks)

    metrics = model.evaluate(test_ds, return_dict=True)
    print("TEST_METRICS", metrics)

    model.save(cfg.model_out)
    print(f"Saved model: {cfg.model_out}")
    print(f"Saved scaler: {cfg.scaler_out}")


if __name__ == "__main__":
    main()
