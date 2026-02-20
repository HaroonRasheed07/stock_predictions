import requests
import json

# Test stock sentiment
print('=== STOCK SENTIMENT (NVDA) ===')
r = requests.post('http://127.0.0.1:8000/api/data/sentiment', json={'ticker':'NVDA'}, timeout=30)
data = r.json()
print('Score:', data.get('score'))
print('Label:', data.get('label'))
print('Positive:', data.get('positive_count'))
print('Negative:', data.get('negative_count'))
print('News count:', len(data.get('news', [])))
if data.get('news'):
    print('\nFirst 3 news items:')
    for item in data['news'][:3]:
        print(f"  - {item['title'][:60]}... (sentiment: {item.get('sentiment', 0):.2f})")
else:
    print('No news returned')
    print('Full response:', data)
