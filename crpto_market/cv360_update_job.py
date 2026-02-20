# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import argparse
import json
import os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import tensorflow as tf


def load_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_feature_cols(scaler: Dict) -> List[str]:
    if "feature_cols" in scaler and scaler["feature_cols"]:
        return list(scaler["feature_cols"])
    if "features" in scaler and scaler["features"]:
        feats = list(scaler["features"])
        feats = [c for c in feats if not str(c).startswith("target_")]
        return feats
    raise ValueError("Scaler JSON must contain 'feature_cols' or 'features'.")


def _get_symbol_to_id(scaler: Dict) -> Dict[str, int]:
    if "symbol_to_id" in scaler and scaler["symbol_to_id"]:
        return {str(k): int(v) for k, v in scaler["symbol_to_id"].items()}
    if "symbols" in scaler and scaler["symbols"]:
        return {str(k): int(v) for k, v in scaler["symbols"].items()}
    return {}


def apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict) -> pd.DataFrame:
    mu = pd.Series(scaler["mean"])
    sd = pd.Series(scaler["std"])
    out = df.copy()
    out[feature_cols] = (out[feature_cols] - mu[feature_cols].values) / sd[feature_cols].values
    return out


def make_sequences_for_symbol(
    g: pd.DataFrame,
    feature_cols: List[str],
    target_col: Optional[str],
    seq_len: int,
    symbol_id: int,
):
    g = g.sort_values("timestamp", kind="mergesort")
    x = g[feature_cols].to_numpy(dtype=np.float32)
    t = g["timestamp"].to_numpy()
    c = g["close"].to_numpy(dtype=np.float32)

    y = None
    if target_col and target_col in g.columns:
        y = g[target_col].to_numpy(dtype=np.float32)

    if len(g) <= seq_len:
        return np.empty((0, seq_len, len(feature_cols)), dtype=np.float32), y, np.empty((0,), dtype=object), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

    xs = []
    ys = []
    ts = []
    closes = []

    for i in range(seq_len - 1, len(g)):
        xw = x[i - seq_len + 1 : i + 1]
        if np.isnan(xw).any():
            continue
        if y is not None:
            yw = float(y[i])
            if np.isnan(yw):
                continue
            ys.append(yw)
        xs.append(xw)
        ts.append(t[i])
        closes.append(float(c[i]))

    if not xs:
        return np.empty((0, seq_len, len(feature_cols)), dtype=np.float32), None if y is None else np.empty((0,), dtype=np.float32), np.empty((0,), dtype=object), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

    X = np.stack(xs, axis=0)
    ts_arr = np.asarray(ts)
    sids = np.full((len(X),), np.int32(symbol_id), dtype=np.int32)
    close_now = np.asarray(closes, dtype=np.float32)
    y_arr = None if y is None else np.asarray(ys, dtype=np.float32)
    return X, y_arr, ts_arr, sids, close_now


def infer_predictions(model: tf.keras.Model, X: np.ndarray, sids: np.ndarray, batch_size: int = 1024) -> Dict[str, np.ndarray]:
    input_names = list(getattr(model, "input_names", []))
    sid_key: Optional[str] = None
    if "symbol_id" in input_names:
        sid_key = "symbol_id"
    elif "sid" in input_names:
        sid_key = "sid"
    else:
        for n in input_names:
            if n != "x":
                sid_key = n
                break
    if sid_key is None:
        raise ValueError(f"Could not determine symbol id input name from model.input_names={input_names}")

    yhat = model.predict({"x": X, sid_key: sids}, batch_size=batch_size, verbose=0)
    yhat = np.asarray(yhat)

    if yhat.ndim != 2:
        raise ValueError(f"Unexpected model output shape: {yhat.shape}")

    if yhat.shape[1] == 3:
        return {"q10": yhat[:, 0].astype(np.float32), "q50": yhat[:, 1].astype(np.float32), "q90": yhat[:, 2].astype(np.float32)}

    if yhat.shape[1] == 2:
        mu = yhat[:, 0].astype(np.float32)
        sigma = np.exp(yhat[:, 1]).astype(np.float32)
        return {"mu": mu, "sigma": sigma}

    if yhat.shape[1] == 1:
        return {"mu": yhat[:, 0].astype(np.float32)}

    raise ValueError(f"Unsupported model output dimension: {yhat.shape[1]}")


def build_latest_rows_by_symbol(
    features_path: str,
    *,
    symbols: List[str],
    feature_cols: List[str],
    target_col: Optional[str],
    min_timestamp: pd.Timestamp,
    tail_rows: int,
    chunksize: int = 250_000,
) -> Dict[str, pd.DataFrame]:
    needed = ["timestamp", "symbol", "close"] + feature_cols
    if target_col:
        needed.append(target_col)
    usecols = list(dict.fromkeys(needed))

    dtypes: Dict[str, str] = {"symbol": "string"}
    for c in feature_cols:
        dtypes[c] = "float32"
    dtypes["close"] = "float32"
    if target_col:
        dtypes[target_col] = "float32"

    sym_set = {s.strip().upper() for s in symbols}
    buffers: Dict[str, List[pd.DataFrame]] = {s: [] for s in sym_set}
    counts: Dict[str, int] = {s: 0 for s in sym_set}

    for chunk in pd.read_csv(
        features_path,
        usecols=usecols,
        dtype=dtypes,
        parse_dates=["timestamp"],
        chunksize=chunksize,
        low_memory=True,
    ):
        chunk["symbol"] = chunk["symbol"].astype(str).str.strip().str.upper()
        chunk = chunk.loc[chunk["timestamp"] > min_timestamp]
        if len(chunk) == 0:
            continue
        chunk = chunk.loc[chunk["symbol"].isin(sym_set)]
        if len(chunk) == 0:
            continue

        for sym, g in chunk.groupby("symbol", sort=False):
            if sym not in buffers:
                continue
            g = g.sort_values("timestamp", kind="mergesort")
            buffers[sym].append(g)
            counts[sym] += int(len(g))
            while counts[sym] > tail_rows and buffers[sym]:
                head = buffers[sym][0]
                if counts[sym] - len(head) >= tail_rows:
                    buffers[sym].pop(0)
                    counts[sym] -= int(len(head))
                else:
                    drop_n = counts[sym] - tail_rows
                    buffers[sym][0] = head.iloc[int(drop_n):].copy()
                    counts[sym] = tail_rows
                    break

    out: Dict[str, pd.DataFrame] = {}
    for sym in sym_set:
        if not buffers[sym]:
            continue
        out[sym] = pd.concat(buffers[sym], ignore_index=True)
    return out


def check_alerts(latest_screener: pd.DataFrame, rules: List[Dict]) -> pd.DataFrame:
    rows = []
    for r in rules:
        pred_min = float(r.get("pred_min", 0.0))
        conf_max = float(r.get("conf_max", 0.0))
        df = latest_screener.copy()
        df = df.loc[df["pred"] >= pred_min]
        if conf_max > 0 and "confidence_width" in df.columns:
            df = df.loc[df["confidence_width"] <= conf_max]
        df = df.sort_values(["pred", "symbol"], ascending=[False, True])
        for _, row in df.iterrows():
            rows.append(
                {
                    "rule": str(r.get("name", "rule")),
                    "symbol": row.get("symbol"),
                    "timestamp": row.get("timestamp"),
                    "pred": row.get("pred"),
                    "confidence_width": row.get("confidence_width", np.nan),
                }
            )
    if not rows:
        return pd.DataFrame(columns=["rule", "symbol", "timestamp", "pred", "confidence_width"])
    return pd.DataFrame(rows).sort_values(["rule", "pred"], ascending=[True, False])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="cv360_investor_model.keras")
    p.add_argument("--scaler", default="scaler.json")
    p.add_argument("--features", default="cv360_features.csv")
    p.add_argument("--val-end", default="2025-10-31 23:00:00")
    p.add_argument("--target", default="", help="target column for evaluation/backtest. Leave blank to predict only.")
    p.add_argument("--tail", type=int, default=600)
    p.add_argument("--screener-out", default="screener_latest.csv")
    p.add_argument("--alerts", default="alerts.json")
    p.add_argument("--alerts-out", default="alerts_latest.csv")
    args = p.parse_args()

    if not os.path.exists(args.model):
        raise FileNotFoundError(args.model)
    if not os.path.exists(args.scaler):
        raise FileNotFoundError(args.scaler)
    if not os.path.exists(args.features):
        raise FileNotFoundError(args.features)

    scaler = load_json(args.scaler)
    feature_cols = _get_feature_cols(scaler)
    symbol_to_id = _get_symbol_to_id(scaler)
    if not symbol_to_id:
        raise ValueError("Scaler missing symbols mapping (symbols/symbol_to_id)")

    symbols = sorted(symbol_to_id.keys())
    seq_len = int(scaler.get("seq_len", 72))
    val_end_ts = pd.to_datetime(args.val_end)
    target_col = args.target.strip() or None

    model = tf.keras.models.load_model(args.model, compile=False)

    keep_per_symbol = max(int(args.tail), seq_len + 5)
    sym_frames = build_latest_rows_by_symbol(
        args.features,
        symbols=symbols,
        feature_cols=feature_cols,
        target_col=target_col,
        min_timestamp=val_end_ts,
        tail_rows=keep_per_symbol,
    )

    screener_rows = []
    for sym in symbols:
        if sym not in sym_frames:
            continue
        g = sym_frames[sym]
        sid = int(symbol_to_id[sym])
        g["symbol_id"] = np.int32(sid)
        g = g.dropna(subset=["close"] + feature_cols + ([target_col] if target_col else [])).copy()
        if len(g) < seq_len + 1:
            continue

        g_scaled = apply_scaler(g, feature_cols, scaler)
        X, y_true, ts, sids, close_now = make_sequences_for_symbol(g_scaled, feature_cols, target_col, seq_len, sid)
        if len(X) == 0:
            continue

        X_last = X[-1:]
        sids_last = sids[-1:]
        preds = infer_predictions(model, X_last, sids_last, batch_size=1)
        ts_last = pd.Timestamp(pd.to_datetime(ts[-1]))
        close_last = float(close_now[-1])

        row = {"symbol": sym, "timestamp": ts_last, "close_now": close_last}
        if "q50" in preds:
            row["pred"] = float(preds["q50"][0])
            row["q10"] = float(preds["q10"][0])
            row["q90"] = float(preds["q90"][0])
            row["confidence_width"] = float(preds["q90"][0] - preds["q10"][0])
        else:
            row["pred"] = float(preds.get("mu")[0]) if preds.get("mu") is not None else np.nan
            if "sigma" in preds:
                row["sigma"] = float(preds["sigma"][0])
        if y_true is not None and len(y_true) > 0:
            row["y_true_last"] = float(y_true[-1])

        screener_rows.append(row)

    screener = pd.DataFrame(screener_rows).sort_values(["pred", "symbol"], ascending=[False, True])
    screener.to_csv(args.screener_out, index=False)
    print(f"Wrote screener: {args.screener_out} (rows={len(screener)})")

    rules = []
    if os.path.exists(args.alerts):
        try:
            rules = load_json(args.alerts)
        except Exception:
            rules = []

    if isinstance(rules, list) and len(rules) > 0 and len(screener) > 0:
        alerts_df = check_alerts(screener, rules)
        alerts_df.to_csv(args.alerts_out, index=False)
        print(f"Wrote alerts: {args.alerts_out} (rows={len(alerts_df)})")
    else:
        print("No alerts written (missing rules or empty screener)")


if __name__ == "__main__":
    main()
