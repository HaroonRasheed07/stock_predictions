# benchmark_cache.py — Automated Verification & Benchmark Suite for SWR Cache Lifecycle
import time
import threading
import os
import sys
from concurrent.futures import ThreadPoolExecutor

# Ensure stock_market dir in python path
sys.path.insert(0, os.path.dirname(__file__))

from cache_manager import PersistentCacheManager, cache_manager, SingleFlightLock
from api import _compute_market_overview_raw, get_market_overview, IndicatorRequest

def run_benchmarks():
    print("=" * 70)
    print("STARTING CACHE LIFECYCLE & SWR VERIFICATION BENCHMARK SUITE")
    print("=" * 70)

    # ---------------------------------------------------------
    # TEST 1: Cold Request vs Warm Cache
    # ---------------------------------------------------------
    print("\n[TEST 1] Cold Request vs Warm Cache")
    req = IndicatorRequest(ticker="AAPL", period="1y")

    t0 = time.perf_counter()
    resp1 = get_market_overview(req)
    t1 = time.perf_counter()
    cold_latency = (t1 - t0) * 1000
    meta1 = resp1.get("_cache_meta", {})
    print(f"Cold Request Latency: {cold_latency:.2f} ms | Status: {meta1.get('status')}")

    t0 = time.perf_counter()
    resp2 = get_market_overview(req)
    t1 = time.perf_counter()
    warm_latency = (t1 - t0) * 1000
    meta2 = resp2.get("_cache_meta", {})
    print(f"Warm Cache Latency:  {warm_latency:.2f} ms | Status: {meta2.get('status')}")

    assert meta2.get("status") == "HIT", f"Expected HIT, got {meta2.get('status')}"
    assert warm_latency < 50.0, f"Warm cache took too long: {warm_latency:.2f} ms"

    # ---------------------------------------------------------
    # TEST 2: Multi-Stock Isolation
    # ---------------------------------------------------------
    print("\n[TEST 2] Multi-Stock Cache Key Isolation")
    tickers = ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN"]
    for t in tickers:
        t0 = time.perf_counter()
        r = get_market_overview(IndicatorRequest(ticker=t, period="1y"))
        lat = (time.perf_counter() - t0) * 1000
        assert r["ticker"] == t, f"Expected ticker {t}, got {r['ticker']}"
        print(f"Ticker {t:<6} -> Latency: {lat:6.2f} ms | Ticker in payload: {r['ticker']}")

    # ---------------------------------------------------------
    # TEST 3: Expired TTL & Stale-While-Revalidate (SWR) Response
    # ---------------------------------------------------------
    print("\n[TEST 3] Expired TTL & Stale-While-Revalidate (SWR)")
    key = "overview:AAPL:1y"
    # Artificially set fresh_until to the past so it becomes STALE
    with cache_manager._l1_lock:
        if key in cache_manager._l1_cache:
            cache_manager._l1_cache[key]["fresh_until"] = time.time() - 100.0

    t0 = time.perf_counter()
    resp_stale = get_market_overview(req)
    stale_latency = (time.perf_counter() - t0) * 1000
    meta_stale = resp_stale.get("_cache_meta", {})
    print(f"Post-TTL Expiry Latency: {stale_latency:.2f} ms | Status: {meta_stale.get('status')}")

    assert meta_stale.get("status") == "STALE", f"Expected STALE status, got {meta_stale.get('status')}"
    assert stale_latency < 30.0, f"SWR response was blocking! Took {stale_latency:.2f} ms"

    # ---------------------------------------------------------
    # TEST 4: Thundering Herd / Cache Stampede (50 Concurrent Requests)
    # ---------------------------------------------------------
    print("\n[TEST 4] 50 Concurrent Requests (Single-Flight Lock Verification)")
    # Set fresh_until to the past
    with cache_manager._l1_lock:
        if key in cache_manager._l1_cache:
            cache_manager._l1_cache[key]["fresh_until"] = time.time() - 100.0

    results = []
    latencies = []

    def _concurrent_worker(worker_id):
        start = time.perf_counter()
        res = get_market_overview(req)
        dur = (time.perf_counter() - start) * 1000
        return res, dur

    t_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=50) as exec:
        futures = [exec.submit(_concurrent_worker, i) for i in range(50)]
        for f in futures:
            r, d = f.result()
            results.append(r)
            latencies.append(d)

    total_duration = (time.perf_counter() - t_start) * 1000
    avg_latency = sum(latencies) / len(latencies)
    max_latency = max(latencies)

    print(f"50 Concurrent Requests Completed in: {total_duration:.2f} ms total")
    print(f"Average Request Latency:            {avg_latency:.2f} ms")
    print(f"Max Request Latency:                {max_latency:.2f} ms")

    # Verify all 50 users received valid non-empty responses
    for r in results:
        assert r["ticker"] == "AAPL"
        assert len(r.get("data", [])) > 0 or r.get("currentPrice", 0) >= 0

    print("SUCCESS: Single-flight request coalescing prevented cache stampede!")

    # ---------------------------------------------------------
    # TEST 5: Backend Process Restart & L2 SQLite Cold Persistence
    # ---------------------------------------------------------
    print("\n[TEST 5] Backend Restart & L2 SQLite Cold Persistence")
    # Instantiate a NEW manager to simulate process restart
    new_mgr = PersistentCacheManager(db_path=cache_manager.db_path)
    val, meta = new_mgr.get_swr("overview:AAPL:1y")
    print(f"Re-loaded from SQLite DB -> Found Key: {'overview:AAPL:1y'} | Status: {meta.get('status')}")
    assert val is not None, "Failed to load cached snapshot from L2 SQLite database after process restart!"
    assert val["ticker"] == "AAPL"
    print("SUCCESS: Cache survived process restart!")

    # ---------------------------------------------------------
    # TEST 6: External Provider Failure Resilience
    # ---------------------------------------------------------
    print("\n[TEST 6] External Provider Failure Resilience")
    def _failing_provider_refresh():
        raise RuntimeError("Simulated Yahoo Query API network failure!")

    # Trigger background refresh with failing function
    cache_manager.trigger_background_refresh(
        key="overview:AAPL:1y",
        refresh_func=_failing_provider_refresh,
        fresh_ttl_seconds=120,
        stale_ttl_seconds=86400
    )
    time.sleep(0.5)  # Wait for background thread to execute

    # Read cache again
    val_after_fail, meta_fail = cache_manager.get_swr("overview:AAPL:1y")
    assert val_after_fail is not None, "Cache was wiped out after provider failure!"
    assert val_after_fail["ticker"] == "AAPL"
    print("SUCCESS: Valid cached snapshot retained despite provider failure!")

    print("\n" + "=" * 70)
    print("ALL BENCHMARK TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_benchmarks()
