"""
diagnose_coverage.py — Full pipeline diagnostic for one ticker.
Traces every stage: providers → relevance → dedup → rank → final.
"""
import sys, os, time, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from stock_market.news_engine.engine import (
    _score_relevance, _deduplicate_articles, _rank_and_select_articles,
    _l1_cache, RELEVANCE_THRESHOLD, LOOKBACK_DAYS, TARGET_NEWS_COUNT as ENGINE_TARGET
)
from stock_market.news_engine.company_resolver import resolve_company, get_search_queries
from stock_market.news_engine.providers import get_all_providers
from stock_market.news_engine.provider_budget import budget_manager
from stock_market.news_engine.provider_router import provider_router, TARGET_NEWS_COUNT


def diagnose(ticker: str, force: bool = False):
    ticker = ticker.upper().strip()
    company = resolve_company(ticker)
    print(f"{'='*60}")
    print(f"  DIAGNOSTIC: {ticker}")
    print(f"{'='*60}")
    print(f"  Company: {company.canonical_name}")
    print(f"  Short:   {company.short_name}")
    print(f"  Aliases: {company.aliases}")
    print(f"  Queries: {get_search_queries(company)}")
    print()

    if force:
        _l1_cache.clear()

    # Provider availability
    print(f"--- PROVIDER AVAILABILITY ---")
    providers = get_all_providers()
    for p in providers:
        avail = p.is_available()
        budget_ok = budget_manager.can_call(p.name)
        print(f"  {p.name:12s} available={avail}  budget_ok={budget_ok}")
    print()

    # Fetch from each provider
    print(f"--- PROVIDER FETCH ---")
    all_articles = []
    provider_results = []

    for provider in providers:
        if not provider.is_available():
            print(f"  {provider.name:12s} SKIPPED (not available)")
            provider_results.append({"provider": provider.name, "status": "skipped", "count": 0})
            continue
        if not budget_manager.can_call(provider.name):
            print(f"  {provider.name:12s} SKIPPED (quota exhausted)")
            provider_results.append({"provider": provider.name, "status": "quota_exhausted", "count": 0})
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
            print(f"  {provider.name:12s} {status:30s} raw={len(result.articles):3d}  latency={latency:6.0f}ms")
            if result.articles:
                for i, a in enumerate(result.articles[:3]):
                    title = a.title[:70] if a.title else "(empty)"
                    pub = a.published_at[:19] if a.published_at else "NONE"
                    print(f"               [{i+1}] {title}")
                    print(f"                   publisher={a.publisher}  pub_at={pub}")
                if len(result.articles) > 3:
                    print(f"               ... and {len(result.articles) - 3} more")

            provider_results.append({"provider": provider.name, "status": status, "count": len(result.articles)})
            if result.articles:
                all_articles.extend(result.articles)
        except Exception as e:
            print(f"  {provider.name:12s} EXCEPTION: {e}")
            provider_results.append({"provider": provider.name, "status": f"error: {e}", "count": 0})

    raw_total = len(all_articles)
    print(f"\n  TOTAL RAW CANDIDATES: {raw_total}")
    print()

    # Relevance scoring
    print(f"--- RELEVANCE SCORING (threshold={RELEVANCE_THRESHOLD}) ---")
    for article in all_articles:
        article.relevance_score = _score_relevance(article, company)

    relevant = [a for a in all_articles if a.relevance_score >= RELEVANCE_THRESHOLD]
    rejected = [a for a in all_articles if a.relevance_score < RELEVANCE_THRESHOLD]

    print(f"  accepted:  {len(relevant)}")
    print(f"  rejected:  {len(rejected)}")

    if rejected:
        print(f"\n  REJECTED (relevance < {RELEVANCE_THRESHOLD}):")
        for i, a in enumerate(rejected[:15]):
            title = a.title[:60] if a.title else "(empty)"
            print(f"    [{i+1:2d}] rel={a.relevance_score:.3f}  {title}")

    if relevant:
        print(f"\n  RELEVANT ARTICLES:")
        for i, a in enumerate(relevant):
            title = a.title[:60] if a.title else "(empty)"
            print(f"    [{i+1:2d}] rel={a.relevance_score:.3f}  prov={a.provider:10s}  {title}")
    print()

    # Dedup
    print(f"--- DEDUP ---")
    unique = _deduplicate_articles(relevant)
    print(f"  before: {len(relevant)}")
    print(f"  after:  {len(unique)}")
    print()

    # Rank
    print(f"--- RANK + SELECT (target={TARGET_NEWS_COUNT}) ---")
    ranked = _rank_and_select_articles(unique, TARGET_NEWS_COUNT)
    print(f"  before rank: {len(unique)}")
    print(f"  after rank:  {len(ranked)}")
    print()

    # Final
    print(f"--- FINAL SELECTED ARTICLES ({len(ranked)}) ---")
    for i, a in enumerate(ranked):
        title = a.title[:70] if a.title else "(empty)"
        pub = a.published_at[:19] if a.published_at else "?"
        print(f"  [{i+1:2d}] rel={a.relevance_score:.3f}  prov={a.provider:10s}  pub={pub}")
        print(f"       {title}")

    # Coverage
    count = len(ranked)
    if count >= TARGET_NEWS_COUNT:
        coverage = "FULL"
    elif count >= 3:
        coverage = "PARTIAL"
    elif count >= 1:
        coverage = "INSUFFICIENT"
    else:
        coverage = "NONE"
    print(f"\n  COVERAGE: {coverage} ({count}/{TARGET_NEWS_COUNT})")

    # Summary JSON
    summary = {
        "ticker": ticker,
        "company": company.canonical_name,
        "providers": {r["provider"]: {"status": r["status"], "count": r["count"]} for r in provider_results},
        "raw_total": raw_total,
        "relevance_accepted": len(relevant),
        "relevance_rejected": len(rejected),
        "dedup_before": len(relevant),
        "dedup_after": len(unique),
        "ranked_before": len(unique),
        "ranked_after": len(ranked),
        "final_count": len(ranked),
        "coverage": coverage,
    }
    print(f"\n--- SUMMARY JSON ---")
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    tickers = sys.argv[1:] if len(sys.argv) > 1 else ["AAPL"]
    for t in tickers:
        diagnose(t, force=True)
        print("\n")
