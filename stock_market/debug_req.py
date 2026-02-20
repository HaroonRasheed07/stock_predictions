import requests
import json

try:
    response = requests.post(
        "http://localhost:8000/api/data/indicators",
        json={"ticker": "AAPL", "period": "1y"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
