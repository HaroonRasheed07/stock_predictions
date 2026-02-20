# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import argparse
import json
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import tensorflow as tf


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


def load_scaler(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict) -> pd.DataFrame:
    mu = pd.Series(scaler["mean"])
    sd = pd.Series(scaler["std"])
    out = df.copy()
    out[feature_cols] = (out[feature_cols] - mu[feature_cols].values) / sd[feature_cols].values
    return out


def time_split(df: pd.DataFrame, train_end: str, val_end: str) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train_end_ts = pd.to_datetime(train_end)
    val_end_ts = pd.to_datetime(val_end)

    train = df.loc[df["timestamp"] <= train_end_ts].copy()
    val = df.loc[(df["timestamp"] > train_end_ts) & (df["timestamp"] <= val_end_ts)].copy()
    test = df.loc[df["timestamp"] > val_end_ts].copy()
    return train, val, test


def iter_symbol_test_rows(
    features_path: str,
    *,
    symbol: str,
    usecols: List[str],
    dtypes: Dict[str, str],
    val_end: pd.Timestamp,
    chunksize: int = 200_000,
):
    for chunk in pd.read_csv(
        features_path,
        usecols=usecols,
        dtype=dtypes,
        parse_dates=["timestamp"],
        chunksize=chunksize,
        low_memory=True,
    ):
        chunk["symbol"] = chunk["symbol"].astype(str).str.strip().str.upper()
        sub = chunk.loc[(chunk["symbol"] == symbol) & (chunk["timestamp"] > val_end)].copy()
        if len(sub) == 0:
            continue
        yield sub


def load_symbol_test_df(
    features_path: str,
    *,
    symbol: str,
    feature_cols: List[str],
    target_col: str,
    val_end: pd.Timestamp,
):
    needed = ["timestamp", "symbol", "close", target_col] + feature_cols
    usecols = list(dict.fromkeys(needed))

    dtypes: Dict[str, str] = {"symbol": "string"}
    for c in feature_cols:
        dtypes[c] = "float32"
    dtypes["close"] = "float32"
    dtypes[target_col] = "float32"

    frames = list(
        iter_symbol_test_rows(
            features_path,
            symbol=symbol,
            usecols=usecols,
            dtypes=dtypes,
            val_end=val_end,
        )
    )
    if not frames:
        return pd.DataFrame(columns=usecols)
    df = pd.concat(frames, ignore_index=True)
    return df


def make_sequences_for_symbol(
    g: pd.DataFrame,
    feature_cols: List[str],
    target_col: str,
    seq_len: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    g = g.sort_values("timestamp", kind="mergesort")
    x = g[feature_cols].to_numpy(dtype=np.float32)
    y = g[target_col].to_numpy(dtype=np.float32)
    t = g["timestamp"].to_numpy()
    sid = g["symbol_id"].to_numpy(dtype=np.int32)
    c = g["close"].to_numpy(dtype=np.float32)

    if len(g) <= seq_len:
        return np.empty((0, seq_len, len(feature_cols)), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=object)

    xs = []
    ys = []
    ts = []
    sids = []
    closes = []
    for i in range(seq_len - 1, len(g)):
        xw = x[i - seq_len + 1 : i + 1]
        yw = y[i]
        if np.isnan(xw).any() or np.isnan(yw):
            continue
        xs.append(xw)
        ys.append(yw)
        ts.append(t[i])
        sids.append(sid[i])
        closes.append(c[i])

    if not xs:
        return np.empty((0, seq_len, len(feature_cols)), dtype=np.float32), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=object)

    return (
        np.stack(xs, axis=0),
        np.asarray(ys, dtype=np.float32),
        np.asarray(ts),
        np.asarray(sids, dtype=np.int32),
        np.asarray(closes, dtype=np.float32),
    )


def plot_symbol(symbol: str, ts, y_true, mu, sigma, close_now, out_png: str, last_n: int):
    import matplotlib.pyplot as plt

    if last_n > 0:
        ts = ts[-last_n:]
        y_true = y_true[-last_n:]
        mu = mu[-last_n:]
        sigma = sigma[-last_n:]
        close_now = close_now[-last_n:]

    actual_future_close = close_now * (1.0 + y_true)
    pred_future_close = close_now * (1.0 + mu)

    plt.figure(figsize=(14, 6))
    plt.plot(ts, actual_future_close, label="actual_close_t+12h", linewidth=1.2)
    plt.plot(ts, pred_future_close, label="pred_close_t+12h", linewidth=1.2)
    lo = close_now * (1.0 + (mu - 2.0 * sigma))
    hi = close_now * (1.0 + (mu + 2.0 * sigma))
    plt.fill_between(ts, lo, hi, alpha=0.2, label="~95% band")
    plt.title(f"{symbol} | 12h future close: actual vs predicted")
    plt.xlabel("timestamp")
    plt.ylabel("price")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png, dpi=140)
    plt.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--features", default="cv360_features.csv")
    p.add_argument("--model", default="cv360_model.h5")
    p.add_argument("--scaler", default="cv360_scaler.json")
    p.add_argument("--train-end", default="2025-06-30 23:00:00")
    p.add_argument("--val-end", default="2025-10-31 23:00:00")
    p.add_argument("--last-n", type=int, default=500)
    p.add_argument("--max-coins", type=int, default=0, help="0 = all")
    args = p.parse_args()

    scaler = load_scaler(args.scaler)
    feature_cols = list(scaler["feature_cols"])
    horizon_hours = int(scaler.get("horizon_hours", 12))
    seq_len = int(scaler.get("seq_len", 48))
    symbol_to_id = dict(scaler.get("symbol_to_id", {}))
    if not symbol_to_id:
        raise ValueError("scaler.json is missing symbol_to_id. Re-train using updated cv360_train.py.")

    target_col = f"target_ret_{horizon_hours}h"

    model = tf.keras.models.load_model(
        args.model,
        compile=False,
        custom_objects={"TemporalAttention": TemporalAttention},
    )

    symbols = sorted(symbol_to_id.keys())
    if args.max_coins and args.max_coins > 0:
        symbols = symbols[: args.max_coins]

    val_end_ts = pd.to_datetime(args.val_end)

    pred_rows = []
    metric_rows = []

    for sym in symbols:
        g = load_symbol_test_df(
            args.features,
            symbol=sym,
            feature_cols=feature_cols,
            target_col=target_col,
            val_end=val_end_ts,
        )
        if len(g) == 0:
            continue
        g["symbol_id"] = np.int32(symbol_to_id[sym])
        g = g.dropna(subset=feature_cols + [target_col, "close"]).copy()
        g = apply_scaler(g, feature_cols, scaler)
        X, y_true, ts, sids, close_now = make_sequences_for_symbol(g, feature_cols, target_col, seq_len)
        if len(X) == 0:
            continue

        yhat = model.predict({"x": X, "symbol_id": sids}, batch_size=1024, verbose=0)
        mu = yhat[:, 0].astype(np.float32)
        sigma = np.exp(yhat[:, 1]).astype(np.float32)

        out_png = f"cv360_actual_vs_pred_{sym}.png"
        plot_symbol(sym, ts, y_true, mu, sigma, close_now, out_png=out_png, last_n=args.last_n)

        actual_future_close = close_now * (1.0 + y_true)
        pred_future_close = close_now * (1.0 + mu)
        ret_mae = float(np.mean(np.abs(y_true - mu)))
        ret_rmse = float(np.sqrt(np.mean(np.square(y_true - mu))))
        price_mae = float(np.mean(np.abs(actual_future_close - pred_future_close)))
        price_rmse = float(np.sqrt(np.mean(np.square(actual_future_close - pred_future_close))))
        metric_rows.append(
            {
                "symbol": sym,
                "n_points": int(len(mu)),
                "ret_mae": ret_mae,
                "ret_rmse": ret_rmse,
                "price_mae": price_mae,
                "price_rmse": price_rmse,
            }
        )

        for i in range(len(mu)):
            pred_rows.append(
                {
                    "timestamp": pd.Timestamp(ts[i]),
                    "symbol": sym,
                    "y_true": float(y_true[i]),
                    "y_pred_mu": float(mu[i]),
                    "y_pred_sigma": float(sigma[i]),
                    "close_now": float(close_now[i]),
                    "actual_close_t_plus": float(close_now[i] * (1.0 + y_true[i])),
                    "pred_close_t_plus": float(close_now[i] * (1.0 + mu[i])),
                }
            )

        print(f"Wrote plot: {out_png} (points={len(mu)})")

    if pred_rows:
        out_csv = "cv360_test_predictions.csv"
        pd.DataFrame(pred_rows).sort_values(["symbol", "timestamp"]).to_csv(out_csv, index=False)
        print(f"Wrote predictions: {out_csv}")

    if metric_rows:
        out_metrics = "cv360_test_metrics_by_coin.csv"
        pd.DataFrame(metric_rows).sort_values(["ret_mae", "symbol"]).to_csv(out_metrics, index=False)
        print(f"Wrote metrics: {out_metrics}")


if __name__ == "__main__":
    main()
