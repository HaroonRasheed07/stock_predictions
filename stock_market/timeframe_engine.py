"""
timeframe_engine.py — Timeframe-Based Decision Engine

Provides analysis tailored to three trading timeframes:
- Short-Term (1-5 days): RSI, MACD, volume spikes, momentum
- Swing (1-4 weeks): Trend, moving averages, Bollinger Bands, intermediate momentum
- Position (1-6 months): Long-term trend, valuation proxies, macro catalysts

Each timeframe produces a decision signal (Buy/Sell/Hold) with
timeframe-specific weightings and confidence.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Optional


# ---------------------------------------------------------------------------
# Timeframe Definitions
# ---------------------------------------------------------------------------

TIMEFRAMES = {
    "short_term": {
        "label": "Short-Term (1-5 days)",
        "description": "Momentum and mean-reversion signals for active traders",
        "lookback_periods": 20,
    },
    "swing": {
        "label": "Swing (1-4 weeks)",
        "description": "Trend-following signals for swing traders",
        "lookback_periods": 60,
    },
    "position": {
        "label": "Position (1-6 months)",
        "description": "Long-term directional bias for position traders",
        "lookback_periods": 120,
    },
}


# ---------------------------------------------------------------------------
# Individual Signal Calculators
# ---------------------------------------------------------------------------

def _rsi_signal(df: pd.DataFrame, window: int = 14) -> Dict[str, Any]:
    """RSI-based signal: oversold=buy, overbought=sell."""
    if "RSI" not in df.columns or len(df) < window:
        return {"signal": "neutral", "strength": 0.0, "detail": "RSI not available"}

    rsi = float(df["RSI"].iloc[-1])
    if rsi < 30:
        return {"signal": "buy", "strength": (30 - rsi) / 30, "detail": f"RSI oversold at {rsi:.1f}"}
    elif rsi > 70:
        return {"signal": "sell", "strength": (rsi - 70) / 30, "detail": f"RSI overbought at {rsi:.1f}"}
    return {"signal": "neutral", "strength": 0.0, "detail": f"RSI neutral at {rsi:.1f}"}


def _macd_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """MACD crossover signal."""
    if not all(c in df.columns for c in ["MACD", "Signal"]):
        return {"signal": "neutral", "strength": 0.0, "detail": "MACD not available"}

    macd = float(df["MACD"].iloc[-1])
    signal = float(df["Signal"].iloc[-1])
    prev_macd = float(df["MACD"].iloc[-2]) if len(df) > 1 else macd
    prev_signal = float(df["Signal"].iloc[-2]) if len(df) > 1 else signal

    # Crossover detection
    if macd > signal and prev_macd <= prev_signal:
        return {"signal": "buy", "strength": 0.8, "detail": "MACD bullish crossover"}
    elif macd < signal and prev_macd >= prev_signal:
        return {"signal": "sell", "strength": 0.8, "detail": "MACD bearish crossover"}

    # Directional bias
    diff = macd - signal
    strength = min(abs(diff) / (abs(macd) + 1e-10), 1.0)
    if diff > 0:
        return {"signal": "buy", "strength": strength, "detail": f"MACD above signal ({diff:.4f})"}
    elif diff < 0:
        return {"signal": "sell", "strength": strength, "detail": f"MACD below signal ({diff:.4f})"}

    return {"signal": "neutral", "strength": 0.0, "detail": "MACD flat"}


def _trend_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """Moving average trend signal."""
    if not all(c in df.columns for c in ["Close", "SMA20", "SMA50"]):
        return {"signal": "neutral", "strength": 0.0, "detail": "MA data not available"}

    close = float(df["Close"].iloc[-1])
    sma20 = float(df["SMA20"].iloc[-1])
    sma50 = float(df["SMA50"].iloc[-1])

    score = 0.0
    reasons = []

    if close > sma20:
        score += 0.3
        reasons.append("above SMA20")
    else:
        score -= 0.3
        reasons.append("below SMA20")

    if close > sma50:
        score += 0.3
        reasons.append("above SMA50")
    else:
        score -= 0.3
        reasons.append("below SMA50")

    if sma20 > sma50:
        score += 0.4
        reasons.append("SMA20 > SMA50 (golden cross)")
    else:
        score -= 0.4
        reasons.append("SMA20 < SMA50 (death cross)")

    signal = "buy" if score > 0.2 else "sell" if score < -0.2 else "neutral"
    return {
        "signal": signal,
        "strength": min(abs(score), 1.0),
        "detail": f"Trend: {', '.join(reasons)}",
    }


def _bollinger_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """Bollinger Band squeeze/breakout signal."""
    if not all(c in df.columns for c in ["Close", "UpperBand", "LowerBand", "SMA20"]):
        return {"signal": "neutral", "strength": 0.0, "detail": "Bollinger data not available"}

    close = float(df["Close"].iloc[-1])
    upper = float(df["UpperBand"].iloc[-1])
    lower = float(df["LowerBand"].iloc[-1])
    mid = float(df["SMA20"].iloc[-1])

    band_width = upper - lower
    if band_width <= 0:
        return {"signal": "neutral", "strength": 0.0, "detail": "Bollinger bands degenerate"}

    position = (close - lower) / band_width

    if close <= lower:
        return {"signal": "buy", "strength": 0.7, "detail": f"Price at lower Bollinger band ({position:.2f})"}
    elif close >= upper:
        return {"signal": "sell", "strength": 0.7, "detail": f"Price at upper Bollinger band ({position:.2f})"}
    elif position < 0.3:
        return {"signal": "buy", "strength": 0.4, "detail": f"Price near lower band ({position:.2f})"}
    elif position > 0.7:
        return {"signal": "sell", "strength": 0.4, "detail": f"Price near upper band ({position:.2f})"}

    return {"signal": "neutral", "strength": 0.0, "detail": f"Bollinger position: {position:.2f}"}


def _volume_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """Volume spike signal (confirms other signals)."""
    if "Volume" not in df.columns or len(df) < 20:
        return {"signal": "neutral", "strength": 0.0, "detail": "Volume data not available"}

    vol = df["Volume"].astype(float)
    avg_vol = vol.rolling(20).mean().iloc[-1]
    current_vol = float(vol.iloc[-1])

    if avg_vol <= 0:
        return {"signal": "neutral", "strength": 0.0, "detail": "Average volume is zero"}

    ratio = current_vol / avg_vol
    if ratio > 2.0:
        return {"signal": "neutral", "strength": 0.6, "detail": f"Volume spike: {ratio:.1f}x average"}
    elif ratio > 1.5:
        return {"signal": "neutral", "strength": 0.3, "detail": f"Above-average volume: {ratio:.1f}x"}
    elif ratio < 0.5:
        return {"signal": "neutral", "strength": 0.2, "detail": f"Low volume: {ratio:.1f}x average"}

    return {"signal": "neutral", "strength": 0.0, "detail": f"Normal volume: {ratio:.1f}x"}


def _atr_signal(df: pd.DataFrame) -> Dict[str, Any]:
    """ATR-based volatility signal."""
    if "ATR" not in df.columns or "Close" not in df.columns:
        return {"signal": "neutral", "strength": 0.0, "detail": "ATR not available"}

    atr = float(df["ATR"].iloc[-1])
    close = float(df["Close"].iloc[-1])
    if close <= 0:
        return {"signal": "neutral", "strength": 0.0, "detail": "Invalid price"}

    atr_pct = (atr / close) * 100
    if atr_pct > 5:
        return {"signal": "neutral", "strength": 0.5, "detail": f"High volatility: ATR {atr_pct:.1f}% of price"}
    elif atr_pct > 3:
        return {"signal": "neutral", "strength": 0.3, "detail": f"Moderate volatility: ATR {atr_pct:.1f}%"}
    return {"signal": "neutral", "strength": 0.1, "detail": f"Low volatility: ATR {atr_pct:.1f}%"}


# ---------------------------------------------------------------------------
# Timeframe-Specific Decision Engine
# ---------------------------------------------------------------------------

# Signal weights per timeframe
TIMEFRAME_WEIGHTS = {
    "short_term": {
        "rsi": 0.25,
        "macd": 0.25,
        "bollinger": 0.20,
        "volume": 0.15,
        "trend": 0.10,
        "atr": 0.05,
    },
    "swing": {
        "trend": 0.30,
        "macd": 0.20,
        "rsi": 0.15,
        "bollinger": 0.15,
        "volume": 0.10,
        "atr": 0.10,
    },
    "position": {
        "trend": 0.40,
        "rsi": 0.15,
        "macd": 0.15,
        "bollinger": 0.10,
        "volume": 0.10,
        "atr": 0.10,
    },
}


def compute_timeframe_decision(
    df: pd.DataFrame,
    timeframe: str = "swing",
) -> Dict[str, Any]:
    """
    Compute a trading decision for a specific timeframe.
    Returns signal, confidence, component breakdown, and rationale.
    """
    if timeframe not in TIMEFRAME_WEIGHTS:
        timeframe = "swing"

    weights = TIMEFRAME_WEIGHTS[timeframe]
    info = TIMEFRAMES[timeframe]

    # Compute all signals
    signals = {
        "rsi": _rsi_signal(df),
        "macd": _macd_signal(df),
        "trend": _trend_signal(df),
        "bollinger": _bollinger_signal(df),
        "volume": _volume_signal(df),
        "atr": _atr_signal(df),
    }

    # Weighted score: +1 = strong buy, -1 = strong sell
    score = 0.0
    components = []
    for name, weight in weights.items():
        sig = signals[name]
        signal_val = {"buy": 1.0, "sell": -1.0, "neutral": 0.0}.get(sig["signal"], 0.0)
        contribution = signal_val * sig["strength"] * weight
        score += contribution
        components.append({
            "name": name,
            "signal": sig["signal"],
            "strength": round(sig["strength"], 3),
            "weight": weight,
            "contribution": round(contribution, 4),
            "detail": sig["detail"],
        })

    # Determine overall signal
    if score > 0.15:
        signal = "Buy"
    elif score < -0.15:
        signal = "Sell"
    else:
        signal = "Hold"

    # Confidence: based on how far from neutral
    confidence = min(abs(score) / 0.5, 1.0)

    # Generate rationale
    buy_reasons = [c["detail"] for c in components if c["signal"] == "buy"]
    sell_reasons = [c["detail"] for c in components if c["signal"] == "sell"]

    rationale_parts = []
    if buy_reasons:
        rationale_parts.append(f"Bullish: {'; '.join(buy_reasons[:3])}")
    if sell_reasons:
        rationale_parts.append(f"Bearish: {'; '.join(sell_reasons[:3])}")

    return {
        "timeframe": timeframe,
        "label": info["label"],
        "description": info["description"],
        "signal": signal,
        "score": round(score, 4),
        "confidence": round(confidence, 3),
        "components": components,
        "rationale": " | ".join(rationale_parts) if rationale_parts else "No strong signals detected.",
    }


def compute_all_timeframes(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute decisions for all three timeframes."""
    results = {}
    for tf in TIMEFRAMES:
        results[tf] = compute_timeframe_decision(df, tf)

    # Cross-timeframe consensus
    signals = [results[tf]["signal"] for tf in TIMEFRAMES]
    if signals.count("Buy") >= 2:
        consensus = "Buy"
    elif signals.count("Sell") >= 2:
        consensus = "Sell"
    else:
        consensus = "Hold"

    avg_confidence = sum(results[tf]["confidence"] for tf in TIMEFRAMES) / len(TIMEFRAMES)

    return {
        "timeframes": results,
        "consensus": consensus,
        "avg_confidence": round(avg_confidence, 3),
        "summary": (
            f"Cross-timeframe consensus: {consensus} "
            f"(avg confidence: {avg_confidence:.0%}). "
            + " | ".join(f"{results[tf]['label']}: {results[tf]['signal']}" for tf in TIMEFRAMES)
        ),
    }
