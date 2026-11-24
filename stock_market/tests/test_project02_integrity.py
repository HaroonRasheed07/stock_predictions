import math

import numpy as np
import pandas as pd
import pytest
from types import SimpleNamespace

from forecast_onnx import forecast_stock
from risk import calculate_trend_strength
from volatility import calculate_relative_volume, get_volatility_summary


def _frame(close_values, volume_values=None):
    index = pd.date_range("2026-01-01", periods=len(close_values), freq="B")
    volumes = volume_values if volume_values is not None else [1_000_000] * len(close_values)
    return pd.DataFrame(
        {
            "Open": close_values,
            "High": [c + 1 for c in close_values],
            "Low": [c - 1 for c in close_values],
            "Close": close_values,
            "Volume": volumes,
        },
        index=index,
    )


def test_volatility_cache_is_scoped_to_snapshot_not_only_identity():
    first = get_volatility_summary(_frame([100.0] * 40), True, "", "project02")
    second = get_volatility_summary(_frame([200.0] * 40), True, "", "project02")

    assert first["expected_range"]["current_price"] == 100.0
    assert second["expected_range"]["current_price"] == 200.0


def test_relative_volume_uses_two_decimal_rounding():
    result = calculate_relative_volume(_frame([10.0] * 31, [100] * 30 + [300]))

    assert math.isfinite(result["relative_volume"])
    assert result["relative_volume"] == 3.0


def test_trend_strength_rejects_infinite_components():
    df = pd.DataFrame(
        {
            "Close": [10.0] * 50,
            "SMA20": [10.0] * 50,
            "SMA50": [10.0] * 50,
            "MACD": [0.0] * 50,
            "Signal": [0.0] * 50,
        }
    )
    df.loc[df.index[-1], "MACD"] = float("inf")

    assert calculate_trend_strength(df) == 50.0


class _IdentityScaler:
    def transform(self, values):
        return np.asarray(values, dtype=np.float32)

    def inverse_transform(self, values):
        return np.asarray(values, dtype=np.float32)


class _NonFiniteSession:
    def get_inputs(self):
        return [SimpleNamespace(name="input")]

    def run(self, _output_names, _feed):
        return [np.array([[np.nan]], dtype=np.float32)]


class _NegativeForwardSession:
    def __init__(self):
        self.calls = 0

    def get_inputs(self):
        return [SimpleNamespace(name="input")]

    def run(self, _output_names, feed):
        self.calls += 1
        rows = feed["input"].shape[0]
        if rows > 1:
            return [np.full((rows, 1), 0.5, dtype=np.float32)]
        return [np.array([[-1.0]], dtype=np.float32)]


def test_forecast_rejects_non_finite_model_output():
    df = pd.DataFrame({"Close": [100.0] * 61}, index=pd.date_range("2026-01-01", periods=61, freq="B"))

    with pytest.raises(ValueError, match="non-finite historical"):
        forecast_stock(df, _NonFiniteSession(), _IdentityScaler(), forecast_days=1, window_size=60)


def test_forecast_rejects_non_positive_prices():
    df = pd.DataFrame({"Close": [100.0] * 61}, index=pd.date_range("2026-01-01", periods=61, freq="B"))

    with pytest.raises(ValueError, match="non-positive"):
        forecast_stock(df, _NegativeForwardSession(), _IdentityScaler(), forecast_days=1, window_size=60)


def test_signal_evidence_ignores_zero_price_rows():
    from signal_history import compute_signal_evidence

    df = pd.DataFrame(
        {
            "Close": [0.0] * 30,
            "RSI": [20.0] * 30,
            "MACD": [1.0] * 30,
            "Signal": [0.0] * 30,
            "SMA20": [2.0] * 30,
            "SMA50": [1.0] * 30,
            "UpperBand": [3.0] * 30,
            "LowerBand": [1.0] * 30,
        }
    )

    evidence = compute_signal_evidence(df)

    assert evidence["overall_accuracy"] == 0.0
    assert all(math.isfinite(v) for v in [evidence["overall_accuracy"]])
    assert all(indicator["sample_size"] == 0 for indicator in evidence["indicators"].values())


def test_trade_confirmation_handles_empty_indicator_frame(monkeypatch):
    from stock_market import api as api_module

    monkeypatch.setattr(api_module, "load_data", lambda ticker, period: _frame([10.0] * 5))
    monkeypatch.setattr(api_module, "calculate_indicators", lambda df: [])

    result = api_module._compute_trade_confirmation_raw("TEST", "1y")

    assert result["error"] == "Insufficient data for confirmation"


def test_monte_carlo_paths_are_positive():
    from montecarlo import simulate_price_paths

    paths = simulate_price_paths(
        np.array([0.01, -0.02, 0.005, np.nan]), 100.0, days=10, simulations=50, seed=7
    )

    assert paths.shape == (10, 50)
    assert np.all(paths[0] == 100.0)
    assert np.all(paths > 0)
