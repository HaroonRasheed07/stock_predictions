import os, sys, json, requests
from datetime import datetime, timezone, timedelta
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('stock_market/.env')
api_key = os.environ.get('CURRENTS_API_KEY', '')
published_after = (datetime.now(timezone.utc) - timedelta(days=3)).strftime('%Y-%m-%dT%H:%M:%SZ')

for query in ['Apple', 'AAPL stock', 'Apple stock']:
    params = {'apiKey': api_key, 'keyword': query, 'language': 'en', 'published_after': published_after, 'category': 'business'}
    resp = requests.get('https://api.currentsapi.services/v1/search', params=params, timeout=12)
    data = resp.json()
    news = data.get('news', [])
    print(f"Query={query!r}: {len(news)} articles")
    for a in news[:3]:
        t = a.get("title", "")
        print(f"  - {t[:70]}")
    print()
