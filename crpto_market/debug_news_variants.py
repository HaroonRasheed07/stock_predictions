import requests
import json

def fetch(variant_name, url, params):
    print(f"\nTesting {variant_name}...")
    try:
        resp = requests.get(url, params=params, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            return
        
        data = resp.json()
        results = data.get("results") or data.get("data") or []
        print(f"Count: {len(results)}")
        
        if len(results) > 0:
            first = results[0]
            print("First item keys:", list(first.keys()))
            print(f"URL: {first.get('url')}")
            # print source safely
            src = first.get('source')
            if isinstance(src, dict):
                print(f"Source: {src}")
            else:
                print(f"Source (raw): {src}")
    except Exception as e:
        print(f"Error: {e}")

token = "4cd086bc8de6d4cb6d3fc10a1cf82c974b625896"

# 1. V2 with token
fetch("V2 with Token", "https://cryptopanic.com/api/developer/v2/posts/", 
      {"auth_token": token, "currencies": "BTC", "page": 1})

# 2. V2 Public (no token)
fetch("V2 Public", "https://cryptopanic.com/api/developer/v2/posts/", 
      {"currencies": "BTC", "public": "true", "page": 1})

# 3. V1 with token
fetch("V1 with Token", "https://cryptopanic.com/api/v1/posts/", 
      {"auth_token": token, "currencies": "BTC", "public": "true", "page": 1})
