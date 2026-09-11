"""
signal_history.py — Historical Signal Evidence Engine

Backtests technical signals against historical price data to provide
evidence-based confidence for current signals. Uses leakage-safe
methodology (only data available at signal time).

Tracks accuracy of: RSI signals, MACD crossovers, trend signals, Bollinger bands.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional


def _backtest_rsi(df: pd.DataFrame, period: int = 14, hold_days: int = 5) -> Dict[str, Any]:
    """
    Backtest RSI buy/sell signals.
    Buy when RSI < 30, sell when RSI > 70. Measure forward return over hold_days.
    """
    if "RSI" not in df.columns or len(df) < period + hold_days + 5:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    signals = []
    closes = df["Close"].astype(float).values
    rsi = df["RSI"].astype(float).values

    for i in range(period, len(df) - hold_days):
        if np.isnan(rsi[i]):
            continue
        if rsi[i] < 30:  # Buy signal
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (exit_price - entry) / entry * 100
            signals.append({"type": "buy", "rsi": round(rsi[i], 1), "return_pct": round(ret, 2), "correct": ret > 0})
        elif rsi[i] > 70:  # Sell signal
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (entry - exit_price) / entry * 100  # short P&L
            signals.append({"type": "sell", "rsi": round(rsi[i], 1), "return_pct": round(ret, 2), "correct": ret > 0})

    if not signals:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    correct = sum(1 for s in signals if s["correct"])
    return {
        "accuracy": round(correct / len(signals), 3),
        "sample_size": len(signals),
        "avg_return": round(np.mean([s["return_pct"] for s in signals]), 2),
        "signals": signals[-10:],  # last 10 signals
    }


def _backtest_macd(df: pd.DataFrame, hold_days: int = 5) -> Dict[str, Any]:
    """
    Backtest MACD crossover signals.
    Buy on bullish crossover, sell on bearish crossover.
    """
    if not all(c in df.columns for c in ["MACD", "Signal"]) or len(df) < hold_days + 5:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    macd = df["MACD"].astype(float).values
    signal = df["Signal"].astype(float).values
    closes = df["Close"].astype(float).values
    signals = []

    for i in range(1, len(df) - hold_days):
        if np.isnan(macd[i]) or np.isnan(signal[i]) or np.isnan(macd[i-1]) or np.isnan(signal[i-1]):
            continue
        # Bullish crossover
        if macd[i] > signal[i] and macd[i-1] <= signal[i-1]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (exit_price - entry) / entry * 100
            signals.append({"type": "buy", "return_pct": round(ret, 2), "correct": ret > 0})
        # Bearish crossover
        elif macd[i] < signal[i] and macd[i-1] >= signal[i-1]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (entry - exit_price) / entry * 100
            signals.append({"type": "sell", "return_pct": round(ret, 2), "correct": ret > 0})

    if not signals:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    correct = sum(1 for s in signals if s["correct"])
    return {
        "accuracy": round(correct / len(signals), 3),
        "sample_size": len(signals),
        "avg_return": round(np.mean([s["return_pct"] for s in signals]), 2),
        "signals": signals[-10:],
    }


def _backtest_trend(df: pd.DataFrame, hold_days: int = 10) -> Dict[str, Any]:
    """
    Backtest trend-following signals (SMA20 > SMA50 = bullish).
    """
    if not all(c in df.columns for c in ["SMA20", "SMA50"]) or len(df) < hold_days + 5:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    sma20 = df["SMA20"].astype(float).values
    sma50 = df["SMA50"].astype(float).values
    closes = df["Close"].astype(float).values
    signals = []

    for i in range(1, len(df) - hold_days):
        if np.isnan(sma20[i]) or np.isnan(sma50[i]):
            continue
        # Golden cross
        if sma20[i] > sma50[i] and sma20[i-1] <= sma50[i-1]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (exit_price - entry) / entry * 100
            signals.append({"type": "golden_cross", "return_pct": round(ret, 2), "correct": ret > 0})
        # Death cross
        elif sma20[i] < sma50[i] and sma20[i-1] >= sma50[i-1]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (entry - exit_price) / entry * 100
            signals.append({"type": "death_cross", "return_pct": round(ret, 2), "correct": ret > 0})

    if not signals:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    correct = sum(1 for s in signals if s["correct"])
    return {
        "accuracy": round(correct / len(signals), 3),
        "sample_size": len(signals),
        "avg_return": round(np.mean([s["return_pct"] for s in signals]), 2),
        "signals": signals[-10:],
    }


def _backtest_bollinger(df: pd.DataFrame, hold_days: int = 5) -> Dict[str, Any]:
    """
    Backtest Bollinger Band mean-reversion signals.
    Buy when price touches lower band, sell when touches upper band.
    """
    if not all(c in df.columns for c in ["Close", "UpperBand", "LowerBand"]) or len(df) < hold_days + 5:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    closes = df["Close"].astype(float).values
    upper = df["UpperBand"].astype(float).values
    lower = df["LowerBand"].astype(float).values
    signals = []

    for i in range(len(df) - hold_days):
        if np.isnan(upper[i]) or np.isnan(lower[i]):
            continue
        if closes[i] <= lower[i]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (exit_price - entry) / entry * 100
            signals.append({"type": "buy_at_lower", "return_pct": round(ret, 2), "correct": ret > 0})
        elif closes[i] >= upper[i]:
            entry = closes[i]
            exit_price = closes[min(i + hold_days, len(closes) - 1)]
            ret = (entry - exit_price) / entry * 100
            signals.append({"type": "sell_at_upper", "return_pct": round(ret, 2), "correct": ret > 0})

    if not signals:
        return {"accuracy": 0.0, "sample_size": 0, "signals": []}

    correct = sum(1 for s in signals if s["correct"])
    return {
        "accuracy": round(correct / len(signals), 3),
        "sample_size": len(signals),
        "avg_return": round(np.mean([s["return_pct"] for s in signals]), 2),
        "signals": signals[-10:],
    }


def compute_signal_evidence(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute historical signal evidence for all indicators.
    Returns accuracy metrics and recent signal history for each.
    """
    rsi = _backtest_rsi(df)
    macd = _backtest_macd(df)
    trend = _backtest_trend(df)
    bollinger = _backtest_bollinger(df)

    # Overall evidence score
    all_accuracies = [r["accuracy"] for r in [rsi, macd, trend, bollinger] if r["sample_size"] > 0]
    overall_accuracy = np.mean(all_accuracies) if all_accuracies else 0.0

    # Evidence strength
    if overall_accuracy > 0.65:
        evidence_label = "Strong"
    elif overall_accuracy > 0.55:
        evidence_label = "Moderate"
    else:
        evidence_label = "Weak"

    return {
        "overall_accuracy": round(overall_accuracy, 3),
        "evidence_label": evidence_label,
        "indicators": {
            "rsi": rsi,
            "macd": macd,
            "trend": trend,
            "bollinger": bollinger,
        },
        "summary": (
            f"Overall signal accuracy: {overall_accuracy:.1%} ({evidence_label} evidence). "
            f"RSI: {rsi['accuracy']:.1%} ({rsi['sample_size']} signals). "
            f"MACD: {macd['accuracy']:.1%} ({macd['sample_size']} signals). "
            f"Trend: {trend['accuracy']:.1%} ({trend['sample_size']} signals). "
            f"Bollinger: {bollinger['accuracy']:.1%} ({bollinger['sample_size']} signals)."
        ),
    }
