"""
benchmark_50.py — Run sentiment engine against 50 US stocks.
Collect score distributions, article-level data, and history coverage.
"""
import os, sys, json, time, io, sqlite3, statistics
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "stock_market", ".env"))

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import logging
logging.basicConfig(level=logging.WARNING)

from stock_market.news_engine.engine import (
    get_sentiment_snapshot, _l1_cache, TARGET_NEWS_COUNT
)

TICKERS = [
    # Tech
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
    "NFLX", "CSCO", "IBM", "ORCL", "CRM", "ADBE", "AVGO", "QCOM",
    "INTC", "MU", "TXN", "AMAT",
    # Finance
    "JPM", "BAC", "GS", "MS", "V", "MA",
    # Energy
    "XOM", "CVX", "COP",
    # Consumer
    "WMT", "COST", "TGT", "HD", "LOW", "KO", "PEP", "MCD", "SBUX",
    # Healthcare
    "JNJ", "PFE", "MRK", "LLY", "ABBV", "UNH",
    # Industrial
    "CAT", "DE", "BA", "GE",
    # Media
    "DIS", "CMCSA",
]

print(f"Running sentiment benchmark for {len(TICKERS)} stocks...")
print(f"Start time: {datetime.now(timezone.utc).isoformat()}")
print()

results = []
all_article_scores = []
all_article_labels = []
tickers_with_articles = []

for i, ticker in enumerate(TICKERS):
    _l1_cache.clear()
    t0 = time.perf_counter()
    try:
        snapshot = get_sentiment_snapshot(ticker, force_refresh=False)
        elapsed = (time.perf_counter() - t0) * 1000

        score = snapshot.score
        label = snapshot.label.value
        status = snapshot.status.value
        article_count = snapshot.relevant_article_count

        # Collect article-level scores
        article_scores = []
        article_labels = []
        for a in snapshot.articles:
            rs = getattr(a, 'rule_score', 0.0)
            article_scores.append(rs)
            article_labels.append(a.finbert_label or 'neutral')
            all_article_scores.append(rs)
            all_article_labels.append(a.finbert_label or 'neutral')

        if article_count >= 3:
            tickers_with_articles.append(ticker)

        result = {
            "ticker": ticker,
            "score": score,
            "label": label,
            "status": status,
            "article_count": article_count,
            "coverage": snapshot.coverage_status,
            "providers": snapshot.providers_attempted,
            "elapsed_ms": round(elapsed),
            "article_scores": article_scores,
            "article_labels": article_labels,
            "positive_pct": snapshot.positive_pct,
            "neutral_pct": snapshot.neutral_pct,
            "negative_pct": snapshot.negative_pct,
        }
        results.append(result)

        status_icon = "OK" if status == "sufficient" else "WARN" if status == "insufficient" else "ERR"
        print(f"[{i+1:2d}/{len(TICKERS)}] {ticker:5s} {status_icon} score={score:+.3f} label={label:12s} articles={article_count:2d} elapsed={elapsed:.0f}ms")

    except Exception as e:
        elapsed = (time.perf_counter() - t0) * 1000
        print(f"[{i+1:2d}/{len(TICKERS)}] {ticker:5s} ERR {e!s:.40s} elapsed={elapsed:.0f}ms")
        results.append({"ticker": ticker, "score": None, "label": "Error", "status": "error",
                        "article_count": 0, "coverage": "NONE", "elapsed_ms": round(elapsed)})

print(f"\nEnd time: {datetime.now(timezone.utc).isoformat()}")

# ─── SCORE DISTRIBUTION ───────────────────────────────────────────────────
print("\n" + "="*60)
print("  SENTIMENT SCORE DISTRIBUTION")
print("="*60)

valid_scores = [r["score"] for r in results if r["score"] is not None]
if valid_scores:
    print(f"  Count:  {len(valid_scores)}")
    print(f"  Min:    {min(valid_scores):+.3f}")
    print(f"  Max:    {max(valid_scores):+.3f}")
    print(f"  Mean:   {statistics.mean(valid_scores):+.3f}")
    print(f"  Median: {statistics.median(valid_scores):+.3f}")

    sorted_scores = sorted(valid_scores)
    n = len(sorted_scores)
    for pct in [10, 25, 50, 75, 90]:
        idx = int(n * pct / 100)
        idx = min(idx, n - 1)
        print(f"  P{pct:2d}:   {sorted_scores[idx]:+.3f}")

    # Bucket counts
    buckets = [
        ("-1.00 to -0.50", -1.00, -0.50),
        ("-0.50 to -0.30", -0.50, -0.30),
        ("-0.30 to -0.15", -0.30, -0.15),
        ("-0.15 to -0.05", -0.15, -0.05),
        ("-0.05 to +0.05", -0.05, 0.05),
        ("+0.05 to +0.15", 0.05, 0.15),
        ("+0.15 to +0.30", 0.15, 0.30),
        ("+0.30 to +0.50", 0.30, 0.50),
        ("+0.50 to +1.00", 0.50, 1.00),
    ]
    print("\n  Bucket Distribution:")
    for name, lo, hi in buckets:
        count = sum(1 for s in valid_scores if lo <= s < hi)
        bar = "#" * count
        print(f"    {name}: {count:3d} {bar}")

# Label distribution
print("\n  Label Distribution:")
label_counts = defaultdict(int)
for r in results:
    label_counts[r["label"]] += 1
total = len(results)
for label in ["Positive", "Neutral", "Negative", "Insufficient News", "News Unavailable", "Error"]:
    count = label_counts.get(label, 0)
    pct = (count / total * 100) if total > 0 else 0
    print(f"    {label:20s}: {count:3d} ({pct:.1f}%)")

# ─── ARTICLE-LEVEL DISTRIBUTION ───────────────────────────────────────────
print("\n" + "="*60)
print("  ARTICLE-LEVEL RULE SCORE DISTRIBUTION")
print("="*60)

if all_article_scores:
    print(f"  Total articles: {len(all_article_scores)}")
    print(f"  Min:    {min(all_article_scores):+.3f}")
    print(f"  Max:    {max(all_article_scores):+.3f}")
    print(f"  Mean:   {statistics.mean(all_article_scores):+.3f}")
    print(f"  Median: {statistics.median(all_article_scores):+.3f}")

    # % rule_score == 0
    zero_count = sum(1 for s in all_article_scores if abs(s) < 0.001)
    print(f"  rule_score == 0: {zero_count}/{len(all_article_scores)} ({zero_count/len(all_article_scores)*100:.1f}%)")

    # Article label distribution
    art_label_counts = defaultdict(int)
    for l in all_article_labels:
        art_label_counts[l] += 1
    total_art = len(all_article_labels)
    for l in ["positive", "neutral", "negative"]:
        count = art_label_counts.get(l, 0)
        print(f"  {l:10s}: {count:3d} ({count/total_art*100:.1f}%)")

    # Article score buckets
    art_buckets = [
        ("<= -0.50", lambda s: s <= -0.50),
        ("-0.50 to -0.15", lambda s: -0.50 < s <= -0.15),
        ("-0.15 to -0.05", lambda s: -0.15 < s <= -0.05),
        ("-0.05 to +0.05", lambda s: -0.05 < s < 0.05),
        ("+0.05 to +0.15", lambda s: 0.05 <= s < 0.15),
        ("+0.15 to +0.50", lambda s: 0.15 <= s < 0.50),
        (">= +0.50", lambda s: s >= 0.50),
    ]
    print("\n  Article Score Buckets:")
    for name, pred in art_buckets:
        count = sum(1 for s in all_article_scores if pred(s))
        print(f"    {name:20s}: {count:3d} ({count/total_art*100:.1f}%)")

# ─── MANUAL +0.10 CALCULATION ─────────────────────────────────────────────
print("\n" + "="*60)
print("  MANUAL +0.10 CALCULATION TARGET")
print("="*60)

# Find a snapshot with ~8 articles and positive skew
candidates = [r for r in results if 6 <= r["article_count"] <= 10 and 0.05 <= (r["score"] or 0) <= 0.20]
if candidates:
    target = candidates[0]
    print(f"  Target: {target['ticker']} (score={target['score']:+.3f}, articles={target['article_count']})")
    print(f"  Positive: {target['positive_pct']:.0f}%  Neutral: {target['neutral_pct']:.0f}%  Negative: {target['negative_pct']:.0f}%")
    print(f"\n  Article breakdown:")
    for i, (rs, al) in enumerate(zip(target["article_scores"], target["article_labels"])):
        print(f"    [{i+1}] rule_score={rs:+.3f}  label={al}")
else:
    print("  No candidate found matching target criteria.")
    # Show closest
    closest = min(results, key=lambda r: abs((r["score"] or 0) - 0.10) if r["score"] is not None else 999)
    print(f"  Closest: {closest['ticker']} (score={closest['score']:+.3f}, articles={closest['article_count']})")

# ─── HISTORY AUDIT ─────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  SENTIMENT HISTORY AUDIT")
print("="*60)

db_path = os.path.join(os.path.dirname(__file__), "news_cache.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)

    # Check if sentiment_history table exists
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    if "sentiment_history" in tables:
        rows = conn.execute(
            "SELECT ticker, COUNT(*), MIN(timestamp), MAX(timestamp), "
            "COUNT(DISTINCT methodology_version), COUNT(DISTINCT score) "
            "FROM sentiment_history GROUP BY ticker ORDER BY ticker"
        ).fetchall()
        print(f"  Tickers with history: {len(rows)}")
        for r in rows:
            ticker, count, oldest, newest, versions, distinct_scores = r
            print(f"    {ticker:6s}: {count:3d} points, oldest={oldest[:10] if oldest else '?'}, "
                  f"newest={newest[:10] if newest else '?'}, v={versions}, scores={distinct_scores}")

        # Also check methodology versions
        versions = conn.execute(
            "SELECT methodology_version, COUNT(*) FROM sentiment_history GROUP BY methodology_version"
        ).fetchall()
        print(f"\n  Methodology versions in history:")
        for v, c in versions:
            print(f"    v{v}: {c} points")
    else:
        print("  sentiment_history table does NOT exist!")

    conn.close()
else:
    print(f"  Database not found: {db_path}")

# ─── SUMMARY ──────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  SUMMARY")
print("="*60)
print(f"  Stocks tested: {len(results)}")
print(f"  Sufficient:    {sum(1 for r in results if r['status'] == 'sufficient')}")
print(f"  Insufficient:  {sum(1 for r in results if r['status'] == 'insufficient')}")
print(f"  Error:         {sum(1 for r in results if r['status'] == 'error')}")
print(f"  Avg articles:  {statistics.mean([r['article_count'] for r in results]):.1f}")
print(f"  Full coverage (>=8): {sum(1 for r in results if r['coverage'] == 'FULL')}")
print(f"  Partial (3-7):       {sum(1 for r in results if r['coverage'] == 'PARTIAL')}")
print(f"  Insufficient (1-2):  {sum(1 for r in results if r['coverage'] == 'INSUFFICIENT')}")
print(f"  None (0):            {sum(1 for r in results if r['coverage'] == 'NONE')}")
