import os, sys, time
os.remove('news_cache.db') if os.path.exists('news_cache.db') else None
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from news_engine.engine import get_sentiment_snapshot, _l1_cache, _sqlite_get_snapshot

print("=" * 60)
print("TEST 1: CONSISTENCY — same snapshot returned on repeated calls")
print("=" * 60)
for t in ['AAPL', 'NVDA', 'AMD']:
    s1 = get_sentiment_snapshot(t, force_refresh=True)
    s2 = get_sentiment_snapshot(t)
    d1 = s1.to_legacy_dict()
    d2 = s2.to_legacy_dict()
    match = d1["score"] == d2["score"] and d1["label"] == d2["label"] and d1["status"] == d2["status"]
    print("%s: score=%.3f label=%s status=%s -> consistent=%s" % (t, d1["score"], d1["label"], d1["status"], match))

print()
print("=" * 60)
print("TEST 2: QUOTA — 5 repeated requests should NOT waste API calls")
print("=" * 60)
from news_engine.providers import get_all_providers
providers = get_all_providers()
for p in providers:
    p._metrics = {"total_calls": 0, "successes": 0, "failures": 0, "total_latency_ms": 0.0}

for i in range(5):
    get_sentiment_snapshot('AAPL')

for p in providers:
    m = p._metrics
    print("%s: calls=%d successes=%d" % (p.name, m["total_calls"], m["successes"]))

print()
print("=" * 60)
print("TEST 3: PERFORMANCE — cold vs warm cache")
print("=" * 60)
# Cold
os.remove('news_cache.db') if os.path.exists('news_cache.db') else None
from news_engine.engine import _l1_cache
_l1_cache.clear()

start = time.time()
get_sentiment_snapshot('TSLA', force_refresh=True)
cold_ms = (time.time() - start) * 1000

# Warm L1
start = time.time()
get_sentiment_snapshot('TSLA')
warm_l1_ms = (time.time() - start) * 1000

# Clear L1, keep SQLite
_l1_cache.clear()
start = time.time()
get_sentiment_snapshot('TSLA')
warm_sqlite_ms = (time.time() - start) * 1000

print("Cold cache: %.0fms" % cold_ms)
print("Warm L1: %.0fms" % warm_l1_ms)
print("Warm SQLite (L1 miss): %.0fms" % warm_sqlite_ms)

print()
print("=" * 60)
print("TEST 4: SECURITY — no API keys in snapshot output")
print("=" * 60)
s = get_sentiment_snapshot('AAPL')
d = s.to_legacy_dict()
import json
output = json.dumps(d)
has_key = any(k in output for k in ["VJ6TuI", "YknDkuC", "pub_d4ca"])
print("Keys leaked in snapshot: %s" % ("YES — PROBLEM" if has_key else "NO — SAFE"))

print()
print("=" * 60)
print("TEST 5: FRONTEND BUILD")
print("=" * 60)
os.chdir(os.path.join(os.path.dirname(__file__), "..", "Market-Analysis-project-"))
ret = os.system("npx tsc --noEmit")
print("TypeScript: %s" % ("PASS" if ret == 0 else "FAIL"))
ret = os.system("npm run build")
print("Next.js build: %s" % ("PASS" if ret == 0 else "FAIL"))
