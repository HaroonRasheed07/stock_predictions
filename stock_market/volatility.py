# volatility.py — Volatility computations for the Volatility Monitor and Risk Overview
"""
Provides volatility calculations including daily/weekly volatility,
Average True Range (ATR), expected trading range, and relative volume.
"""

import numpy as np
import pandas as pd
import math
from typing import Dict, Any, Optional
from utils import _get_cached_scan, _set_cached_scan


def safe_float(val, default=0.0):
    """Convert value to float safely, handling NaN/Inf."""
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return round(f, 6)
    except (TypeError, ValueError):
        return default


def calculate_daily_volatility(df: pd.DataFrame) -> float:
    """
    Calculate annualized daily volatility from close prices.
    Returns volatility as a percentage.
    """
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    if len(close) < 2:
        return 0.0

    returns = close.pct_change().dropna()
    if len(returns) == 0:
        return 0.0

    daily_std = returns.std()
    annualized = daily_std * np.sqrt(252) * 100  # 252 trading days
    return safe_float(annualized)


def calculate_weekly_volatility(df: pd.DataFrame) -> float:
    """
    Calculate annualized weekly volatility from close prices.
    Returns volatility as a percentage.
    """
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    if len(close) < 10:
        return 0.0

    # Resample to weekly close
    weekly = close.resample("W").last().dropna()
    if len(weekly) < 2:
        return 0.0

    returns = weekly.pct_change().dropna()
    if len(returns) == 0:
        return 0.0

    weekly_std = returns.std()
    annualized = weekly_std * np.sqrt(52) * 100  # 52 weeks
    return safe_float(annualized)


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """
    Calculate Average True Range (ATR).
    Returns a pandas Series with ATR values.
    """
    high = df["High"]
    low = df["Low"]
    close = df["Close"]

    if isinstance(high, pd.DataFrame):
        high = high.iloc[:, 0]
    if isinstance(low, pd.DataFrame):
        low = low.iloc[:, 0]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    if len(df) < period + 1:
        return pd.Series(np.nan, index=df.index)

    # True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()

    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = true_range.rolling(window=period).mean()

    return atr


def calculate_atr_value(df: pd.DataFrame, period: int = 14) -> float:
    """Get the latest ATR value as a float."""
    atr_series = calculate_atr(df, period)
    last_atr = atr_series.iloc[-1] if len(atr_series) > 0 else 0.0
    return safe_float(last_atr)


def calculate_expected_range(df: pd.DataFrame, period: int = 14) -> Dict[str, float]:
    """
    Estimate the expected daily trading range using ATR.
    Returns estimated high and low from the current price.
    """
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    current_price = safe_float(close.iloc[-1]) if len(close) > 0 else 0.0
    atr_val = calculate_atr_value(df, period)

    if current_price == 0 or atr_val == 0:
        return {
            "current_price": current_price,
            "atr": 0.0,
            "expected_high": current_price,
            "expected_low": current_price,
            "range_percent": 0.0,
        }

    expected_high = current_price + atr_val
    expected_low = current_price - atr_val
    range_percent = (atr_val / current_price) * 100

    return {
        "current_price": safe_float(current_price),
        "atr": safe_float(atr_val),
        "expected_high": safe_float(expected_high),
        "expected_low": safe_float(expected_low),
        "range_percent": safe_float(range_percent),
    }


def calculate_relative_volume(df: pd.DataFrame, lookback: int = 30) -> Dict[str, Any]:
    """
    Compare current volume with the N-day average volume.
    Returns relative volume ratio and classification.
    """
    volume = df.get("Volume")
    if volume is None:
        return {
            "available": False,
            "current_volume": 0,
            "avg_volume": 0,
            "relative_volume": 0.0,
            "classification": "N/A",
        }

    if isinstance(volume, pd.DataFrame):
        volume = volume.iloc[:, 0]

    volume = volume.dropna()
    if len(volume) < 2:
        return {
            "available": False,
            "current_volume": 0,
            "avg_volume": 0,
            "relative_volume": 0.0,
            "classification": "N/A",
        }

    current_vol = safe_float(volume.iloc[-1])

    # Calculate N-day average (excluding current day)
    historical = volume.iloc[-(lookback + 1):-1] if len(volume) > lookback else volume.iloc[:-1]
    avg_vol = safe_float(historical.mean())

    if avg_vol == 0 or current_vol == 0:
        return {
            "available": True,
            "current_volume": int(current_vol),
            "avg_volume": int(avg_vol),
            "relative_volume": 0.0,
            "classification": "Normal",
        }

    rel_vol = current_vol / avg_vol

    # Classify volume activity
    if rel_vol >= 2.0:
        classification = "Very High"
    elif rel_vol >= 1.5:
        classification = "High"
    elif rel_vol >= 0.8:
        classification = "Normal"
    elif rel_vol >= 0.5:
        classification = "Low"
    else:
        classification = "Very Low"

    # Recent volume history for charting (last 10 days)
    recent_days = min(10, len(volume))
    recent_volumes = []
    for i in range(recent_days, 0, -1):
        idx = len(volume) - i
        if idx >= 0:
            day_vol = safe_float(volume.iloc[idx])
            date_str = str(volume.index[idx].date()) if hasattr(volume.index[idx], 'date') else str(volume.index[idx])
            recent_volumes.append({
                "date": date_str,
                "volume": int(day_vol),
                "is_above_avg": day_vol > avg_vol,
            })

    return {
        "available": True,
        "current_volume": int(current_vol),
        "avg_volume": int(avg_vol),
        "relative_volume": safe_float(rel_vol, 2),
        "classification": classification,
        "recent_volumes": recent_volumes,
    }


def get_volatility_summary(df: pd.DataFrame, has_volume: bool = True, ticker: str = "", period: str = "1y") -> Dict[str, Any]:
    """
    Comprehensive volatility summary for a single asset.
    Combines daily vol, weekly vol, ATR, expected range, and relative volume.
    """
    # Check scan cache first
    cache_key = f"volatility_{ticker}_{period}"
    cached = _get_cached_scan(cache_key)
    if cached is not None:
        return cached
    
    result = {
        "daily_volatility": calculate_daily_volatility(df),
        "weekly_volatility": calculate_weekly_volatility(df),
        "atr": calculate_atr_value(df),
        "expected_range": calculate_expected_range(df),
    }

    if has_volume:
        result["relative_volume"] = calculate_relative_volume(df)
    else:
        result["relative_volume"] = {
            "available": False,
            "current_volume": 0,
            "avg_volume": 0,
            "relative_volume": 0.0,
            "classification": "N/A",
        }
    
    # Cache the result
    _set_cached_scan(cache_key, result)

    return result
