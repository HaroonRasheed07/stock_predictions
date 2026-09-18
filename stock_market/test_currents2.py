import os, sys, json, requests
from datetime import datetime, timezone, timedelta
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('stock_market/.env')
api_key = os.environ.get('CURRENTS_API_KEY', '')
start_date = (datetime.now(timezone.utc) - timedelta(days=3)).strftime('%Y-%m-%dT%H:%M:%SZ')

print(f"API key present: {bool(api_key)}")
print(f"start_date: {start_date}")
print()

for query in ['Apple', 'AAPL stock']:
    params = {'apiKey': api_key, 'keywords': query, 'language': 'en', 'start_date': start_date, 'category': 'business'}
    resp = requests.get('https://api.currentsapi.services/v1/search', params=params, timeout=12)
    data = resp.json()
    news = data.get('news', [])
    print(f"Query={query!r}: {len(news)} articles")
    for a in news[:5]:
        t = a.get("title", "")
        print(f"  - {t[:80]}")
    print()
