"""Debug individual provider responses."""
import sys
import os
import requests
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Test each provider directly
ticker = "AAPL"
company_name = "Apple Inc."

print("=" * 60)
print("1. NEWSDATA.IO")
print("=" * 60)
api_key = os.environ.get("NEWSDATA_API_KEY", "")
url = f"https://newsdata.io/api/1/news?apikey={api_key}&q={company_name}&language=en&size=5"
try:
    resp = requests.get(url, timeout=15)
    data = resp.json()
    print(f"  Status: {resp.status_code}")
    results = data.get("results", [])
    print(f"  Articles: {len(results)}")
    for i, art in enumerate(results[:3]):
        print(f"  [{i+1}] {art.get('title', 'N/A')[:80]}")
        print(f"      Source: {art.get('source_id', 'N/A')}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("2. MARKETAUX")
print("=" * 60)
mk_key = os.environ.get("MARKETAUX_API_KEY", "")
url = f"https://api.marketaux.com/v1/news/all?api_token={mk_key}&symbols={ticker}&language=en&limit=5"
try:
    resp = requests.get(url, timeout=15)
    data = resp.json()
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  Response: {json.dumps(data, indent=2)[:500]}")
    else:
        articles = data.get("data", [])
        print(f"  Articles: {len(articles)}")
        for i, art in enumerate(articles[:3]):
            print(f"  [{i+1}] {art.get('title', 'N/A')[:80]}")
            print(f"      Source: {art.get('source', 'N/A')}")
            entities = art.get("entities", [])
            if entities:
                for e in entities:
                    print(f"      Entity: {e.get('name', '')} ({e.get('symbol', '')}) sent={e.get('sentiment', '')}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("3. CURRENTS")
print("=" * 60)
curr_key = os.environ.get("CURRENTS_API_KEY", "")
url = f"https://api.currentsapi.services/v1/search?apiKey={curr_key}&keyword={company_name}&language=en"
try:
    resp = requests.get(url, timeout=15)
    data = resp.json()
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  Response: {json.dumps(data, indent=2)[:500]}")
    else:
        news = data.get("news", [])
        print(f"  Articles: {len(news)}")
        for i, art in enumerate(news[:3]):
            print(f"  [{i+1}] {art.get('title', 'N/A')[:80]}")
            print(f"      Source: {art.get('source', 'N/A')}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("4. GDELT")
print("=" * 60)
url = f"https://api.gdeltproject.org/api/v2/doc/doc?query=%22{company_name}%22&mode=ArtList&maxrecords=5&format=json&sort=DateDesc&timespan=3d&sourcelang=eng"
try:
    resp = requests.get(url, timeout=15, headers={"User-Agent": "StockVanta/1.0"})
    data = resp.json()
    articles = data.get("articles", [])
    print(f"  Status: {resp.status_code}")
    print(f"  Articles: {len(articles)}")
    for i, art in enumerate(articles[:3]):
        print(f"  [{i+1}] {art.get('title', 'N/A')[:80]}")
        print(f"      Domain: {art.get('domain', 'N/A')}")
except Exception as e:
    print(f"  ERROR: {e}")
