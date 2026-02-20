import requests

for ticker in ['TSLA', 'NVDA', 'AAPL', 'AMZN']:
    print(f'=== {ticker} ===')
    try:
        r = requests.post('http://127.0.0.1:8000/api/data/sentiment', json={'ticker': ticker}, timeout=15)
        data = r.json()
        print(f"News count: {len(data.get('news', []))}")
        print(f"Score: {data.get('sentiment_score')}")
        print(f"Label: {data.get('sentiment_label')}")
        if data.get('news'):
            print(f"First: {data['news'][0]['title'][:50]}")
    except Exception as e:
        print(f'Error: {e}')
    print()
