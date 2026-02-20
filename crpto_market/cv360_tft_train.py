# import argparse
# import json
# from dataclasses import dataclass
# from typing import Dict, List, Optional, Tuple

# import numpy as np
# import pandas as pd
# import tensorflow as tf


# @dataclass(frozen=True)
# class TrainConfig:
#     input_csv: str
#     horizon_hours: int
#     seq_len: int
#     batch_size: int
#     epochs: int
#     lr: float
#     train_end: str
#     val_end: str
#     model_out: str
#     scaler_out: str
#     d_model: int
#     num_heads: int
#     dropout: float


# def _feature_columns(df: pd.DataFrame, horizon_hours: int) -> List[str]:
#     target_ret = f"target_ret_{horizon_hours}h"
#     target_dir = f"target_dir_{horizon_hours}h"
#     drop = {"timestamp", "symbol", "imputed", target_ret, target_dir}
#     cols = [c for c in df.columns if c not in drop]
#     cols = [c for c in cols if df[c].dtype.kind in ("i", "u", "f")]
#     return cols


# def _time_split(df: pd.DataFrame, train_end: str, val_end: str) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
#     train_end_ts = pd.to_datetime(train_end)
#     val_end_ts = pd.to_datetime(val_end)

#     train = df.loc[df["timestamp"] <= train_end_ts].copy()
#     val = df.loc[(df["timestamp"] > train_end_ts) & (df["timestamp"] <= val_end_ts)].copy()
#     test = df.loc[df["timestamp"] > val_end_ts].copy()
#     return train, val, test


# def fit_scaler(train_df: pd.DataFrame, feature_cols: List[str]) -> Dict[str, Dict[str, float]]:
#     mu = train_df[feature_cols].mean(axis=0).astype(np.float32)
#     sd = train_df[feature_cols].std(axis=0, ddof=0).replace(0, np.nan).astype(np.float32)
#     sd = sd.fillna(np.float32(1.0))
#     return {"mean": mu.to_dict(), "std": sd.to_dict()}


# def apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict[str, Dict[str, float]]) -> pd.DataFrame:
#     mu = np.asarray([scaler["mean"][c] for c in feature_cols], dtype=np.float32)
#     sd = np.asarray([scaler["std"][c] for c in feature_cols], dtype=np.float32)
#     sd = np.where(sd == 0, np.float32(1.0), sd)

#     out = df.copy()
#     x = out[feature_cols].to_numpy(dtype=np.float32, copy=True)
#     x = (x - mu[None, :]) / sd[None, :]
#     out.loc[:, feature_cols] = x
#     return out


# def _prepare_df_for_windows(df: pd.DataFrame, feature_cols: List[str], target_ret: str) -> pd.DataFrame:
#     keep_cols = ["timestamp", "symbol", "symbol_id", target_ret] + feature_cols
#     df = df[keep_cols].copy()

#     df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
#     df["symbol"] = df["symbol"].astype("string")
#     df["symbol_id"] = df["symbol_id"].astype(np.int32)

#     for c in feature_cols:
#         df[c] = pd.to_numeric(df[c], errors="coerce").astype(np.float32)
#     df[target_ret] = pd.to_numeric(df[target_ret], errors="coerce").astype(np.float32)

#     df = df.dropna(subset=feature_cols + [target_ret, "symbol_id", "timestamp", "symbol"])
#     return df


# def make_tf_dataset(
#     df: pd.DataFrame,
#     feature_cols: List[str],
#     horizon_hours: int,
#     seq_len: int,
#     batch_size: int,
#     shuffle: bool,
#     weight_scale: Optional[float] = None,
# ) -> tf.data.Dataset:
#     target_ret = f"target_ret_{horizon_hours}h"

#     df = _prepare_df_for_windows(df, feature_cols, target_ret)
#     df = df.sort_values(["symbol_id", "timestamp"], kind="mergesort").reset_index(drop=True)

#     x_all = df[feature_cols].to_numpy(dtype=np.float32, copy=False)
#     y_all = df[target_ret].to_numpy(dtype=np.float32, copy=False)
#     sid_all = df["symbol_id"].to_numpy(dtype=np.int32, copy=False)

#     def gen():
#         n = int(len(sid_all))
#         if n == 0:
#             return

#         start = 0
#         while start < n:
#             sid0 = sid_all[start]
#             end = start + 1
#             while end < n and sid_all[end] == sid0:
#                 end += 1

#             seg_len = end - start
#             if seg_len > seq_len:
#                 x_seg = x_all[start:end]
#                 y_seg = y_all[start:end]

#                 for i in range(seq_len - 1, seg_len):
#                     xs = x_seg[i - seq_len + 1 : i + 1]
#                     ys = y_seg[i]
#                     if np.isnan(xs).any() or np.isnan(ys):
#                         continue

#                     if weight_scale is None or weight_scale <= 0:
#                         w = np.float32(1.0)
#                     else:
#                         w = np.float32(1.0 + 3.0 * min(abs(float(ys)) / float(weight_scale), 4.0))

#                     yield {"x": xs, "symbol_id": np.int32(sid0)}, np.float32(ys), w

#             start = end

#     ds = tf.data.Dataset.from_generator(
#         gen,
#         output_signature=(
#             {
#                 "x": tf.TensorSpec(shape=(seq_len, len(feature_cols)), dtype=tf.float32),
#                 "symbol_id": tf.TensorSpec(shape=(), dtype=tf.int32),
#             },
#             tf.TensorSpec(shape=(), dtype=tf.float32),
#             tf.TensorSpec(shape=(), dtype=tf.float32),
#         ),
#     )

#     if shuffle:
#         ds = ds.shuffle(buffer_size=50000, reshuffle_each_iteration=True)
#     ds = ds.batch(batch_size, drop_remainder=True).prefetch(tf.data.AUTOTUNE)
#     return ds


# @tf.keras.utils.register_keras_serializable(package="cv360")
# class GatedResidualNetwork(tf.keras.layers.Layer):
#     def __init__(self, units: int, dropout: float = 0.1, **kwargs):
#         super().__init__(**kwargs)
#         self.units = int(units)
#         self.dropout = float(dropout)
#         self.dense1 = tf.keras.layers.Dense(self.units, activation="elu")
#         self.drop = tf.keras.layers.Dropout(self.dropout)
#         self.dense2 = tf.keras.layers.Dense(self.units)
#         self.gate = tf.keras.layers.Dense(self.units, activation="sigmoid")
#         self.norm = tf.keras.layers.LayerNormalization()

#     def get_config(self):
#         cfg = super().get_config()
#         cfg.update({"units": self.units, "dropout": self.dropout})
#         return cfg

#     def call(self, x, training=None):
#         h = self.dense1(x)
#         h = self.drop(h, training=training)
#         h = self.dense2(h)
#         g = self.gate(x)
#         y = g * h + (1.0 - g) * x
#         return self.norm(y)


# @tf.keras.utils.register_keras_serializable(package="cv360")
# class VariableSelection(tf.keras.layers.Layer):
#     def __init__(self, d_model: int, **kwargs):
#         super().__init__(**kwargs)
#         self.d_model = int(d_model)
#         self._n_features: Optional[int] = None
#         self._proj_layers: List[tf.keras.layers.Layer] = []
#         self._score_layers: List[tf.keras.layers.Layer] = []

#     def get_config(self):
#         cfg = super().get_config()
#         cfg.update({"d_model": self.d_model})
#         return cfg

#     def build(self, input_shape):
#         n_feat = int(input_shape[-1])
#         self._n_features = n_feat

#         self._proj_layers = [tf.keras.layers.Dense(self.d_model) for _ in range(n_feat)]
#         self._score_layers = [tf.keras.layers.Dense(1) for _ in range(n_feat)]

#         super().build(input_shape)

#     def call(self, x, training=None):
#         if self._n_features is None:
#             raise ValueError("VariableSelection layer is not built. Call the layer on an input once to build it.")

#         feats = tf.split(x, num_or_size_splits=self._n_features, axis=-1)
#         emb = [self._proj_layers[i](feats[i]) for i in range(self._n_features)]
#         e = tf.stack(emb, axis=-2)
#         s = [self._score_layers[i](tf.nn.tanh(emb[i])) for i in range(self._n_features)]
#         s = tf.stack(s, axis=-2)
#         w = tf.nn.softmax(s, axis=-2)
#         out = tf.reduce_sum(w * e, axis=-2)
#         return out


# def quantile_loss(quantiles: List[float]):
#     q = tf.constant(quantiles, dtype=tf.float32)

#     def loss(y_true, y_pred):
#         y_true = tf.expand_dims(y_true, axis=-1)
#         e = y_true - y_pred
#         return tf.reduce_mean(tf.maximum(q * e, (q - 1.0) * e), axis=-1)

#     return loss


# def build_tft_model(seq_len: int, n_features: int, n_symbols: int, d_model: int, num_heads: int, dropout: float) -> tf.keras.Model:
#     x_inp = tf.keras.Input(shape=(seq_len, n_features), name="x")
#     sid_inp = tf.keras.Input(shape=(), dtype=tf.int32, name="symbol_id")

#     emb = tf.keras.layers.Embedding(input_dim=n_symbols, output_dim=16, name="symbol_emb")(sid_inp)
#     emb = tf.keras.layers.Dense(d_model, activation="relu", name="symbol_emb_proj")(emb)
#     emb_seq = tf.keras.layers.RepeatVector(seq_len, name="symbol_emb_repeat")(emb)

#     x = tf.keras.layers.Concatenate(name="x_with_static")([x_inp, emb_seq])

#     x = VariableSelection(d_model, name="varsel")(x)
#     x = GatedResidualNetwork(d_model, dropout=dropout, name="grn_in")(x)

#     lstm = tf.keras.layers.LSTM(d_model, return_sequences=True)
#     x = tf.keras.layers.Bidirectional(lstm, name="lstm")(x)
#     x = tf.keras.layers.Dense(d_model, name="lstm_proj")(x)
#     x = tf.keras.layers.Dropout(dropout)(x)

#     attn = tf.keras.layers.MultiHeadAttention(num_heads=num_heads, key_dim=max(8, d_model // num_heads), dropout=dropout)
#     a = attn(x, x)
#     x = tf.keras.layers.Add()([x, a])
#     x = tf.keras.layers.LayerNormalization()(x)
#     x = GatedResidualNetwork(d_model, dropout=dropout, name="grn_post_attn")(x)

#     ctx = x[:, -1, :]
#     h = tf.keras.layers.Dense(d_model, activation="relu")(ctx)
#     h = tf.keras.layers.Dropout(dropout)(h)

#     out = tf.keras.layers.Dense(3, name="q")(h)
#     return tf.keras.Model(inputs={"x": x_inp, "symbol_id": sid_inp}, outputs=out)


# def main():
#     p = argparse.ArgumentParser()
#     p.add_argument("--input", default="cv360_features.csv")
#     p.add_argument("--horizon", type=int, default=12)
#     p.add_argument("--seq-len", type=int, default=72)
#     p.add_argument("--batch-size", type=int, default=64)
#     p.add_argument("--epochs", type=int, default=20)
#     p.add_argument("--lr", type=float, default=5e-4)
#     p.add_argument("--train-end", default="2025-06-30 23:00:00")
#     p.add_argument("--val-end", default="2025-10-31 23:00:00")
#     p.add_argument("--model-out", default="cv360_tft_model.keras")
#     p.add_argument("--scaler-out", default="cv360_tft_scaler.json")
#     p.add_argument("--d-model", type=int, default=64)
#     p.add_argument("--num-heads", type=int, default=4)
#     p.add_argument("--dropout", type=float, default=0.15)
#     args = p.parse_args()

#     cfg = TrainConfig(
#         input_csv=args.input,
#         horizon_hours=args.horizon,
#         seq_len=args.seq_len,
#         batch_size=args.batch_size,
#         epochs=args.epochs,
#         lr=args.lr,
#         train_end=args.train_end,
#         val_end=args.val_end,
#         model_out=args.model_out,
#         scaler_out=args.scaler_out,
#         d_model=args.d_model,
#         num_heads=args.num_heads,
#         dropout=args.dropout,
#     )

#     df = pd.read_csv(cfg.input_csv)
#     df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
#     df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()

#     feature_cols = _feature_columns(df, cfg.horizon_hours)
#     if not feature_cols:
#         raise ValueError("No feature columns found")

#     target_ret = f"target_ret_{cfg.horizon_hours}h"
#     df = df.dropna(subset=feature_cols + [target_ret])

#     train_df, val_df, test_df = _time_split(df, cfg.train_end, cfg.val_end)
#     if len(train_df) == 0 or len(val_df) == 0 or len(test_df) == 0:
#         raise ValueError("Time split produced empty train/val/test. Adjust --train-end/--val-end.")

#     symbols = sorted(train_df["symbol"].unique().tolist())
#     symbol_to_id = {s: i for i, s in enumerate(symbols)}
#     for d in (train_df, val_df, test_df):
#         d["symbol_id"] = d["symbol"].map(symbol_to_id).astype("Int64")
#         if d["symbol_id"].isna().any():
#             missing = sorted(d.loc[d["symbol_id"].isna(), "symbol"].unique().tolist())
#             raise ValueError(f"Found symbols in split not present in train: {missing}")
#         d["symbol_id"] = d["symbol_id"].astype(np.int32)

#     move_scale = float(train_df[target_ret].abs().quantile(0.90))
#     if not np.isfinite(move_scale) or move_scale <= 0:
#         move_scale = 0.01

#     scaler = fit_scaler(train_df, feature_cols)
#     with open(cfg.scaler_out, "w", encoding="utf-8") as f:
#         json.dump(
#             {
#                 "feature_cols": feature_cols,
#                 "mean": scaler["mean"],
#                 "std": scaler["std"],
#                 "horizon_hours": cfg.horizon_hours,
#                 "seq_len": cfg.seq_len,
#                 "symbol_to_id": symbol_to_id,
#                 "quantiles": [0.1, 0.5, 0.9],
#                 "model_type": "tft",
#             },
#             f,
#             ensure_ascii=False,
#             indent=2,
#         )

#     train_df = apply_scaler(train_df, feature_cols, scaler)
#     val_df = apply_scaler(val_df, feature_cols, scaler)
#     test_df = apply_scaler(test_df, feature_cols, scaler)

#     train_ds = make_tf_dataset(train_df, feature_cols, cfg.horizon_hours, cfg.seq_len, cfg.batch_size, shuffle=True, weight_scale=move_scale)
#     val_ds = make_tf_dataset(val_df, feature_cols, cfg.horizon_hours, cfg.seq_len, cfg.batch_size, shuffle=False, weight_scale=move_scale)
#     test_ds = make_tf_dataset(test_df, feature_cols, cfg.horizon_hours, cfg.seq_len, cfg.batch_size, shuffle=False, weight_scale=move_scale)

#     model = build_tft_model(cfg.seq_len, len(feature_cols), n_symbols=len(symbol_to_id), d_model=cfg.d_model, num_heads=cfg.num_heads, dropout=cfg.dropout)
#     model.compile(
#         optimizer=tf.keras.optimizers.Adam(learning_rate=cfg.lr),
#         loss=quantile_loss([0.1, 0.5, 0.9]),
#     )

#     callbacks = [
#         tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True),
#         tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5),
#     ]

#     model.fit(train_ds, validation_data=val_ds, epochs=cfg.epochs, callbacks=callbacks)
#     metrics = model.evaluate(test_ds, return_dict=True)
#     print("TEST_METRICS", metrics)

#     model.save(cfg.model_out)
#     print(f"Saved model: {cfg.model_out}")
#     print(f"Saved scaler: {cfg.scaler_out}")


# if __name__ == "__main__":
#     main()


# =========================================================
# INVESTOR-GRADE CRYPTO FORECAST MODEL (STABLE)
# =========================================================

# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf

# =========================================================
# 0. SYSTEM SETUP
# =========================================================

tf.keras.utils.set_random_seed(42)
tf.config.optimizer.set_jit(True)

from tensorflow.keras import mixed_precision
mixed_precision.set_global_policy("mixed_float16")
print("Mixed precision:", mixed_precision.global_policy())

# =========================================================
# 1. CONFIG
# =========================================================

CSV_PATH = "cv360_features.csv"
SEQ_LEN = 72
BATCH = 32
EPOCHS = 100
LR = 3e-4
TARGET_SCALE = 100.0

TIME_COL = "timestamp"
SYMBOL_COL = "symbol"
TARGET_COL = "target_ret_12h"

# =========================================================
# 2. LOAD & HARD CLEAN DATA
# =========================================================

df = pd.read_csv(CSV_PATH)

df[TIME_COL] = pd.to_datetime(df[TIME_COL])
df[SYMBOL_COL] = df[SYMBOL_COL].astype(str).str.upper()

# Select numeric features only
feature_cols = [
    c for c in df.columns
    if c not in [TIME_COL, SYMBOL_COL, TARGET_COL]
    and df[c].dtype.kind in "fi"
]

# Replace Inf → NaN → DROP
df = df.replace([np.inf, -np.inf], np.nan)
df = df.dropna(subset=feature_cols + [TARGET_COL])

# ASSERT CLEAN
assert not df.isna().any().any(), "NaNs still present"

# =========================================================
# 3. TARGET ENGINEERING (CRITICAL)
# =========================================================

df["target"] = df[TARGET_COL] * TARGET_SCALE
df["direction"] = (df["target"] > 0).astype(np.float32)

# =========================================================
# 4. SYMBOL ENCODING
# =========================================================

symbols = sorted(df[SYMBOL_COL].unique())
symbol_to_id = {s: i for i, s in enumerate(symbols)}
df["symbol_id"] = df[SYMBOL_COL].map(symbol_to_id).astype(np.int32)

N_SYMBOLS = len(symbols)
print("Coins:", N_SYMBOLS)

# =========================================================
# 5. ROBUST SCALING
# =========================================================

mu = df[feature_cols].mean()
sd = df[feature_cols].std().replace(0, 1.0)

df[feature_cols] = (df[feature_cols] - mu) / sd

# =========================================================
# 6. WINDOW GENERATOR (STREAMING SAFE)
# =========================================================

def make_ds(df, shuffle=True):
    df = df.sort_values(["symbol_id", TIME_COL])
    X = df[feature_cols].values.astype("float32")
    y = df["target"].values.astype("float32")
    d = df["direction"].values.astype("float32")
    sid = df["symbol_id"].values

    def gen():
        i = 0
        while i + SEQ_LEN < len(df):
            if sid[i] == sid[i + SEQ_LEN]:
                yield (
                    {
                        "x": X[i:i+SEQ_LEN],
                        "sid": sid[i]
                    },
                    {
                        "ret": y[i+SEQ_LEN],
                        "dir": d[i+SEQ_LEN]
                    }
                )
            i += 1

    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            {
                "x": tf.TensorSpec((SEQ_LEN, len(feature_cols)), tf.float32),
                "sid": tf.TensorSpec((), tf.int32)
            },
            {
                "ret": tf.TensorSpec((), tf.float32),
                "dir": tf.TensorSpec((), tf.float32)
            }
        )
    )

    if shuffle:
        ds = ds.shuffle(50000)

    return ds.batch(BATCH).prefetch(tf.data.AUTOTUNE)

# =========================================================
# 7. MODEL (STABLE HYBRID)
# =========================================================

def build_model():
    x_in = tf.keras.Input((SEQ_LEN, len(feature_cols)), name="x")
    sid = tf.keras.Input((), dtype=tf.int32, name="sid")

    emb = tf.keras.layers.Embedding(N_SYMBOLS, 16)(sid)
    emb = tf.keras.layers.Dense(64, activation="relu")(emb)
    emb = tf.keras.layers.RepeatVector(SEQ_LEN)(emb)

    x = tf.keras.layers.Concatenate()([x_in, emb])

    x = tf.keras.layers.Bidirectional(
        tf.keras.layers.LSTM(64, return_sequences=True)
    )(x)

    x = tf.keras.layers.LayerNormalization()(x)
    x = tf.keras.layers.LSTM(64)(x)

    x = tf.keras.layers.Dense(64, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.2)(x)

    # Outputs (force float32 for stability)
    ret = tf.keras.layers.Dense(1, dtype="float32", name="ret")(x)
    dir = tf.keras.layers.Dense(1, activation="sigmoid", dtype="float32", name="dir")(x)

    return tf.keras.Model(inputs={"x": x_in, "sid": sid}, outputs={"ret": ret, "dir": dir})

model = build_model()
model.summary()

# =========================================================
# 8. LOSSES (SAFE)
# =========================================================

def huber(y_true, y_pred):
    return tf.keras.losses.Huber()(y_true, y_pred)

losses = {
    "ret": huber,
    "dir": tf.keras.losses.BinaryCrossentropy()
}

loss_weights = {
    "ret": 1.0,
    "dir": 0.3
}

opt = mixed_precision.LossScaleOptimizer(
    tf.keras.optimizers.Adam(LR, clipnorm=1.0)
)

model.compile(optimizer=opt, loss=losses, loss_weights=loss_weights)

# =========================================================
# 9. TRAIN
# =========================================================

train_ds = make_ds(df)

model.fit(
    train_ds,
    epochs=EPOCHS,
    callbacks=[
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(patience=3)
    ]
)

# =========================================================
# 10. SAVE (INVESTOR SAFE)
# =========================================================

model.save("cv360_investor_model.keras")

with open("scaler.json", "w") as f:
    json.dump(
        {
            "features": feature_cols,
            "mean": mu.to_dict(),
            "std": sd.to_dict(),
            "target_scale": TARGET_SCALE,
            "symbols": symbol_to_id
        },
        f,
        indent=2
    )

print("✅ MODEL READY FOR INVESTORS")
