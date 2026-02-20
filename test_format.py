import requests
import json

base = 'http://127.0.0.1:8001'

# Test technical endpoint data format
r = requests.post(f'{base}/api/crypto/technical', json={'symbol':'BTC','days':90}, timeout=60)
data = r.json()
print('Technical keys:', list(data.keys()))
print('Data array length:', len(data.get('data', [])))
print('First data item:', data.get('data', [])[0] if data.get('data') else 'No data')
print()

# Test forecast endpoint data format  
r = requests.post(f'{base}/api/crypto/forecast', json={'symbol':'BTC','lookback_days':30}, timeout=60)
data = r.json()
print('Forecast keys:', list(data.keys()))
print('Timestamps length:', len(data.get('timestamps', [])))
print('Predicted returns length:', len(data.get('predictedReturns', [])))
print()

# Test sentiment endpoint data format
r = requests.post(f'{base}/api/crypto/sentiment', json={'symbol':'BTC'}, timeout=30)
data = r.json()
print('Sentiment keys:', list(data.keys()))
print('News length:', len(data.get('news', [])))
