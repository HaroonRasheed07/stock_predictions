import os, sys
os.remove('news_cache.db') if os.path.exists('news_cache.db') else None
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from news_engine.engine import get_sentiment_snapshot

s = get_sentiment_snapshot('AAPL', force_refresh=True)
d = s.to_legacy_dict()
print("status=%s label=%s score=%.3f articles=%d sources=%d" % (d["status"], d["label"], d["score"], d["news_count"], len(d["source_providers"])))
print("mood=%s" % d["market_mood"])
print("summary=%s" % d["news_impact_summary"])
print()
for i, a in enumerate(d['news'][:5]):
    print("  [%d] %s" % (i+1, a["title"][:80]))
    print("      source=%s sentiment=%.3f" % (a["source"], a.get("sentiment", 0)))
