"""
risk.py — Risk assessment engine for StockVantex.

Risk Score Methodology
----------------------
The composite risk score (0–100, higher = riskier) is built from three
independently measured dimensions:

  Dimension               Weight   Formula
  ─────────────────────── ──────   ─────────────────────────────────────────────
  1. Daily Volatility       40%    Annualised daily σ of log-returns (%).
                                   Score mapping: <10% → 0, 40% → 100 (linear).
  2. Trend Stability        30%    Inverted trend-strength score (100 – trend_score).
                                   A strong, consistent trend reduces risk;
                                   a chaotic one increases it.
  3. ATR / Price Ratio      30%    ATR14 as a percentage of current price.
                                   Score mapping: <1% → 0, 5% → 100 (linear).

Risk Level thresholds:
    composite_score < 35  → Low
    35 ≤ score < 65       → Medium
    score ≥ 65            → High

Limitations
-----------
- Historical volatility is not forward-looking and does not capture
  tail events or sudden regime changes.
- The score uses daily closing prices only; intraday moves are not measured.
- At least 50 rows of data are required; fewer returns an "Unknown" result.
- No fundamental, liquidity, or counterparty risk is included.

Trend Strength Score (0–100)
----------------------------
Computed from the most recent bar of the indicators DataFrame:
    +15  price > SMA20
    +15  price > SMA50
    +10  SMA20 > SMA50  (golden-cross alignment)
    +10  MACD > Signal line
    base = 50 (neutral starting point)

Technical Label  thresholds: >60 → Bullish, <40 → Bearish, else Neutral.
"""

import math
import pandas as pd
import numpy as np
from typing import Dict, Any, List

from volatility import calculate_daily_volatility, calculate_atr_value

# ── Weight constants (sum to 1.0) ────────────────────────────────────────────
_WEIGHT_VOLATILITY = 0.40
_WEIGHT_TREND = 0.30
_WEIGHT_ATR = 0.30

# ── Volatility score mapping ──────────────────────────────────────────────────
_VOL_SCORE_MIN_PCT = 10.0   # annualised vol (%) that maps to risk score 0
_VOL_SCORE_MAX_PCT = 40.0   # annualised vol (%) that maps to risk score 100

# ── ATR score mapping ─────────────────────────────────────────────────────────
_ATR_SCORE_MIN_PCT = 1.0    # ATR/price (%) that maps to risk score 0
_ATR_SCORE_MAX_PCT = 5.0    # ATR/price (%) that maps to risk score 100


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _linear_score(value: float, v_min: float, v_max: float) -> float:
    """Map *value* linearly to [0, 100] where v_min→0 and v_max→100."""
    if v_max == v_min:
        return 0.0
    return _clamp((value - v_min) / (v_max - v_min) * 100.0)


def calculate_trend_strength(df: pd.DataFrame) -> float:
    """
    Return a 0–100 Trend Strength Score.

    Requires df to have columns: Close, SMA20, SMA50, MACD, Signal.
    Returns 50.0 (neutral) when data is insufficient or columns are missing.
    """
    required = {"Close", "SMA20", "SMA50", "MACD", "Signal"}
    if len(df) < 50 or not required.issubset(df.columns):
        return 50.0

    latest = df.iloc[-1]

    # Guard against NaN in any component
    vals = {c: latest[c] for c in required}
    if any(not isinstance(v, (int, float)) or math.isnan(float(v)) for v in vals.values()):
        return 50.0

    score = 50.0  # neutral baseline

    # 1. Price vs SMA20 (+/-15)
    score += 15.0 if vals["Close"] > vals["SMA20"] else -15.0

    # 2. Price vs SMA50 (+/-15)
    score += 15.0 if vals["Close"] > vals["SMA50"] else -15.0

    # 3. Golden/Death cross (+/-10)
    score += 10.0 if vals["SMA20"] > vals["SMA50"] else -10.0

    # 4. MACD momentum (+/-10)
    score += 10.0 if vals["MACD"] > vals["Signal"] else -10.0

    return _clamp(score)


def get_technical_label(trend_score: float) -> str:
    """
    Canonical technical label derived from trend-strength score.
    Shared by the Technical Analysis page and the homepage stock cards.

    Thresholds: >60 → Bullish, <40 → Bearish, else Neutral.
    """
    if trend_score > 60:
        return "Bullish"
    if trend_score < 40:
        return "Bearish"
    return "Neutral"


def _calculate_max_drawdown(df: pd.DataFrame) -> float:
    """
    Compute the maximum drawdown over the available Close series.
    Returns a positive percentage (e.g. 15.3 means 15.3% peak-to-trough).
    Returns 0.0 when fewer than 2 rows are present.
    """
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    if len(close) < 2:
        return 0.0
    rolling_max = close.expanding().max()
    drawdown = (close - rolling_max) / rolling_max * 100.0
    return abs(float(drawdown.min()))


def assess_risk(df: pd.DataFrame, ticker: str = "Unknown") -> Dict[str, Any]:
    """
    Evaluate the risk level of an asset.

    Returns
    -------
    dict with keys:
        ticker       : str
        risk_level   : "Low" | "Medium" | "High" | "Unknown"
        risk_score   : float (0–100, higher = riskier)
        factors      : list of factor dicts (name, value, level, impact, description)
        max_drawdown : float (percentage, informational only — not in composite score)
        message      : str
        methodology  : str  (brief description of how the score is built)
    """
    _METHODOLOGY = (
        f"Composite risk score = "
        f"{int(_WEIGHT_VOLATILITY*100)}% daily volatility "
        f"+ {int(_WEIGHT_TREND*100)}% trend stability (inverted) "
        f"+ {int(_WEIGHT_ATR*100)}% ATR/price ratio. "
        f"Lower score = lower measured risk. "
        f"Thresholds: <35 Low, 35–65 Medium, ≥65 High."
    )

    if len(df) < 50:
        return {
            "ticker": ticker,
            "risk_level": "Unknown",
            "risk_score": 50,
            "max_drawdown": None,
            "factors": [{"name": "Data availability", "status": "Insufficient data (need ≥50 rows)"}],
            "message": "Not enough historical data for risk assessment.",
            "methodology": _METHODOLOGY,
        }

    factors: List[Dict[str, Any]] = []
    composite = 0.0

    # ── Dimension 1: Daily Volatility ─────────────────────────────────────────
    volatility = calculate_daily_volatility(df)
    vol_risk = _linear_score(volatility, _VOL_SCORE_MIN_PCT, _VOL_SCORE_MAX_PCT)
    composite += vol_risk * _WEIGHT_VOLATILITY

    vol_level = "High" if volatility > 35 else ("Medium" if volatility > 20 else "Low")
    factors.append({
        "name": "Volatility",
        "value": f"{volatility:.2f}%",
        "level": vol_level,
        "impact": "High",
        "description": (
            f"Annualised daily volatility of {volatility:.2f}% "
            f"(weight {int(_WEIGHT_VOLATILITY*100)}% of score). "
            f"Low: <20%, Medium: 20–35%, High: >35%."
        ),
    })

    # ── Dimension 2: Trend Stability ──────────────────────────────────────────
    trend_strength = calculate_trend_strength(df)
    trend_risk = 100.0 - trend_strength  # inverse: weak trend = higher risk
    composite += trend_risk * _WEIGHT_TREND

    trend_level = "Strong" if trend_strength > 70 else ("Weak" if trend_strength < 30 else "Moderate")
    factors.append({
        "name": "Trend Stability",
        "value": f"{trend_strength:.1f}/100",
        "level": trend_level,
        "impact": "Medium",
        "description": (
            f"Trend-strength score of {trend_strength:.1f}/100 — "
            f"a {trend_level.lower()} directional reading "
            f"(weight {int(_WEIGHT_TREND*100)}% of score, inverted)."
        ),
    })

    # ── Dimension 3: ATR / Price Ratio ────────────────────────────────────────
    atr = calculate_atr_value(df)
    current_price = float(df["Close"].iloc[-1])
    rel_atr = (atr / current_price * 100.0) if current_price > 0 else 0.0
    atr_risk = _linear_score(rel_atr, _ATR_SCORE_MIN_PCT, _ATR_SCORE_MAX_PCT)
    composite += atr_risk * _WEIGHT_ATR

    atr_level = "High" if rel_atr > 4.5 else ("Medium" if rel_atr > 2.5 else "Low")
    factors.append({
        "name": "Typical Range (ATR14)",
        "value": f"{rel_atr:.2f}% of price",
        "level": atr_level,
        "impact": "Medium",
        "description": (
            f"14-day Average True Range is {rel_atr:.2f}% of price "
            f"(weight {int(_WEIGHT_ATR*100)}% of score). "
            f"Low: <2.5%, Medium: 2.5–4.5%, High: >4.5%."
        ),
    })

    # ── Max Drawdown (informational — not in composite) ───────────────────────
    try:
        max_dd = _calculate_max_drawdown(df)
    except Exception:
        max_dd = None

    # ── Overall Level ──────────────────────────────────────────────────────────
    composite = _clamp(composite)
    if composite >= 65:
        risk_level = "High"
    elif composite >= 35:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "ticker": ticker,
        "risk_level": risk_level,
        "risk_score": round(composite, 2),
        "max_drawdown": round(max_dd, 2) if max_dd is not None else None,
        "factors": factors,
        "message": (
            f"{ticker} exhibits {risk_level.lower()} risk based on "
            f"historical price behaviour ({volatility:.1f}% annualised volatility, "
            f"{trend_level.lower()} trend stability, {atr_level.lower()} daily range). "
            f"Historical metrics do not guarantee future risk levels."
        ),
        "methodology": _METHODOLOGY,
    }
