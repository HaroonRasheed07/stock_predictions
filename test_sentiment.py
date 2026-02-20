import requests
import time

start = time.time()
r = requests.post('http://127.0.0.1:8001/api/crypto/sentiment', json={'symbol': 'BTC'}, timeout=30)
elapsed = time.time() - start
data = r.json()
print(f'Sentiment: {r.status_code} - {elapsed:.2f}s - News: {len(data.get("news", []))} articles')
