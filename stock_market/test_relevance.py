import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from news_engine.company_resolver import resolve_company
from news_engine.providers import get_all_providers
from news_engine.engine import _score_relevance

ticker = "AAPL"
company = resolve_company(ticker)
print("Company:", company.canonical_name, "aliases:", company.aliases)

providers = get_all_providers()
all_articles = []
for p in providers:
    if not p.is_available():
        print("%s: not available" % p.name)
        continue
    try:
        result = p.fetch(ticker=ticker, company=company, lookback_days=3, max_results=10)
        print("%s: %d articles (success=%s)" % (p.name, len(result.articles), result.success))
        for art in result.articles:
            rel = _score_relevance(art, company)
            print("  title=%s" % art.title[:60])
            print("  entities=%s" % art.matched_entities)
            print("  relevance=%.3f" % rel)
            art.relevance_score = rel
            all_articles.append(art)
    except Exception as e:
        print("%s: ERROR %s" % (p.name, e))

print("\nTotal: %d articles" % len(all_articles))
relevant = [a for a in all_articles if a.relevance_score >= 0.15]
print("Relevant (>=0.15): %d" % len(relevant))
for a in relevant:
    print("  [%.3f] %s" % (a.relevance_score, a.title[:60]))
