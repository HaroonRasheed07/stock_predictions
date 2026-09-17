"""
Live Integration Test — exercises the full news engine pipeline with real providers.
Tests canonical snapshot consistency and cross-page agreement.
"""
import sys
import os
import time
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from news_engine.engine import get_sentiment_snapshot, _l1_cache, _l1_lock
from shared_sentiment import score_article

TICKERS = ["MSFT", "IBM", "AAPL", "NVDA", "AMZN", "GOOGL", "TSLA", "AMD"]

def test_single_snapshot(ticker):
    """Get canonical snapshot and validate fields."""
    print(f"\n{'='*60}")
    print(f"  {ticker}")
    print(f"{'='*60}")
    start = time.perf_counter()
    snap = get_sentiment_snapshot(ticker, force_refresh=True)
    elapsed = (time.perf_counter() - start) * 1000

    print(f"  Status:        {snap.status.value}")
    print(f"  Label:         {snap.label.value}")
    print(f"  Score:         {snap.score:+.3f}")
    print(f"  Articles:      {snap.relevant_article_count}/{snap.article_count}")
    print(f"  Sources:       {snap.source_count}")
    print(f"  Pos%:          {snap.positive_pct:.1f}%")
    print(f"  Neu%:          {snap.neutral_pct:.1f}%")
    print(f"  Neg%:          {snap.negative_pct:.1f}%")
    print(f"  Methodology:   v{snap.methodology_version}")
    print(f"  Elapsed:       {elapsed:.0f}ms")

    # Validate percentage sum
    pct_sum = snap.positive_pct + snap.neutral_pct + snap.negative_pct
    if abs(pct_sum - 100.0) > 0.2:
        print(f"  [WARN] Percentages sum to {pct_sum:.1f}% (expected ~100%)")
    else:
        print(f"  [OK] Percentages sum to {pct_sum:.1f}%")

    # Validate methodology version
    if snap.methodology_version != "3":
        print(f"  [FAIL] Methodology version is {snap.methodology_version}, expected 3")
    else:
        print(f"  [OK] Methodology version correct")

    # Validate status
    valid_statuses = {"sufficient", "insufficient", "error", "no_relevant_news", "news_unavailable"}
    if snap.status.value not in valid_statuses:
        print(f"  [FAIL] Invalid status: {snap.status.value}")
    else:
        print(f"  [OK] Status is valid")

    # Validate score range
    if not (-1.0 <= snap.score <= 1.0):
        print(f"  [FAIL] Score {snap.score} out of range [-1, 1]")
    else:
        print(f"  [OK] Score in valid range")

    # Validate label matches score direction
    if snap.score > 0.15 and snap.label.value != "positive":
        print(f"  [WARN] Score {snap.score:+.3f} but label is {snap.label.value}")
    elif snap.score < -0.15 and snap.label.value != "negative":
        print(f"  [WARN] Score {snap.score:+.3f} but label is {snap.label.value}")
    elif abs(snap.score) <= 0.15 and snap.label.value not in ("neutral", "insufficient"):
        print(f"  [WARN] Score {snap.score:+.3f} but label is {snap.label.value}")
    else:
        print(f"  [OK] Label matches score direction")

    # Show top articles
    if snap.articles:
        print(f"\n  Top articles:")
        for i, a in enumerate(snap.articles[:5], 1):
            print(f"    {i}. [{a.finbert_label}] (r={a.relevance_score:.2f}) {a.title[:80]}")
    else:
        print(f"  No articles found")

    # Test to_legacy_dict consistency
    legacy = snap.to_legacy_dict()
    if legacy.get("methodology_version") != "3":
        print(f"  [FAIL] to_legacy_dict missing methodology_version")
    else:
        print(f"  [OK] to_legacy_dict includes methodology_version")

    for field in ["positive_count", "neutral_count", "negative_count", "positive_pct", "neutral_pct", "negative_pct"]:
        if field not in legacy:
            print(f"  [FAIL] to_legacy_dict missing {field}")
    else:
        print(f"  [OK] to_legacy_dict has count/pct fields")

    return snap


def test_canonical_consistency(ticker):
    """Verify that calling get_sentiment_snapshot twice returns same result."""
    print(f"\n{'='*60}")
    print(f"  CONSISTENCY CHECK: {ticker}")
    print(f"{'='*60}")

    snap1 = get_sentiment_snapshot(ticker, force_refresh=False)
    snap2 = get_sentiment_snapshot(ticker, force_refresh=False)

    checks = [
        ("label", snap1.label.value, snap2.label.value),
        ("score", round(snap1.score, 3), round(snap2.score, 3)),
        ("status", snap1.status.value, snap2.status.value),
        ("article_count", snap1.article_count, snap2.article_count),
        ("methodology_version", snap1.methodology_version, snap2.methodology_version),
    ]

    all_pass = True
    for field, v1, v2 in checks:
        if v1 == v2:
            print(f"  [OK] {field}: {v1} == {v2}")
        else:
            print(f"  [FAIL] {field}: {v1} != {v2}")
            all_pass = False

    return all_pass


def test_rule_engine_edge_cases():
    """Test the shared_sentiment rule engine on known patterns."""
    print(f"\n{'='*60}")
    print(f"  RULE ENGINE EDGE CASES")
    print(f"{'='*60}")

    cases = [
        ("Microsoft Beats Earnings Estimates, Raises Full-Year Guidance", "positive"),
        ("AMD Lowers Full-Year Revenue Guidance", "negative"),
        ("Microsoft Reports In Line With Expectations", "neutral"),
        ("Amazon Announces 18,000 Job Cuts", "negative"),
        ("Tesla Misses Revenue Estimates, Cuts Prices Again", "negative"),
        ("NVIDIA Warns of China Export Restrictions Impact", "negative"),
        ("IBM Warns of Slowing Consulting Demand", "negative"),
        ("Company Does Not Plan to Cut Prices Despite Competition", "neutral"),
        ("Tesla Announces New Gigafactory Location", "positive"),
    ]

    passed = 0
    failed = 0
    for title, expected in cases:
        result = score_article(title)
        actual = result["label"]
        score = result["score"]
        ok = actual == expected
        if ok:
            passed += 1
            print(f"  [OK] {actual} (score={score:+.3f}) | {title[:60]}")
        else:
            failed += 1
            print(f"  [FAIL] expected={expected}, got={actual} (score={score:+.3f}) | {title[:60]}")

    print(f"\n  Rule engine edge cases: {passed}/{passed+failed} passed")
    return failed == 0


def test_api_response_fields(ticker):
    """Test that the legacy dict has all required frontend fields."""
    print(f"\n{'='*60}")
    print(f"  API RESPONSE FIELDS: {ticker}")
    print(f"{'='*60}")

    from news_engine.engine import get_sentiment_for_api
    data = get_sentiment_for_api(ticker)

    required_fields = [
        "status", "label", "score", "sentiment_score",
        "positive_pct", "neutral_pct", "negative_pct",
        "positive_count", "neutral_count", "negative_count",
        "article_count", "relevant_article_count", "source_count",
        "methodology_version", "generated_at", "data_freshness",
        "articles", "providers_attempted", "provider_summary",
    ]

    all_ok = True
    for field in required_fields:
        if field in data:
            val = data[field]
            if isinstance(val, float):
                print(f"  [OK] {field}: {val:.3f}")
            elif isinstance(val, list):
                print(f"  [OK] {field}: list[{len(val)}]")
            elif isinstance(val, dict):
                print(f"  [OK] {field}: dict[{len(val)} keys]")
            else:
                print(f"  [OK] {field}: {val}")
        else:
            print(f"  [FAIL] MISSING: {field}")
            all_ok = False

    return all_ok


if __name__ == "__main__":
    print("=" * 60)
    print("  LIVE INTEGRATION TEST SUITE")
    print("=" * 60)

    # 1. Rule engine edge cases (fast, no network)
    rule_ok = test_rule_engine_edge_cases()

    # 2. Live snapshot for each ticker (uses real providers)
    snapshots = {}
    for ticker in TICKERS:
        try:
            snap = test_single_snapshot(ticker)
            snapshots[ticker] = snap
        except Exception as e:
            print(f"  [ERROR] {ticker}: {e}")
            import traceback
            traceback.print_exc()

    # 3. Canonical consistency (should be instant due to L1 cache)
    consistency_results = {}
    for ticker in TICKERS:
        if ticker in snapshots:
            consistency_results[ticker] = test_canonical_consistency(ticker)

    # 4. API response fields
    api_results = {}
    for ticker in TICKERS:
        if ticker in snapshots:
            api_results[ticker] = test_api_response_fields(ticker)

    # Summary
    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    print(f"  Rule engine edge cases: {'PASS' if rule_ok else 'FAIL'}")
    print(f"  Snapshots obtained:     {len(snapshots)}/{len(TICKERS)}")
    print(f"  Consistency checks:     {sum(consistency_results.values())}/{len(consistency_results)}")
    print(f"  API field checks:       {sum(api_results.values())}/{len(api_results)}")

    # Score distribution
    scores = [(t, s.score, s.label.value, s.status.value) for t, s in snapshots.items()]
    print(f"\n  Score distribution:")
    for ticker, score, label, status in sorted(scores, key=lambda x: x[1], reverse=True):
        print(f"    {ticker:6s} {score:+.3f} {label:12s} ({status})")
