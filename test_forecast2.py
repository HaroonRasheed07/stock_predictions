import requests

for ticker in ['NVDA', 'AAPL', 'MSFT']:
    print(f"=== {ticker} ===")
    try:
        r = requests.post('http://127.0.0.1:8000/api/data/forecast', 
            json={'ticker': ticker, 'forecast_days': 10, 'period': '1y'}, 
            timeout=60)
        data = r.json()
        print(f"Full status: {data.get('status')}")
        if data.get('status') == 'success':
            results = data.get('results', {})
            actual = results.get('actual_prices', [])
            predicted = results.get('predicted_historical_prices', [])
            forecast = results.get('forecast_prices', [])
            dates = results.get('forecast_dates', [])
            print(f"Actual prices count: {len(actual)}")
            print(f"Predicted prices count: {len(predicted)}")
            print(f"Forecast prices count: {len(forecast)}")
            print(f"Forecast dates count: {len(dates)}")
            if actual:
                print(f"Current price (last actual): ${actual[-1]:.2f}")
            if forecast:
                print(f"Avg forecast: ${sum(forecast)/len(forecast):.2f}")
        else:
            print(f"Error: {data.get('detail', data.get('error', 'Unknown'))}")
    except Exception as e:
        print(f"Request Error: {e}")
    print()
