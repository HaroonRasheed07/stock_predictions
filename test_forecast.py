import requests

for ticker in ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NFLX']:
    print(f"=== {ticker} ===")
    try:
        r = requests.post('http://127.0.0.1:8000/api/data/forecast', json={'ticker': ticker, 'days': 30}, timeout=15)
        data = r.json()
        print(f"Status: {data.get('status')}")
        if data.get('status') == 'success':
            print(f"Current: ${data.get('current_price')}")
            print(f"Predicted: ${data.get('predicted_price')}")
            print(f"Datapoints: {len(data.get('historical', []))}")
        else:
            print(f"Error: {data.get('error', data.get('detail', 'Unknown'))}")
    except Exception as e:
        print(f"Request Error: {e}")
    print()
