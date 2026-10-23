"""
indicators.py — Technical indicator calculations for the StockVantex backend.

Indicator definitions and formula references
--------------------------------------------
RSI (Wilder, 1978):
    lookback: 14 periods  
    formula: RS = avg_gain / avg_loss over 14 periods using Wilder's smoothed EMA
             RSI = 100 – (100 / (1 + RS))
    warm-up: at least 14 bars of price history are required; the first value
             uses simple average, then exponential smoothing is applied.
    interpretation: >70 typically overbought, <30 typically oversold (conventional
                    thresholds; not predictive on their own).

MACD (Appel, 1979):
    fast EMA span  : 12 periods
    slow EMA span  : 26 periods
    signal EMA span:  9 periods
    formula: MACD line = EMA(12) – EMA(26); Signal = EMA(9) of MACD line
    warm-up: at least 26 bars required for meaningful MACD; signal adds 9 more.
    interpretation: positive MACD = fast EMA above slow EMA (momentum bias upward).

Bollinger Bands (Bollinger, 1992):
    period   : 20
    std devs : 2
    formula: middle = SMA(20); upper = middle + 2·σ(20); lower = middle – 2·σ(20)
    warm-up: 20 bars
    interpretation: price near upper band → relatively extended; near lower → relatively compressed.

Moving Averages:
    SMA20 / SMA50: simple rolling mean over 20 / 50 periods (require 20 / 50 bars).
    EMA20: exponential moving average, span=20 (adjust=False for recursive form).

ATR (Average True Range, Wilder, 1978):
    period : 14
    formula: TR = max(High–Low, |High–PrevClose|, |Low–PrevClose|)
             ATR = rolling mean of TR over 14 periods
    warm-up: 15 bars (14 + 1 for prev_close)
    interpretation: raw measure of market volatility; no directional signal.

Timeframe: all indicators operate on the daily OHLCV series that is passed in.
           No future observations are used (no look-ahead).

Data quality:
    - All rows containing NaN in any calculated column are dropped before returning.
    - If a DataFrame has fewer rows than an indicator's lookback the column will
      be entirely NaN and those rows are therefore dropped, returning an empty list.
"""

import numpy as np
import pandas as pd


def calculate_indicators(df: pd.DataFrame) -> list[dict]:
    """
    Compute technical indicators on a daily OHLCV DataFrame and return
    records (list of dicts) ready for JSON serialisation.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns: Close, High, Low, Open, Volume.
        Index should be a DatetimeIndex or have a 'Date'-named index.

    Returns
    -------
    list[dict]
        One dict per row (after NaN rows are dropped). Each dict contains:
        Date, Open, High, Low, Close, Volume, SMA20, SMA50, EMA20,
        UpperBand, LowerBand, ATR, RSI, MACD, Signal.
    """
    # Work on a copy to avoid mutating cached DataFrames
    df = df.copy()

    # ── MultiIndex normalisation ──────────────────────────────────────────────
    # yfinance sometimes returns a MultiIndex with (field, ticker) levels.
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = df.columns.droplevel(1)
    # Safety: flatten any remaining tuple column names
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
    # Squeeze single-column DataFrames back to Series
    for col in ("Close", "High", "Low", "Open", "Volume"):
        if col in df.columns:
            val = df[col]
            if isinstance(val, pd.DataFrame):
                df[col] = val.iloc[:, 0]

    close = df["Close"]

    # ── Moving Averages ───────────────────────────────────────────────────────
    df["SMA20"] = close.rolling(20).mean()
    df["SMA50"] = close.rolling(50).mean()
    df["EMA20"] = close.ewm(span=20, adjust=False).mean()

    # ── ATR ───────────────────────────────────────────────────────────────────
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            df["High"] - df["Low"],
            (df["High"] - prev_close).abs(),
            (df["Low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    df["ATR"] = tr.rolling(14).mean()

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    rolling_mean = close.rolling(20).mean()
    rolling_std = close.rolling(20).std()
    df["UpperBand"] = rolling_mean + 2.0 * rolling_std
    df["LowerBand"] = rolling_mean - 2.0 * rolling_std

    # ── RSI (Wilder's smoothed EMA method) ───────────────────────────────────
    # Using Wilder's EMA (com = period – 1) instead of simple rolling mean
    # avoids the known bias of SMA-RSI and matches the conventional definition.
    delta = close.diff(1)
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)

    # First value: simple average over lookback; subsequent: Wilder's EMA
    _WILDER_PERIOD = 14
    avg_gain = gain.ewm(com=_WILDER_PERIOD - 1, min_periods=_WILDER_PERIOD, adjust=False).mean()
    avg_loss = loss.ewm(com=_WILDER_PERIOD - 1, min_periods=_WILDER_PERIOD, adjust=False).mean()

    # When avg_loss == 0, RSI is defined as 100 (fully overbought reading).
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["RSI"] = 100.0 - (100.0 / (1.0 + rs))
    # Fill the 0-avg_loss edge case: if gain > 0 → RSI=100; if both 0 → RSI=50
    df["RSI"] = df["RSI"].where(avg_loss != 0, other=np.where(avg_gain > 0, 100.0, 50.0))

    # ── MACD ──────────────────────────────────────────────────────────────────
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["MACD"] = ema12 - ema26
    df["Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

    # ── Finalise ──────────────────────────────────────────────────────────────
    result = df.dropna().reset_index()
    # Normalise the date column name
    date_col = result.columns[0]
    if date_col != "Date":
        result = result.rename(columns={date_col: "Date"})
    if "Date" in result.columns:
        result["Date"] = result["Date"].astype(str)

    return result.to_dict("records")