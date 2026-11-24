"""Regression tests for the homepage composite market snapshot endpoint."""
import time

import pytest
from fastapi.testclient import TestClient

from stock_market import api as api_module

client = TestClient(api_module.app)

CACHE_META = {
    "created_at": 1795510000.0,
    "updated_at": 1795510000.0,
    "fresh_until": 1795510120.0,
    "is_stale": False,
    "status": "HIT",
}


def discover_payload(tickers):
    return {
        "stocks": {
            ticker: {
                "ticker": ticker,
                "name": f"{ticker} Inc.",
                "price": 100.0 + index,
                "change": 1.0,
                "changePercent": 1.5,
                "signal": "Bullish",
                "risk": "Moderate",
                "technical": "Bullish",
                "sentiment": "Neutral",
                "sentiment_status": "sufficient",
                "score": 60.0,
            }
            for index, ticker in enumerate(tickers)
        },
        "count": len(tickers),
        "_cache_meta": CACHE_META,
    }


def opportunity_payload(tickers):
    return {
        "scan_results": [
            {
                "ticker": ticker,
                "name": f"{ticker} Inc.",
                "asset_class": "equity",
                "score": 50.0 + index,
                "price": 100.0,
                "change": 1.0,
                "change_percent": 1.5,
                "factors": [
                    {"name": "Momentum (RSI)", "impact": 10, "value": "Neutral", "detail": "RSI: 45.0"}
                ],
            }
            for index, ticker in enumerate(tickers)
        ],
        "_cache_meta": CACHE_META,
    }


@pytest.fixture
def snapshot_env(monkeypatch):
    monkeypatch.setattr(
        api_module.cache_manager,
        "get_swr",
        lambda **kwargs: (None, {"status": "MISS", "updated_at": 0.0, "is_stale": True}),
    )
    monkeypatch.setattr(api_module.cache_manager, "set", lambda **kwargs: None)
    monkeypatch.setattr(api_module, "discover_scan", lambda req: discover_payload(req.tickers))
    monkeypatch.setattr(api_module, "scan_opportunities", lambda req: opportunity_payload(req.tickers))


def test_snapshot_success_returns_valid_shape(snapshot_env):
    res = client.post(
        "/api/home/market-snapshot",
        json={"tickers": ["AAA", "BBB", "CCC"], "period": "1y"},
    )
    assert res.status_code == 200
    body = res.json()
    assert sorted(body["stocks"]) == ["AAA", "BBB", "CCC"]
    assert {row["ticker"] for row in body["opportunities"]} == {"AAA", "BBB", "CCC"}
    assert body["source_updated_at"] == CACHE_META["updated_at"]
    assert body["degraded"] is False
    assert body["errors"] == []
    assert body["_cache_meta"]["status"] == "MISS"


def test_partial_upstream_failure_keeps_available_rows(snapshot_env, monkeypatch):
    def flaky_discover(req):
        if "BBB" in req.tickers:
            raise TimeoutError("upstream timed out")
        return discover_payload(req.tickers)

    monkeypatch.setattr(api_module, "discover_scan", flaky_discover)
    tickers = ["AAA", "CCC"] + ["FILL{0}".format(i) for i in range(8)] + ["BBB"]
    res = client.post(
        "/api/home/market-snapshot",
        json={"tickers": tickers, "period": "1y"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "AAA" in body["stocks"]
    assert "CCC" in body["stocks"]
    assert "BBB" not in body["stocks"]
    assert body["degraded"] is True
    assert any("discover chunk failed" in error for error in body["errors"])


def test_empty_upstream_returns_empty_snapshot_not_error(snapshot_env, monkeypatch):
    monkeypatch.setattr(api_module, "discover_scan", lambda req: {"stocks": {}, "count": 0})
    monkeypatch.setattr(api_module, "scan_opportunities", lambda req: {"scan_results": []})
    res = client.post(
        "/api/home/market-snapshot",
        json={"tickers": ["AAA"], "period": "1y"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["stocks"] == {}
    assert body["opportunities"] == []
    assert body["degraded"] is True
    assert "operational_error" not in body


def test_invalid_rows_are_discarded(snapshot_env, monkeypatch):
    monkeypatch.setattr(
        api_module,
        "discover_scan",
        lambda req: {"stocks": {"AAA": {"ticker": "AAA"}, "BAD": None}, "count": 2},
    )
    monkeypatch.setattr(
        api_module,
        "scan_opportunities",
        lambda req: {"scan_results": [{"ticker": "AAA"}, {}]},
    )
    res = client.post(
        "/api/home/market-snapshot",
        json={"tickers": ["AAA"], "period": "1y"},
    )
    assert res.status_code == 200
    body = res.json()
    assert list(body["stocks"]) == ["AAA"]
    assert [row["ticker"] for row in body["opportunities"]] == ["AAA"]


def test_total_failure_reuses_last_good_snapshot(monkeypatch):
    previous = {
        "stocks": discover_payload(["AAA"])["stocks"],
        "opportunities": opportunity_payload(["AAA"])["scan_results"],
        "source_updated_at": CACHE_META["updated_at"],
        "degraded": False,
        "errors": [],
    }
    calls = {"count": 0}

    def fake_get_swr(**kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return None, {"status": "MISS", "updated_at": 0.0, "is_stale": True}
        return previous, {"status": "STALE", "updated_at": CACHE_META["updated_at"], "is_stale": True}

    monkeypatch.setattr(api_module.cache_manager, "get_swr", fake_get_swr)
    monkeypatch.setattr(api_module.cache_manager, "set", lambda **kwargs: None)

    def fail(req):
        raise TimeoutError("upstream timed out")

    monkeypatch.setattr(api_module, "discover_scan", fail)
    monkeypatch.setattr(api_module, "scan_opportunities", fail)
    res = client.post(
        "/api/home/market-snapshot",
        json={"tickers": ["AAA"], "period": "1y"},
    )
    assert res.status_code == 200
    body = res.json()
    assert list(body["stocks"]) == ["AAA"]
    assert body["source_updated_at"] == CACHE_META["updated_at"]
    assert body["degraded"] is True
    assert len(body["errors"]) >= 2


def test_no_overlapping_request_for_same_key(monkeypatch):
    starts = []

    def fake_get_swr(**kwargs):
        return None, {"status": "MISS", "updated_at": 0.0, "is_stale": True}

    def fake_set(**kwargs):
        starts.append(time.perf_counter())

    monkeypatch.setattr(api_module.cache_manager, "get_swr", fake_get_swr)
    monkeypatch.setattr(api_module.cache_manager, "set", fake_set)
    monkeypatch.setattr(api_module, "discover_scan", lambda req: discover_payload(req.tickers))
    monkeypatch.setattr(api_module, "scan_opportunities", lambda req: opportunity_payload(req.tickers))

    for _ in range(3):
        res = client.post("/api/home/market-snapshot", json={"tickers": ["AAA"], "period": "1y"})
        assert res.status_code == 200
    assert len(starts) == 3
