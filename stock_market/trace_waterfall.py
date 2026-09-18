"""Trace the full engine pipeline for AAPL with waterfall logging"""
import os, sys, json, time, logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load correct .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "stock_market", ".env"))

logging.basicConfig(level=logging.INFO, format="[%(name)s] %(message)s")

from stock_market.news_engine.engine import (
    _score_relevance, _deduplicate_articles, _rank_and_select_articles,
    _l1_cache, RELEVANCE_THRESHOLD, LOOKBACK_DAYS, TARGET_NEWS_COUNT,
    get_sentiment_snapshot
)
from stock_market.news_engine.company_resolver import resolve_company, get_search_queries
from stock_market.news_engine.providers import get_all_providers
from stock_market.news_engine.provider_budget import budget_manager
from stock_market.news_engine.provider_router import provider_router, CANDIDATE_MULTIPLIER, MAX_CANDIDATES

ticker = "AAPL"
company = resolve_company(ticker)

print(f"TARGET_NEWS_COUNT = {TARGET_NEWS_COUNT}")
print(f"CANDIDATE_MULTIPLIER = {CANDIDATE_MULTIPLIER}")
print(f"MAX_CANDIDATES = {MAX_CANDIDATES}")
print(f"Stop threshold (raw) = {TARGET_NEWS_COUNT * CANDIDATE_MULTIPLIER}")
print(f"RELEVANCE_THRESHOLD = {RELEVANCE_THRESHOLD}")
print()

# Check provider selection order
selected = provider_router.select_providers(
    cached_article_count=0,
    target_count=TARGET_NEWS_COUNT,
)
print(f"Provider selection order: {selected}")
print()

# Now trace the waterfall manually
_l1_cache.clear()

all_providers = {p.name: p for p in get_all_providers()}
all_articles = []
provider_results = []

for i, provider_name in enumerate(selected):
    provider = all_providers.get(provider_name)
    if not provider or not provider.is_available():
        print(f"[{i+1}] {provider_name}: SKIPPED (not available)")
        provider_results.append({"provider": provider_name, "status": "skipped", "count": 0})
        continue

    if not budget_manager.can_call(provider_name):
        print(f"[{i+1}] {provider_name}: SKIPPED (quota exhausted)")
        provider_results.append({"provider": provider_name, "status": "quota_exhausted", "count": 0})
        continue

    try:
        t0 = time.perf_counter()
        result = provider.fetch(
            ticker=ticker,
            company=company,
            lookback_days=LOOKBACK_DAYS,
            max_results=10,
        )
        latency = (time.perf_counter() - t0) * 1000
        status = "success" if result.success else f"error: {result.error}"
        print(f"[{i+1}] {provider_name}: {status}  raw={len(result.articles)}  latency={latency:.0f}ms")

        provider_results.append({"provider": provider_name, "status": status, "count": len(result.articles)})
        if result.articles:
            all_articles.extend(result.articles)

        # Check stop condition
        should_stop = provider_router.should_stop_fetching(
            articles_collected=len(all_articles),
            target_count=TARGET_NEWS_COUNT,
            providers_called=len(provider_results),
        )
        print(f"     total_raw={len(all_articles)}  should_stop={should_stop}")

        if should_stop:
            print(f"     *** STOPPING WATERFALL ***")
            break

    except Exception as e:
        print(f"[{i+1}] {provider_name}: EXCEPTION: {e}")
        provider_results.append({"provider": provider_name, "status": f"error: {e}", "count": 0})

print(f"\nTotal raw candidates collected: {len(all_articles)}")

# Relevance
for article in all_articles:
    article.relevance_score = _score_relevance(article, company)
relevant = [a for a in all_articles if a.relevance_score >= RELEVANCE_THRESHOLD]
print(f"Relevant (>= {RELEVANCE_THRESHOLD}): {len(relevant)}")

# Dedup
unique = _deduplicate_articles(relevant)
print(f"After dedup: {len(unique)}")

# Rank
ranked = _rank_and_select_articles(unique, TARGET_NEWS_COUNT)
print(f"After rank: {len(ranked)}")

# Final
print(f"\n=== FINAL: {len(ranked)} articles ===")
for i, a in enumerate(ranked):
    print(f"  [{i+1}] rel={a.relevance_score:.3f}  prov={a.provider:10s}  {a.title[:60]}")
