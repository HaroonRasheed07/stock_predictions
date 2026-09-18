"""Multi-ticker diagnostic — test coverage across all 22 tickers"""
import os, sys, json, time, logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "stock_market", ".env"))

logging.basicConfig(level=logging.WARNING)

from stock_market.news_engine.engine import (
    _score_relevance, _deduplicate_articles, _rank_and_select_articles,
    _l1_cache, RELEVANCE_THRESHOLD, LOOKBACK_DAYS, TARGET_NEWS_COUNT
)
from stock_market.news_engine.company_resolver import resolve_company
from stock_market.news_engine.providers import get_all_providers
from stock_market.news_engine.provider_budget import budget_manager
from stock_market.news_engine.provider_router import provider_router

TICKERS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
    "NFLX", "CSCO", "IBM", "ORCL", "CRM", "JPM", "BAC", "GS",
    "XOM", "CVX", "WMT", "COST", "KO", "DIS"
]

results = []

for ticker in TICKERS:
    _l1_cache.clear()
    company = resolve_company(ticker)
    providers = get_all_providers()
    selected = provider_router.select_providers(cached_article_count=0, target_count=TARGET_NEWS_COUNT)

    all_articles = []
    provider_stats = {}
    for pname in selected:
        provider = {p.name: p for p in providers}.get(pname)
        if not provider or not provider.is_available():
            provider_stats[pname] = {"status": "unavailable", "raw": 0}
            continue
        if not budget_manager.can_call(pname):
            provider_stats[pname] = {"status": "quota_exhausted", "raw": 0}
            continue
        try:
            result = provider.fetch(ticker=ticker, company=company, lookback_days=LOOKBACK_DAYS, max_results=15)
            provider_stats[pname] = {"status": "ok" if result.success else result.error, "raw": len(result.articles)}
            if result.articles:
                all_articles.extend(result.articles)
        except Exception as e:
            provider_stats[pname] = {"status": f"error: {e}", "raw": 0}

    # Score relevance
    for a in all_articles:
        a.relevance_score = _score_relevance(a, company)
    relevant = [a for a in all_articles if a.relevance_score >= RELEVANCE_THRESHOLD]
    unique = _deduplicate_articles(relevant)
    ranked = _rank_and_select_articles(unique, TARGET_NEWS_COUNT)

    count = len(ranked)
    if count >= TARGET_NEWS_COUNT:
        coverage = "FULL"
    elif count >= 3:
        coverage = "PARTIAL"
    elif count >= 1:
        coverage = "INSUFFICIENT"
    else:
        coverage = "NONE"

    raw_total = sum(s.get("raw", 0) for s in provider_stats.values())
    print(f"{ticker:5s}  raw={raw_total:3d}  rel={len(relevant):2d}  dedup={len(unique):2d}  final={count:2d}  {coverage:12s}  providers: {', '.join(f'{k}={v['raw']}' for k, v in provider_stats.items())}")
    results.append({"ticker": ticker, "raw": raw_total, "relevant": len(relevant), "unique": len(unique), "final": count, "coverage": coverage})

# Summary
print("\n=== COVERAGE SUMMARY ===")
full = sum(1 for r in results if r["coverage"] == "FULL")
partial = sum(1 for r in results if r["coverage"] == "PARTIAL")
insuff = sum(1 for r in results if r["coverage"] == "INSUFFICIENT")
none = sum(1 for r in results if r["coverage"] == "NONE")
print(f"FULL (>=8): {full}")
print(f"PARTIAL (3-7): {partial}")
print(f"INSUFFICIENT (1-2): {insuff}")
print(f"NONE (0): {none}")
avg = sum(r["final"] for r in results) / len(results) if results else 0
print(f"Average final count: {avg:.1f}")
