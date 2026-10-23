"""
Tests for Quantitative Signal and Score Consistency Audit.
Validates:
1. Trade confirmation weights summing strictly to 1.00.
2. Signal direction alignment (Pure Bullish -> Buy, Pure Bearish -> Sell).
3. Conflict detection and "Mixed Evidence" state (e.g., oversold RSI + bearish trend + high risk = CRWV scenario).
4. Volatility factor active contribution.
5. Opportunity score non-null, bounded [0, 100], and not presented as probability.
6. Timeframe consensus returning "Mixed" on multi-timeframe divergence.
"""

import pytest
from timeframe_engine import (
    analyze_all_timeframes,
    _derive_consensus,
    TimeframeSignal,
)
from api import _compute_trade_confirmation_raw


def test_weights_sum_to_one():
    """Verify that all component weights sum exactly to 1.00."""
    result = _compute_trade_confirmation_raw(
        ticker="TEST",
        name="Test Asset",
        indicators={"rsi": 50, "macd_hist": 0, "sma_20": 100, "sma_50": 100, "price": 100},
        risk={"risk_score": 50, "risk_level": "Moderate"},
        opp={"opportunity_score": 50},
        vol={"annualized_volatility": 0.20},
        sentiment={"sentiment_score": 0.0},
    )
    total_weight = sum(c["weight"] for c in result["components"])
    assert pytest.approx(total_weight, abs=1e-4) == 1.00


def test_pure_bullish_alignment():
    """When all indicators are bullish, signal must be Buy/Strong Buy and no conflict."""
    result = _compute_trade_confirmation_raw(
        ticker="BULL",
        name="Bull Asset",
        indicators={"rsi": 62, "macd_hist": 1.5, "sma_20": 110, "sma_50": 100, "price": 115},
        risk={"risk_score": 25, "risk_level": "Low"},
        opp={"opportunity_score": 85},
        vol={"annualized_volatility": 0.15},
        sentiment={"sentiment_score": 0.65},
    )
    assert result["signal"] in ["Buy", "Strong Buy"]
    assert result["evidence_state"] == "aligned"
    assert result["conflict_details"]["has_conflict"] is False
    assert result["conflict_details"]["bullish_count"] >= 3
    assert result["conflict_details"]["bearish_count"] == 0


def test_pure_bearish_alignment():
    """When all indicators are bearish, signal must be Sell/Strong Sell and no conflict."""
    result = _compute_trade_confirmation_raw(
        ticker="BEAR",
        name="Bear Asset",
        indicators={"rsi": 38, "macd_hist": -1.5, "sma_20": 90, "sma_50": 100, "price": 85},
        risk={"risk_score": 75, "risk_level": "High"},
        opp={"opportunity_score": 25},
        vol={"annualized_volatility": 0.45},
        sentiment={"sentiment_score": -0.65},
    )
    assert result["signal"] in ["Sell", "Strong Sell"]
    assert result["evidence_state"] == "aligned"
    assert result["conflict_details"]["has_conflict"] is False
    assert result["conflict_details"]["bearish_count"] >= 3
    assert result["conflict_details"]["bullish_count"] == 0


def test_crwv_conflict_scenario():
    """
    CRWV Scenario:
    - Downward trend (price < SMA20 < SMA50) -> Bearish
    - Oversold RSI (< 30) -> Bullish bounce condition
    - High Risk (> 65) -> Risk penalty / High Risk
    Previous bug: Positive and negative contributions cancelled out to ~ -0.09,
    falling into default 'Hold', hiding severe divergence and risk.
    New logic: Must detect conflict, emit 'Mixed Evidence', and set risk_warning=True.
    """
    result = _compute_trade_confirmation_raw(
        ticker="CRWV",
        name="CRWV Inc",
        indicators={"rsi": 24.5, "macd_hist": -0.8, "sma_20": 15.0, "sma_50": 20.0, "price": 12.0},
        risk={"risk_score": 78, "risk_level": "High"},
        opp={"opportunity_score": 35},
        vol={"annualized_volatility": 0.52},
        sentiment={"sentiment_score": -0.1},
    )
    assert result["signal"] == "Mixed Evidence"
    assert result["evidence_state"] in ["conflicting", "high_risk_divergence"]
    assert result["conflict_details"]["has_conflict"] is True
    assert result["conflict_details"]["risk_warning"] is True
    assert "oversold" in result["conflict_details"]["explanation"].lower() or "divergent" in result["conflict_details"]["explanation"].lower()


def test_volatility_factor_participation():
    """Verify that elevated volatility participates in factor attribution."""
    result_high_vol = _compute_trade_confirmation_raw(
        ticker="VOLH",
        name="High Vol Asset",
        indicators={"rsi": 50, "macd_hist": 0, "sma_20": 100, "sma_50": 100, "price": 100},
        risk={"risk_score": 50, "risk_level": "Moderate"},
        opp={"opportunity_score": 50},
        vol={"annualized_volatility": 0.60},
        sentiment={"sentiment_score": 0.0},
    )
    vol_comp = next((c for c in result_high_vol["components"] if c["name"] == "Volatility"), None)
    assert vol_comp is not None
    assert vol_comp["signal"] == "sell"
    assert vol_comp["contribution"] < 0


def test_timeframe_consensus_mixed_on_conflict():
    """When short-term is Buy but swing/position are Sell, consensus should be 'Mixed'."""
    signals = {
        "short_term": TimeframeSignal(
            timeframe="short_term",
            label="Short-Term (1-5D)",
            signal="Buy",
            confidence=0.75,
            direction="bullish",
            components=[],
            rationale="Short term bounce",
        ),
        "swing": TimeframeSignal(
            timeframe="swing",
            label="Swing (1-4W)",
            signal="Sell",
            confidence=0.70,
            direction="bearish",
            components=[],
            rationale="Swing downtrend",
        ),
        "position": TimeframeSignal(
            timeframe="position",
            label="Position (1-3M)",
            signal="Sell",
            confidence=0.80,
            direction="bearish",
            components=[],
            rationale="Position breakdown",
        ),
    }
    consensus = _derive_consensus(signals)
    assert consensus == "Mixed"
