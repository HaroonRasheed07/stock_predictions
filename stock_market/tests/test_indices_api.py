"""Tests for GET /api/market/indices — homepage strip data source.

The endpoint must return real-shape index rows (value / changePercent /
sparkline points) and degrade to an empty list — never an error or invented
numbers — when the upstream history adapter fails.
"""
import sys
import types

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from stock_market import api as api_module

client = TestClient(api_module.app)


@pytest.fixture
def indices_env(monkeypatch):
    """Stub the yahooquery adapter and bypass persistent SWR caching."""
    fake_df = pd.DataFrame({"Close": [6800.0, 6810.5, 6842.3]})
    fake_module = types.SimpleNamespace(
        get_fast_batch_history=lambda symbols, period=None, interval=None: {
            s: fake_df for s in symbols
        }
    )
    monkeypatch.setitem(sys.modules, "yahooquery_adapter", fake_module)
    monkeypatch.setattr(
        api_module.cache_manager, "get_swr", lambda **kw: (None, {"status": "MISS"})
    )
    monkeypatch.setattr(api_module.cache_manager, "set", lambda **kw: None)
    return fake_df


def test_indices_shape_and_values(indices_env):
    res = client.get("/api/market/indices")
    assert res.status_code == 200
    body = res.json()
    assert [row["label"] for row in body["indexes"]] == ["S&P 500", "Nasdaq", "Dow Jones", "VIX"]
    row = body["indexes"][0]
    assert row["symbol"] == "^GSPC"
    assert row["value"] == 6842.3
    expected_pct = ((6842.3 - 6810.5) / 6810.5) * 100
    assert abs(row["changePercent"] - expected_pct) < 0.01
    assert row["points"] == [6800.0, 6810.5, 6842.3]


def test_indices_empty_list_when_upstream_fails(monkeypatch):
    fake_module = types.SimpleNamespace(
        get_fast_batch_history=lambda symbols, period=None, interval=None: {}
    )
    monkeypatch.setitem(sys.modules, "yahooquery_adapter", fake_module)
    monkeypatch.setattr(
        api_module.cache_manager, "get_swr", lambda **kw: (None, {"status": "MISS"})
    )
    monkeypatch.setattr(api_module.cache_manager, "set", lambda **kw: None)
    res = client.get("/api/market/indices")
    assert res.status_code == 200
    assert res.json()["indexes"] == []


def test_indices_partial_universe_keeps_available_rows(monkeypatch):
    fake_df = pd.DataFrame({"Close": [100.0, 101.0, 102.5]})
    fake_module = types.SimpleNamespace(
        get_fast_batch_history=lambda symbols, period=None, interval=None: {"^GSPC": fake_df}
    )
    monkeypatch.setitem(sys.modules, "yahooquery_adapter", fake_module)
    monkeypatch.setattr(
        api_module.cache_manager, "get_swr", lambda **kw: (None, {"status": "MISS"})
    )
    monkeypatch.setattr(api_module.cache_manager, "set", lambda **kw: None)
    res = client.get("/api/market/indices")
    assert res.status_code == 200
    rows = res.json()["indexes"]
    assert [r["symbol"] for r in rows] == ["^GSPC"]
    assert rows[0]["value"] == 102.5
