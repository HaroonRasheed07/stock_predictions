import requests

base = 'http://localhost:3001'

# Test technical
r = requests.post(f'{base}/api/crypto/technical', json={'symbol':'BTC','days':90}, timeout=60)
d = r.json()
print(f"Technical: status={d.get('status')}, data={len(d.get('data',[]))} points, rsi={d.get('latestRSI')}")

# Test forecast
r = requests.post(f'{base}/api/crypto/forecast', json={'symbol':'BTC','lookback_days':30}, timeout=60)
d = r.json()
print(f"Forecast: status={d.get('status')}, timestamps={len(d.get('timestamps',[]))}")

# Test sentiment
r = requests.post(f'{base}/api/crypto/sentiment', json={'symbol':'BTC'}, timeout=60)
d = r.json()
print(f"Sentiment: status={d.get('status')}, news={len(d.get('news',[]))}")
