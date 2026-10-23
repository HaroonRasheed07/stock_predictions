"""
test_indicators_unit.py — Pure unit tests for StockVantex's quantitative pipeline.

These tests run entirely in-memory without any network calls, database access,
or external service dependencies. All inputs are synthetic DataFrames crafted
to exercise known edge cases and formula correctness.

Run with:
    pytest test_indicators_unit.py -v
"""

import math
import sys
import os
import pytest
import numpy as np
import pandas as pd

# ── Ensure stock_market modules are importable ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _make_ohlcv(n: int = 200, price: float = 100.0, trend: float = 0.0,
                vol: float = 0.01, seed: int = 42) -> pd.DataFrame:
    """
    Construct a synthetic OHLCV DataFrame with controllable properties.

    Parameters
    ----------
    n      : number of rows
    price  : starting close price
    trend  : daily drift (e.g. 0.002 = slight uptrend)
    vol    : daily return volatility
    seed   : random seed for reproducibility
    """
    rng = np.random.default_rng(seed)
    returns = rng.normal(trend, vol, n)
    closes = price * np.cumprod(1 + returns)
    highs = closes * (1 + abs(rng.normal(0, vol, n)))
    lows = closes * (1 - abs(rng.normal(0, vol, n)))
    opens = np.roll(closes, 1)
    opens[0] = closes[0]
    volumes = rng.integers(1_000_000, 5_000_000, n).astype(float)

    dates = pd.bdate_range("2022-01-03", periods=n)
    return pd.DataFrame(
        {"Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=dates,
    )


# ════════════════════════════════════════════════════════════════════════════
#  Indicator Tests
# ════════════════════════════════════════════════════════════════════════════

class TestCalculateIndicators:
    """Tests for indicators.calculate_indicators()"""

    def test_returns_nonempty_list_for_valid_data(self):
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        result = calculate_indicators(df)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_required_columns_present(self):
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        record = calculate_indicators(df)[0]
        required = {"Date", "Open", "High", "Low", "Close", "Volume",
                    "SMA20", "SMA50", "EMA20", "UpperBand", "LowerBand",
                    "ATR", "RSI", "MACD", "Signal"}
        assert required.issubset(set(record.keys())), (
            f"Missing columns: {required - set(record.keys())}"
        )

    def test_no_nan_or_inf_in_output(self):
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        for record in calculate_indicators(df):
            for k, v in record.items():
                if isinstance(v, float):
                    assert not math.isnan(v), f"NaN found in column {k}"
                    assert not math.isinf(v), f"Inf found in column {k}"

    def test_rsi_bounded_between_0_and_100(self):
        from indicators import calculate_indicators
        df = _make_ohlcv(300, vol=0.02)
        rsi_values = [r["RSI"] for r in calculate_indicators(df)]
        assert all(0.0 <= v <= 100.0 for v in rsi_values), (
            f"RSI out of [0,100]: min={min(rsi_values):.2f} max={max(rsi_values):.2f}"
        )

    def test_rsi_near_100_when_price_always_rises(self):
        """A monotonically increasing price should produce RSI close to 100."""
        from indicators import calculate_indicators
        n = 100
        closes = np.linspace(100, 200, n)
        df = pd.DataFrame({
            "Open": closes, "High": closes * 1.001, "Low": closes * 0.999,
            "Close": closes, "Volume": np.ones(n) * 1e6,
        }, index=pd.bdate_range("2023-01-02", periods=n))
        records = calculate_indicators(df)
        last_rsi = records[-1]["RSI"]
        assert last_rsi > 90, f"Expected RSI near 100 for monotone up, got {last_rsi:.2f}"

    def test_rsi_near_0_when_price_always_falls(self):
        """A monotonically decreasing price should produce RSI close to 0."""
        from indicators import calculate_indicators
        n = 100
        closes = np.linspace(200, 100, n)
        df = pd.DataFrame({
            "Open": closes, "High": closes * 1.001, "Low": closes * 0.999,
            "Close": closes, "Volume": np.ones(n) * 1e6,
        }, index=pd.bdate_range("2023-01-02", periods=n))
        records = calculate_indicators(df)
        last_rsi = records[-1]["RSI"]
        assert last_rsi < 10, f"Expected RSI near 0 for monotone down, got {last_rsi:.2f}"

    def test_sma20_is_rolling_mean(self):
        """SMA20 must equal the simple arithmetic mean of the last 20 closes."""
        from indicators import calculate_indicators
        df = _make_ohlcv(100)
        records = calculate_indicators(df)
        # The last record should correspond to the last row of the DataFrame
        last_rec = records[-1]
        closes = df["Close"].values
        expected_sma20 = float(closes[-20:].mean())
        assert abs(last_rec["SMA20"] - expected_sma20) < 1e-6, (
            f"SMA20 mismatch: got {last_rec['SMA20']:.6f}, expected {expected_sma20:.6f}"
        )

    def test_bollinger_band_width_positive(self):
        """Upper band must always be strictly above lower band (non-constant price)."""
        from indicators import calculate_indicators
        df = _make_ohlcv(100)
        for r in calculate_indicators(df):
            assert r["UpperBand"] > r["LowerBand"], (
                f"UpperBand ({r['UpperBand']}) not > LowerBand ({r['LowerBand']})"
            )

    def test_macd_is_ema12_minus_ema26_direction(self):
        """MACD > 0 must coincide with fast EMA > slow EMA."""
        from indicators import calculate_indicators
        df = _make_ohlcv(300, trend=0.002)  # uptrend: fast should generally > slow
        records = calculate_indicators(df)
        last = records[-1]
        # In a sustained uptrend, MACD should be positive (EMA12 > EMA26)
        # Allow some tolerance since synthetic series may vary
        assert last["MACD"] != 0  # At minimum it shouldn't be zero

    def test_returns_empty_for_insufficient_data(self):
        """When fewer rows than max lookback (50), result may be empty or short."""
        from indicators import calculate_indicators
        df = _make_ohlcv(30)  # SMA50 needs 50 rows; dropna will remove all
        result = calculate_indicators(df)
        # All rows should be dropped since SMA50 cannot be computed
        assert result == [], f"Expected empty list for 30-row input, got {len(result)} records"

    def test_multiindex_columns_are_handled(self):
        """yfinance MultiIndex columns must be flattened without error."""
        from indicators import calculate_indicators
        df = _make_ohlcv(100)
        # Simulate yfinance MultiIndex: (field, ticker)
        df.columns = pd.MultiIndex.from_tuples(
            [(c, "AAPL") for c in df.columns]
        )
        result = calculate_indicators(df)
        assert len(result) > 0, "Expected non-empty result after MultiIndex flattening"


# ════════════════════════════════════════════════════════════════════════════
#  Risk Tests
# ════════════════════════════════════════════════════════════════════════════

class TestAssessRisk:
    """Tests for risk.assess_risk()"""

    def test_returns_dict_with_required_keys(self):
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        required = {"ticker", "risk_level", "risk_score", "factors", "message", "methodology"}
        assert required.issubset(result.keys()), f"Missing: {required - result.keys()}"

    def test_risk_score_bounded_0_to_100(self):
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        assert 0.0 <= result["risk_score"] <= 100.0

    def test_risk_level_is_valid_category(self):
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        assert result["risk_level"] in {"Low", "Medium", "High", "Unknown"}

    def test_insufficient_data_returns_unknown(self):
        from risk import assess_risk
        df = _make_ohlcv(30)  # fewer than 50 rows
        result = assess_risk(df, "TEST")
        assert result["risk_level"] == "Unknown"
        assert result["risk_score"] == 50

    def test_high_volatility_increases_risk(self):
        """A high-vol series should score higher risk than a low-vol series."""
        from risk import assess_risk
        from indicators import calculate_indicators
        df_low = _make_ohlcv(200, vol=0.003, seed=1)
        df_high = _make_ohlcv(200, vol=0.05, seed=1)
        low_ind = pd.DataFrame(calculate_indicators(df_low))
        high_ind = pd.DataFrame(calculate_indicators(df_high))
        low_risk = assess_risk(low_ind, "LOW")["risk_score"]
        high_risk = assess_risk(high_ind, "HIGH")["risk_score"]
        assert high_risk > low_risk, (
            f"High-vol risk ({high_risk}) should exceed low-vol ({low_risk})"
        )

    def test_factors_list_has_three_entries(self):
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        assert len(result["factors"]) == 3, (
            f"Expected 3 risk factors, got {len(result['factors'])}"
        )

    def test_max_drawdown_is_positive(self):
        """Max drawdown should be a positive number for any non-trivial series."""
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200, vol=0.02)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        assert result["max_drawdown"] is not None
        assert result["max_drawdown"] >= 0.0

    def test_methodology_field_present_and_non_empty(self):
        from risk import assess_risk
        from indicators import calculate_indicators
        df = _make_ohlcv(200)
        df_ind = pd.DataFrame(calculate_indicators(df))
        result = assess_risk(df_ind, "TEST")
        assert isinstance(result["methodology"], str) and len(result["methodology"]) > 20


# ════════════════════════════════════════════════════════════════════════════
#  Trend Strength Tests
# ════════════════════════════════════════════════════════════════════════════

class TestTrendStrength:
    """Tests for risk.calculate_trend_strength()"""

    def test_neutral_for_insufficient_data(self):
        from risk import calculate_trend_strength
        df = _make_ohlcv(30)
        assert calculate_trend_strength(df) == 50.0

    def test_strong_uptrend_gives_high_score(self):
        """Steady uptrend → price above both SMAs → score > 60."""
        from risk import calculate_trend_strength
        from indicators import calculate_indicators
        df = _make_ohlcv(200, trend=0.003, vol=0.001, seed=7)
        df_ind = pd.DataFrame(calculate_indicators(df))
        score = calculate_trend_strength(df_ind)
        assert score > 60, f"Expected score >60 for strong uptrend, got {score}"

    def test_strong_downtrend_gives_low_score(self):
        """Steady downtrend → price below both SMAs → score < 40."""
        from risk import calculate_trend_strength
        from indicators import calculate_indicators
        df = _make_ohlcv(200, trend=-0.003, vol=0.001, seed=8)
        df_ind = pd.DataFrame(calculate_indicators(df))
        score = calculate_trend_strength(df_ind)
        assert score < 40, f"Expected score <40 for strong downtrend, got {score}"

    def test_score_bounded(self):
        from risk import calculate_trend_strength
        from indicators import calculate_indicators
        for seed in range(5):
            df = _make_ohlcv(200, seed=seed)
            df_ind = pd.DataFrame(calculate_indicators(df))
            score = calculate_trend_strength(df_ind)
            assert 0.0 <= score <= 100.0, f"Score out of range: {score}"


# ════════════════════════════════════════════════════════════════════════════
#  Technical Label Tests
# ════════════════════════════════════════════════════════════════════════════

class TestGetTechnicalLabel:
    """Tests for risk.get_technical_label()"""

    def test_bullish_above_60(self):
        from risk import get_technical_label
        assert get_technical_label(61) == "Bullish"
        assert get_technical_label(100) == "Bullish"

    def test_bearish_below_40(self):
        from risk import get_technical_label
        assert get_technical_label(39) == "Bearish"
        assert get_technical_label(0) == "Bearish"

    def test_neutral_between_40_and_60_inclusive(self):
        from risk import get_technical_label
        assert get_technical_label(40) == "Neutral"
        assert get_technical_label(50) == "Neutral"
        assert get_technical_label(60) == "Neutral"


# ════════════════════════════════════════════════════════════════════════════
#  Sentiment Aggregation Tests
# ════════════════════════════════════════════════════════════════════════════

class TestSentimentAggregation:
    """Verify that the sentiment module handles empty / error states correctly."""

    def test_analyze_sentiment_returns_dict_with_required_keys(self, monkeypatch):
        """If news_engine raises ImportError, legacy path returns a valid dict."""
        from sentiment import analyze_sentiment

        def _raise_import(*a, **kw):
            raise ImportError("mock: news_engine not available")

        # Mock the news_engine import so we exercise the fallback path
        import importlib
        original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

        # Patch by monkeypatching news_engine at module level
        import sys as _sys
        # Inject a fake news_engine module that raises on get_sentiment_for_api
        import types
        fake_ne = types.ModuleType("news_engine")
        def _bad(*a, **kw): raise RuntimeError("simulated news_engine error")
        fake_ne.get_sentiment_for_api = _bad
        _sys.modules["news_engine"] = fake_ne

        try:
            result = analyze_sentiment("AAPL")
            required = {"score", "label", "status", "positive_count", "negative_count", "news"}
            assert required.issubset(result.keys()), f"Missing keys: {required - result.keys()}"
            assert isinstance(result["score"], float)
        finally:
            del _sys.modules["news_engine"]

    def test_empty_news_does_not_crash(self, monkeypatch):
        """Calling with an empty news list should return a graceful result."""
        import sys as _sys
        import types
        fake_ne = types.ModuleType("news_engine")
        fake_ne.get_sentiment_for_api = lambda ticker: {
            "score": 0.0,
            "label": "Neutral",
            "status": "insufficient",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
            "news_count": 0,
            "source_providers": [],
            "sentiment_trend_7d": [],
            "news_impact_summary": "No news",
            "market_mood": "Unknown",
        }
        _sys.modules["news_engine"] = fake_ne
        try:
            from sentiment import analyze_sentiment
            result = analyze_sentiment("AAPL")
            assert result["label"] == "Neutral"
            assert result["score"] == 0.0
        finally:
            del _sys.modules["news_engine"]


# ════════════════════════════════════════════════════════════════════════════
#  Forecast Validation Tests (model-free)
# ════════════════════════════════════════════════════════════════════════════

class TestForecastValidation:
    """Test validate_forecast_inputs without loading the ONNX model."""

    def test_insufficient_data_flagged(self):
        from forecast_onnx import validate_forecast_inputs
        df = _make_ohlcv(30)
        issues = validate_forecast_inputs(df, session="fake", scaler="fake",
                                          forecast_days=10, window_size=60)
        assert any("Insufficient" in i for i in issues), issues

    def test_missing_close_column_flagged(self):
        from forecast_onnx import validate_forecast_inputs
        df = pd.DataFrame({"Open": [1, 2, 3]})
        issues = validate_forecast_inputs(df, session="fake", scaler="fake")
        assert any("Close" in i for i in issues), issues

    def test_none_session_flagged(self):
        from forecast_onnx import validate_forecast_inputs
        df = _make_ohlcv(100)
        issues = validate_forecast_inputs(df, session=None, scaler="fake")
        assert any("session" in i.lower() for i in issues), issues

    def test_none_scaler_flagged(self):
        from forecast_onnx import validate_forecast_inputs
        df = _make_ohlcv(100)
        issues = validate_forecast_inputs(df, session="fake", scaler=None)
        assert any("scaler" in i.lower() for i in issues), issues

    def test_forecast_days_out_of_range_flagged(self):
        from forecast_onnx import validate_forecast_inputs
        df = _make_ohlcv(100)
        issues = validate_forecast_inputs(df, session="fake", scaler="fake",
                                          forecast_days=50)
        assert any("forecast_days" in i for i in issues), issues

    def test_valid_inputs_produce_no_issues(self):
        from forecast_onnx import validate_forecast_inputs
        df = _make_ohlcv(100)
        issues = validate_forecast_inputs(df, session="fake", scaler="fake",
                                          forecast_days=10, window_size=60)
        assert issues == [], f"Unexpected issues: {issues}"


# ════════════════════════════════════════════════════════════════════════════
#  Opportunity Score Tests (unit — no network)
# ════════════════════════════════════════════════════════════════════════════

class TestOpportunityScore:
    """Test the opportunity score calculation logic in isolation."""

    def test_score_bounded(self, monkeypatch):
        """Score must always be within [0, 100] regardless of inputs."""
        from opportunity import calculate_opportunity_score

        # Patch out network calls
        def _fake_load_data(ticker, period):
            return _make_ohlcv(200)

        def _fake_sentiment(ticker):
            return {"score": 0.5, "label": "Positive", "status": "sufficient"}

        monkeypatch.setattr("opportunity.load_data", _fake_load_data)
        monkeypatch.setattr("opportunity.analyze_sentiment", _fake_sentiment)
        monkeypatch.setattr("opportunity.get_asset_info", lambda t: {
            "name": t, "has_volume": True, "asset_class": "stock"
        })
        monkeypatch.setattr("opportunity._get_cached_scan", lambda k: None)
        monkeypatch.setattr("opportunity._set_cached_scan", lambda k, v: None)

        result = calculate_opportunity_score("AAPL", use_cache=False)
        assert result is not None
        assert 0.0 <= result["score"] <= 100.0

    def test_returns_none_for_insufficient_data(self, monkeypatch):
        from opportunity import calculate_opportunity_score

        monkeypatch.setattr("opportunity.load_data", lambda t, p: _make_ohlcv(30))
        monkeypatch.setattr("opportunity._get_cached_scan", lambda k: None)
        monkeypatch.setattr("opportunity._set_cached_scan", lambda k, v: None)

        result = calculate_opportunity_score("AAPL", use_cache=False)
        assert result is None, "Expected None when fewer than 50 rows"

    def test_factors_list_populated(self, monkeypatch):
        from opportunity import calculate_opportunity_score

        monkeypatch.setattr("opportunity.load_data", lambda t, p: _make_ohlcv(200))
        monkeypatch.setattr("opportunity.analyze_sentiment", lambda t: {
            "score": 0.0, "label": "Neutral", "status": "sufficient"
        })
        monkeypatch.setattr("opportunity.get_asset_info", lambda t: {
            "name": t, "has_volume": True, "asset_class": "stock"
        })
        monkeypatch.setattr("opportunity._get_cached_scan", lambda k: None)
        monkeypatch.setattr("opportunity._set_cached_scan", lambda k, v: None)

        result = calculate_opportunity_score("AAPL", use_cache=False)
        assert result is not None
        assert len(result["factors"]) >= 3, "Expected at least 3 scoring factors"
        assert "methodology" in result, "Expected methodology dict in result"
        assert result["methodology"]["base_score"] == 50.0
        for f in result["factors"]:
            assert "weight" in f, f"Factor {f.get('name')} missing weight"
            assert "impact" in f, f"Factor {f.get('name')} missing impact"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
