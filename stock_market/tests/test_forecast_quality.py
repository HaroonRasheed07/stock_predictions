"""Phase 1 — forecast integrity tests.

Covers:
- inverse-transform roundtrip on window-fitted scalers
- forecast_quality_issues guards (day-1 gap, horizon gap, narrow range, NaN)
- forecast_stock continuity on 10 synthetic tickers with a stub ONNX session
- API-level proof that stale training-time scalers are bypassed
- API-level quality refusal path
- server-side refusal audit log (never surfaced through the API)
"""
import json

import numpy as np
import pandas as pd
import pytest
from sklearn.preprocessing import MinMaxScaler
from fastapi.testclient import TestClient

from stock_market import api as api_module
from stock_market.forecast_onnx import (
    fit_inference_scaler,
    forecast_quality_issues,
    forecast_stock,
    MAX_DAY1_GAP,
)

client = TestClient(api_module.app)

TICKERS_10 = ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "GOOGL", "META", "JPM", "XOM", "KO"]


def make_ohlc(ticker: str, periods: int = 130, start_price: float = 100.0) -> pd.DataFrame:
    """Deterministic synthetic OHLC series, unique per ticker."""
    rng = np.random.default_rng(abs(hash(ticker)) % (2**32))
    idx = pd.bdate_range(end="2026-10-16", periods=periods)
    drift = rng.normal(0.0005, 0.012, periods).cumsum()
    close = start_price * np.exp(drift)
    close = np.maximum(close, 1.0)
    high = close * (1 + rng.uniform(0.001, 0.008, periods))
    low = close * (1 - rng.uniform(0.001, 0.008, periods))
    open_ = close * (1 + rng.normal(0, 0.004, periods))
    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close}, index=idx)


class StubSession:
    """Deterministic stand-in for the ONNX session.

    Historical batch run: echoes each window's last value (perfect continuity).
    Forward run (1, 60, 1): drifts +0.5% per step from the window's last value,
    producing a mildly widening path that passes the narrow-range guard.
    """

    def __init__(self):
        self._forward_step = 0

    def get_inputs(self):
        class I:
            name = "input_1"
        return [I()]

    def run(self, _outs, feeds):
        x = next(iter(feeds.values()))
        if x.shape[0] == 1 and self._forward_step >= 0:
            # forward forecast call — additive drift in scaled space so a
            # window whose last value sits at the scale minimum still widens
            last = float(x[0, -1, 0])
            val = last + 0.01 * (self._forward_step + 1)
            self._forward_step += 1
            return [np.array([[val]], dtype=np.float32)]
        # historical batch: echo last timestep of each window
        return [x[:, -1, 0].reshape(-1, 1).astype(np.float32)]


class GarbageSession:
    """Always predicts scaled 5.0 — inverse-transforms far above the live
    price band and must trip the day-1 quality guard."""

    def get_inputs(self):
        class I:
            name = "input_1"
        return [I()]

    def run(self, _outs, feeds):
        x = next(iter(feeds.values()))
        return [np.full((x.shape[0], 1), 5.0, dtype=np.float32)]


# ── scaler roundtrip ─────────────────────────────────────────────────────────

def test_inference_scaler_roundtrip_preserves_price_levels():
    closes = np.linspace(40, 90, 120).reshape(-1, 1)
    scaler = fit_inference_scaler(closes)
    scaled = scaler.transform(closes)
    assert scaled.min() == pytest.approx(0.0, abs=1e-6)
    assert scaled.max() == pytest.approx(1.0, abs=1e-6)
    back = scaler.inverse_transform(scaled)
    assert np.allclose(back.flatten(), closes.flatten(), rtol=1e-5)


def test_inference_scaler_handles_high_price_stock():
    closes = np.linspace(300, 360, 120).reshape(-1, 1)
    scaler = fit_inference_scaler(closes)
    last = float(closes[-1, 0])
    # transform of the live price must sit inside [0, 1], never above it
    assert 0.0 <= float(scaler.transform([[last]])[0, 0]) <= 1.0


# ── quality guards ───────────────────────────────────────────────────────────

def test_guard_passes_continuous_plausible_forecast():
    last = 100.0
    fc = [100.5, 101.0, 101.4, 101.9, 102.2, 102.6, 103.0, 103.3, 103.7, 104.0]
    assert forecast_quality_issues(last, fc, atr14=2.0) == []


def test_guard_rejects_day1_gap():
    issues = forecast_quality_issues(343.0, [318.0 + i for i in range(10)], atr14=6.0)
    assert any("day-1" in s for s in issues)


def test_guard_rejects_horizon_drift():
    issues = forecast_quality_issues(100.0, [100.2, 102, 105, 110, 120, 130])
    assert any("horizon" in s for s in issues)


def test_guard_rejects_implausibly_narrow_range():
    # Constant path: width 0 vs ATR-implied move.
    issues = forecast_quality_issues(100.0, [100.0] * 10, atr14=2.0)
    assert any("narrow" in s for s in issues)


def test_guard_rejects_non_finite():
    issues = forecast_quality_issues(100.0, [100.0, float("nan"), 101.0])
    assert any("non-finite" in s for s in issues)


def test_guard_rejects_empty():
    assert forecast_quality_issues(100.0, []) == ["empty forecast"]


def test_guard_skips_atr_check_when_atr_missing():
    # Narrow-but-continuous path without ATR info is allowed (no basis to judge).
    issues = forecast_quality_issues(100.0, [100.0 + 0.01 * i for i in range(10)], atr14=None)
    assert issues == []


# ── forecast_stock continuity across 10 tickers ──────────────────────────────

@pytest.mark.parametrize("ticker", TICKERS_10)
def test_forecast_day1_continuous_with_refit_scaler(ticker):
    df = make_ohlc(ticker, start_price=20.0 + 70.0 * (TICKERS_10.index(ticker) / 9))
    closes = df["Close"].values
    last_close = float(closes[-1])

    actual, predicted, forecast, dates = forecast_stock(
        df, StubSession(), scaler=None, forecast_days=10
    )

    assert len(forecast) == 10
    assert len(dates) == 10
    day1_gap = abs(float(forecast[0]) - last_close) / last_close
    assert day1_gap <= MAX_DAY1_GAP, f"{ticker}: day-1 gap {day1_gap:.2%}"
    # forecasts must sit near the CURRENT price level, not an arbitrary band
    assert float(forecast.min()) > 0.5 * last_close
    assert float(forecast.max()) < 1.5 * last_close
    assert forecast_quality_issues(last_close, forecast, atr14=None) == []


# ── API level: stale scaler bypass + quality refusal ─────────────────────────

@pytest.fixture
def api_env(monkeypatch, tmp_path):
    session = StubSession()
    # Refusals are logged server-side — keep test writes out of the repo.
    monkeypatch.setenv("FORECAST_REFUSAL_LOG", str(tmp_path / "forecast_refusals.log"))
    monkeypatch.setattr(api_module, "MODEL", session)
    # Poison SCALERS with absurd stale ranges — production must ignore these.
    stale = {}
    for t in TICKERS_10:
        s = MinMaxScaler(feature_range=(0, 1))
        s.fit(np.array([[1.0], [2.0]]))
        stale[t] = s
    monkeypatch.setattr(api_module, "SCALERS", stale)
    monkeypatch.setattr(api_module, "get_cached_forecast", lambda key: None)
    monkeypatch.setattr(api_module, "set_cached_forecast", lambda key, value: None)

    def fake_load(ticker, period="1y", **kw):
        return make_ohlc(ticker, start_price=50.0 + 25.0 * (TICKERS_10.index(ticker) if ticker in TICKERS_10 else 0))

    monkeypatch.setattr(api_module, "load_data", fake_load)
    return session


@pytest.mark.parametrize("ticker", TICKERS_10)
def test_api_ignores_stale_scalers_and_stays_at_price_level(api_env, ticker):
    body = client.post(
        "/api/forecast/onnx", json={"ticker": ticker, "forecast_days": 10, "period": "1y"}
    ).json()
    assert body["status"] == "success", body
    fc = body["results"]["forecast_prices"]
    last_close = float(make_ohlc(ticker, start_price=50.0 + 25.0 * TICKERS_10.index(ticker))["Close"].iloc[-1])
    # Stale-scaler bug would map forecasts into ~[1, 2]; assert we are at real levels.
    assert min(fc) > 0.5 * last_close
    assert max(fc) < 1.5 * last_close
    assert abs(fc[0] - last_close) / last_close <= MAX_DAY1_GAP


def test_api_quality_refusal_returns_dedicated_message(monkeypatch, api_env):
    monkeypatch.setattr(api_module, "MODEL", GarbageSession())
    body = client.post(
        "/api/forecast/onnx", json={"ticker": "AAPL", "forecast_days": 10, "period": "1y"}
    ).json()
    assert body["status"] == "error"
    assert body["message"] == "Forecast unavailable for quality reasons"
    assert body["forecast_prices"] == []
    assert body.get("quality_issues")


def test_api_quality_refusal_logged_server_side_only(monkeypatch, api_env, tmp_path):
    """Each refusal appends one JSONL record (date/ticker/issues) to a local
    file so daily refusal rates can be counted — and the record/log path is
    never echoed back through the API response."""
    log_path = tmp_path / "forecast_refusals.log"
    monkeypatch.setenv("FORECAST_REFUSAL_LOG", str(log_path))
    monkeypatch.setattr(api_module, "MODEL", GarbageSession())

    resp = client.post(
        "/api/forecast/onnx", json={"ticker": "AAPL", "forecast_days": 10, "period": "1y"}
    )
    body = resp.json()
    assert body["status"] == "error"

    assert log_path.exists(), "refusal must be logged server-side"
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1
    rec = json.loads(lines[0])
    assert rec["ticker"] == "AAPL"
    assert len(rec["date"]) == 10 and rec["date"][4] == "-" and rec["date"][7] == "-"
    assert rec["issues"] == body["quality_issues"]
    assert "T" in rec["ts"]

    # Server-side only: nothing about the log leaks into the API surface.
    assert str(log_path) not in resp.text
    assert "log" not in body and "log_path" not in body
