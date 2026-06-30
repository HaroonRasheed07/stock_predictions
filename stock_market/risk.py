# risk.py — Risk assessment engine
"""
Provides a comprehensive risk assessment combining volatility,
trend stability, Average True Range (ATR), and forecast variability.
"""

import pandas as pd
from typing import Dict, Any, List

from volatility import calculate_daily_volatility, calculate_atr_value


def calculate_trend_strength(df: pd.DataFrame) -> float:
    """
    Calculate a 0-100 Trend Strength Score based on moving averages and MACD.
    Assumes df has 'SMA20', 'SMA50', 'MACD', and 'Signal' columns from indicators.py.
    """
    if len(df) < 50:
        return 50.0  # Default neutral score if not enough data

    latest = df.iloc[-1]
    
    # Required columns
    if not all(col in df.columns for col in ['Close', 'SMA20', 'SMA50', 'MACD', 'Signal']):
        return 50.0

    score = 50.0  # Start neutral

    # 1. Price vs SMA20 (+/- 15)
    if latest['Close'] > latest['SMA20']:
        score += 15
    else:
        score -= 15

    # 2. Price vs SMA50 (+/- 15)
    if latest['Close'] > latest['SMA50']:
        score += 15
    else:
        score -= 15

    # 3. SMA Crossover (+/- 10)
    if latest['SMA20'] > latest['SMA50']:
        score += 10
    else:
        score -= 10

    # 4. MACD vs Signal (+/- 10)
    if latest['MACD'] > latest['Signal']:
        score += 10
    else:
        score -= 10

    # Ensure score is within 0-100
    return max(0.0, min(100.0, score))


def assess_risk(df: pd.DataFrame, ticker: str = "Unknown") -> Dict[str, Any]:
    """
    Evaluate the risk level of an asset.
    Returns risk level (Low/Medium/High), score (0-100), and breakdown factors.
    Lower score = Lower risk.
    """
    if len(df) < 50:
        return {
            "ticker": ticker,
            "risk_level": "Unknown",
            "risk_score": 50,
            "factors": [{"name": "Data availability", "status": "Insufficient data"}],
            "message": "Not enough historical data for risk assessment."
        }

    factors = []
    risk_score = 0.0
    max_risk_score = 100.0

    # 1. Volatility Risk (Weight: 40%)
    # Lower is better. <15% is low risk, >40% is high risk.
    volatility = calculate_daily_volatility(df)
    vol_risk_score = min(100, max(0, (volatility - 10) / 30 * 100))
    risk_score += vol_risk_score * 0.40
    
    vol_level = "High" if volatility > 35 else "Medium" if volatility > 20 else "Low"
    factors.append({
        "name": "Volatility",
        "value": f"{volatility:.2f}%",
        "level": vol_level,
        "impact": "High",
        "description": f"{vol_level} daily price fluctuations."
    })

    # 2. Trend Stability Risk (Weight: 30%)
    # Higher trend strength = Lower risk
    trend_strength = calculate_trend_strength(df)
    trend_risk_score = 100 - trend_strength  # Inverse
    risk_score += trend_risk_score * 0.30
    
    trend_level = "Strong" if trend_strength > 70 else "Weak" if trend_strength < 30 else "Moderate"
    factors.append({
        "name": "Trend Stability",
        "value": f"{trend_strength:.1f}/100",
        "level": trend_level,
        "impact": "Medium",
        "description": f"{trend_level} directional momentum."
    })

    # 3. ATR Risk / Downside (Weight: 30%)
    # ATR relative to price. Lower is better.
    atr = calculate_atr_value(df)
    current_price = df["Close"].iloc[-1]
    rel_atr = (atr / current_price * 100) if current_price > 0 else 0
    
    # < 2% is low risk, > 5% is high risk
    atr_risk_score = min(100, max(0, (rel_atr - 1) / 4 * 100))
    risk_score += atr_risk_score * 0.30
    
    atr_level = "High" if rel_atr > 4.5 else "Medium" if rel_atr > 2.5 else "Low"
    factors.append({
        "name": "Typical Range (ATR)",
        "value": f"{rel_atr:.2f}% of price",
        "level": atr_level,
        "impact": "Medium",
        "description": f"Expected {atr_level.lower()} daily swing size."
    })

    # Determine overall risk level
    if risk_score > 65:
        risk_level = "High"
    elif risk_score > 35:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "ticker": ticker,
        "risk_level": risk_level,
        "risk_score": round(risk_score, 2),
        "factors": factors,
        "message": f"Asset exhibits {risk_level.lower()} risk characteristics based on historical volatility and trend stability."
    }
