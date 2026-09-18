"""Test provider search quality for AAPL"""
import os, sys, json, requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

api_key = os.environ.get("CURRENTS_API_KEY", "")
print(f"Currents API key present: {bool(api_key)}")

published_after = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S")

# Test 1: keyword = "Apple Inc."
print("\n=== CURRENTS: keyword='Apple Inc.' ===")
params = {
    "apiKey": api_key,
    "keyword": "Apple Inc.",
    "language": "en",
    "published_after": published_after,
}
resp = requests.get("https://api.currentsapi.services/v1/search", params=params, timeout=12)
print(f"Status: {resp.status_code}")
data = resp.json()
news = data.get("news", [])
print(f"Articles: {len(news)}")
for i, a in enumerate(news[:5]):
    t = a.get("title", "")
    print(f"  [{i+1}] {t[:80]}")

# Test 2: keyword = "AAPL stock"
print("\n=== CURRENTS: keyword='AAPL stock' ===")
params2 = {
    "apiKey": api_key,
    "keyword": "AAPL stock",
    "language": "en",
    "published_after": published_after,
}
resp2 = requests.get("https://api.currentsapi.services/v1/search", params=params2, timeout=12)
data2 = resp2.json()
news2 = data2.get("news", [])
print(f"Articles: {len(news2)}")
for i, a in enumerate(news2[:5]):
    t = a.get("title", "")
    print(f"  [{i+1}] {t[:80]}")

# Test 3: keyword = "Apple stock earnings"
print("\n=== CURRENTS: keyword='Apple stock news' ===")
params3 = {
    "apiKey": api_key,
    "keyword": "Apple stock news",
    "language": "en",
    "published_after": published_after,
}
resp3 = requests.get("https://api.currentsapi.services/v1/search", params=params3, timeout=12)
data3 = resp3.json()
news3 = data3.get("news", [])
print(f"Articles: {len(news3)}")
for i, a in enumerate(news3[:5]):
    t = a.get("title", "")
    print(f"  [{i+1}] {t[:80]}")

# Also test NewsData search quality
print("\n=== NEWSDATA: q='Apple Inc.' ===")
nd_key = os.environ.get("NEWSDATA_API_KEY", "")
nd_url = f"https://newsdata.io/api/1/news?apikey={nd_key}&q=Apple%20Inc.&language=en&category=business&size=10"
nd_resp = requests.get(nd_url, timeout=10)
nd_data = nd_resp.json()
nd_results = nd_data.get("results", [])
print(f"Articles: {len(nd_results)}")
for i, a in enumerate(nd_results[:5]):
    t = a.get("title", "")
    sid = a.get("source_id", "")
    print(f"  [{i+1}] [{sid}] {t[:70]}")
