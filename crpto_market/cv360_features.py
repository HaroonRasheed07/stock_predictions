import argparse
from typing import List, Optional

import numpy as np
import pandas as pd


PRICE_COLS = ["open", "high", "low", "close", "volume"]


def _ema(s: pd.Series, span: int) -> pd.Series:
    return s.ewm(span=span, adjust=False).mean()


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)

    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = _ema(close, fast)
    ema_slow = _ema(close, slow)
    macd = ema_fast - ema_slow
    macd_signal = _ema(macd, signal)
    macd_hist = macd - macd_signal
    return macd, macd_signal, macd_hist


def _bollinger(close: pd.Series, window: int = 20, n_std: float = 2.0):
    mid = close.rolling(window=window, min_periods=window).mean()
    std = close.rolling(window=window, min_periods=window).std(ddof=0)
    upper = mid + n_std * std
    lower = mid - n_std * std
    width = (upper - lower) / mid.replace(0, np.nan)
    return mid, upper, lower, width


def compute_features_for_symbol(g: pd.DataFrame, horizon_hours: int) -> pd.DataFrame:
    g = g.sort_values("timestamp", kind="mergesort").copy()

    close = g["close"].astype(float)
    volume = g["volume"].astype(float)

    g["ret_1h"] = close.pct_change()
    g["logret_1h"] = np.log(close / close.shift(1))

    for w in [6, 12, 24, 48]:
        g[f"ret_{w}h"] = close.pct_change(w)

    for w in [12, 24, 48]:
        g[f"volatility_{w}h"] = g["logret_1h"].rolling(window=w, min_periods=w).std(ddof=0)

    g["sma_10"] = close.rolling(window=10, min_periods=10).mean()
    g["sma_20"] = close.rolling(window=20, min_periods=20).mean()
    g["sma_50"] = close.rolling(window=50, min_periods=50).mean()

    g["ema_10"] = _ema(close, 10)
    g["ema_20"] = _ema(close, 20)
    g["ema_50"] = _ema(close, 50)

    g["rsi_14"] = _rsi(close, 14)

    macd, macd_signal, macd_hist = _macd(close)
    g["macd"] = macd
    g["macd_signal"] = macd_signal
    g["macd_hist"] = macd_hist

    bb_mid, bb_upper, bb_lower, bb_width = _bollinger(close)
    g["bb_mid_20"] = bb_mid
    g["bb_upper_20"] = bb_upper
    g["bb_lower_20"] = bb_lower
    g["bb_width_20"] = bb_width

    g["vol_chg_1h"] = volume.pct_change()
    g["vol_sma_24"] = volume.rolling(window=24, min_periods=24).mean()
    g["vol_ratio_1h_24sma"] = volume / g["vol_sma_24"].replace(0, np.nan)

    g["hl_range"] = (g["high"] - g["low"]) / close.replace(0, np.nan)
    g["oc_range"] = (g["close"] - g["open"]) / g["open"].replace(0, np.nan)

    future_close = close.shift(-horizon_hours)
    g[f"target_ret_{horizon_hours}h"] = (future_close / close) - 1.0
    g[f"target_dir_{horizon_hours}h"] = (g[f"target_ret_{horizon_hours}h"] > 0).astype(int)

    return g


def build_feature_table(
    input_path: str,
    output_path: str,
    horizon_hours: int = 12,
    symbols: Optional[List[str]] = None,
) -> None:
    df = pd.read_csv(input_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()

    if symbols:
        keep = {s.strip().upper() for s in symbols}
        df = df.loc[df["symbol"].isin(keep)].copy()

    out_frames = []
    for sym, g in df.groupby("symbol", sort=False):
        out_frames.append(compute_features_for_symbol(g, horizon_hours=horizon_hours))

    feat = pd.concat(out_frames, ignore_index=True)

    feature_cols = [c for c in feat.columns if c not in PRICE_COLS + ["timestamp", "symbol", "imputed"]]
    feat = feat.dropna(subset=feature_cols)

    for c in feature_cols:
        if feat[c].dtype.kind == "f":
            feat[c] = feat[c].astype(np.float32)

    feat = feat.sort_values(["symbol", "timestamp"], kind="mergesort")
    feat.to_csv(output_path, index=False)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="cv360_clean_ohlcv.csv")
    p.add_argument("--output", default="cv360_features.csv")
    p.add_argument("--horizon", type=int, default=12)
    p.add_argument("--symbols", default="")
    args = p.parse_args()

    symbols = [s for s in args.symbols.split(",") if s.strip()] if args.symbols else None
    build_feature_table(args.input, args.output, horizon_hours=args.horizon, symbols=symbols)
    print(f"Wrote feature table: {args.output}")


if __name__ == "__main__":
    main()
