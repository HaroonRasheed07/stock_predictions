"""Debug the engine pipeline step by step."""
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

print(f"MARKETAUX_API_KEY={'set' if os.environ.get('MARKETAUX_API_KEY') else 'NOT SET'}")
print(f"CURRENTS_API_KEY={'set' if os.environ.get('CURRENTS_API_KEY') else 'NOT SET'}")
print(f"NEWSDATA_API_KEY={'set' if os.environ.get('NEWSDATA_API_KEY') else 'NOT SET'}")

from news_engine.company_resolver import resolve_company
from news_engine.providers import get_all_providers

ticker = "AAPL"
print(f"\nTesting {ticker}...")

company = resolve_company(ticker)
print(f"Company: '{company.canonical_name}' short='{company.short_name}' aliases={company.aliases}")

providers = get_all_providers()
for p in providers:
    avail = p.is_available()
    print(f"\n{p.name}: is_available={avail}")
    if avail:
        try:
            result = p.fetch(ticker=ticker, company=company, lookback_days=3, max_results=5)
            print(f"  fetch: success={result.success} articles={len(result.articles)} error={result.error}")
            for i, art in enumerate(result.articles[:3]):
                print(f"    [{i+1}] {art.title[:80]}")
                print(f"        entities={art.matched_entities[:3]} relevance={art.relevance_score:.2f}")
        except Exception as e:
            print(f"  fetch ERROR: {e}")
