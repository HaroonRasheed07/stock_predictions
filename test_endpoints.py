import requests

base = 'http://127.0.0.1:8001'

# Test all endpoints
for endpoint, payload in [
    ('technical', {'symbol':'BTC','days':90}),
    ('overview', {'symbol':'BTC'}),
    ('sentiment', {'symbol':'BTC'}),
    ('forecast', {'symbol':'BTC','lookback_days':30})
]:
    try:
        r = requests.post(f'{base}/api/crypto/{endpoint}', json=payload, timeout=60)
        data = r.json()
        status = data.get('status', 'no status')
        print(f'{endpoint}: HTTP {r.status_code} - status={status}')
    except Exception as e:
        print(f'{endpoint}: ERROR - {e}')
