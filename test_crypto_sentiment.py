import requests
import json

# Test crypto sentiment
print('=== CRYPTO SENTIMENT (BTC) ===')
r = requests.post('http://127.0.0.1:8001/api/crypto/sentiment', json={'symbol':'BTC'}, timeout=30)
data = r.json()
print('Status:', data.get('status'))
print('Score:', data.get('sentiment_score'))
print('Label:', data.get('sentiment_label'))
print('Positive:', data.get('positive_count'))
print('Negative:', data.get('negative_count'))
print('News count:', len(data.get('news', [])))
if data.get('news'):
    print('\nFirst 3 news items:')
    for item in data['news'][:3]:
        print(f"  - {item['title'][:60]}... (sentiment: {item.get('sentiment', 0):.2f})")
