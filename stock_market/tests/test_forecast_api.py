"""Tests for POST /api/forecast/onnx — response schema, actual_dates alignment,
business-day forecast horizon, error handling, and period passthrough."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from stock_market import api as api_module

client = TestClient(api_module.app)


@pytest.fixture
def business_index():
    # 120 weekday rows — enough to clear the 61-row minimum after the
    # 60-step lookback window.
    return pd.bdate_range(end="2026-10-16", periods=120)


@pytest.fixture
def forecast_env(monkeypatch, business_index):
    """Stub the model, data loader, and cache around the endpoint."""
    closes = np.linspace(100.0, 150.0, len(business_index))
    df = pd.DataFrame({"Close": closes}, index=business_index)

    n_hist = len(df) - 60
    actual = df["Close"].values[-n_hist:]
    predicted = actual * 0.99
    forecast = np.array([actual[-1] + i for i in range(1, 11)])
    forecast_dates = pd.bdate_range(start=business_index[-1] + pd.Timedelta(days=1), periods=10)

    def fake_forecast_stock(_df, _model, _scaler, forecast_days=10):
        assert forecast_days == 10
        return actual, predicted, forecast, forecast_dates

    monkeypatch.setattr(api_module, "MODEL", object(), raising=False)
    monkeypatch.setattr(api_module, "SCALERS", {}, raising=False)
    monkeypatch.setattr(api_module, "load_data", lambda ticker, period="1y", **kw: df)
    monkeypatch.setattr(api_module, "forecast_stock", fake_forecast_stock)
    monkeypatch.setattr(api_module, "get_cached_forecast", lambda key: None)
    monkeypatch.setattr(api_module, "set_cached_forecast", lambda key, value: None)
    return df


def test_forecast_success_schema(forecast_env):
    res = client.post("/api/forecast/onnx", json={"ticker": "TEST", "forecast_days": 10, "period": "1y"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["ticker"] == "TEST"
    assert body["forecast_days"] == 10
    results = body["results"]
    assert set(results) >= {
        "actual_prices",
        "predicted_historical_prices",
        "forecast_prices",
        "forecast_dates",
        "actual_dates",
    }
    assert len(results["actual_prices"]) == 60
    assert len(results["forecast_prices"]) == 10
    assert len(results["forecast_dates"]) == 10


def test_actual_dates_align_with_prices_and_use_trading_days(forecast_env):
    body = client.post("/api/forecast/onnx", json={"ticker": "TEST", "forecast_days": 10, "period": "1y"}).json()
    results = body["results"]
    assert len(results["actual_dates"]) == len(results["actual_prices"])
    # No weekends among historical dates.
    parsed = pd.to_datetime(results["actual_dates"])
    assert all(ts.weekday() < 5 for ts in parsed)
    # Strictly increasing, matches the stubbed business index tail.
    assert list(parsed) == list(forecast_env.index[-60:])


def test_forecast_dates_are_business_days(forecast_env):
    body = client.post("/api/forecast/onnx", json={"ticker": "TEST", "forecast_days": 10, "period": "1y"}).json()
    fdates = pd.to_datetime(body["results"]["forecast_dates"])
    assert all(ts.weekday() < 5 for ts in fdates)
    # Starts the trading day after the last historical bar.
    assert fdates.min() > forecast_env.index[-1]


def test_period_is_part_of_the_request_contract(forecast_env, monkeypatch):
    seen = {}

    def spy_load(ticker, period="1y", **kw):
        seen["period"] = period
        return forecast_env

    monkeypatch.setattr(api_module, "load_data", spy_load)
    client.post("/api/forecast/onnx", json={"ticker": "TEST", "forecast_days": 10, "period": "5y"})
    assert seen["period"] == "5y"


def test_model_unavailable_returns_error_shape(monkeypatch):
    monkeypatch.setattr(api_module, "MODEL", None)
    body = client.post("/api/forecast/onnx", json={"ticker": "TEST"}).json()
    assert body["status"] == "error"
    assert body["forecast_prices"] == []
    assert body["forecast_dates"] == []


def test_insufficient_history_returns_error(forecast_env, monkeypatch):
    short = forecast_env.iloc[:30]
    monkeypatch.setattr(api_module, "load_data", lambda ticker, period="1y", **kw: short)
    body = client.post("/api/forecast/onnx", json={"ticker": "TEST", "forecast_days": 10}).json()
    assert body["status"] == "error"
