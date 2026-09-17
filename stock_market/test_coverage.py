import os, sys
os.remove('news_cache.db') if os.path.exists('news_cache.db') else None
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from news_engine.engine import get_sentiment_snapshot

tickers = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'TSLA', 'AMD', 'NFLX', 'IBM', 'JPM', 'DIS']
results = {}
for t in tickers:
    s = get_sentiment_snapshot(t, force_refresh=True)
    d = s.to_legacy_dict()
    results[t] = d
    print("%s: status=%s label=%s score=%.3f articles=%d sources=%d" % (
        t, d["status"], d["label"], d["score"], d["news_count"], len(d["source_providers"])))

print()
sufficient = sum(1 for r in results.values() if r['status'] == 'sufficient')
insufficient = sum(1 for r in results.values() if r['status'] in ('insufficient', 'no_relevant_news'))
error = sum(1 for r in results.values() if r['status'] in ('error', 'news_unavailable'))
print("COVERAGE: %d/%d sufficient, %d insufficient, %d error" % (sufficient, len(tickers), insufficient, error))
