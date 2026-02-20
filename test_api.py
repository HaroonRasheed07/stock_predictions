import requests
import time
import sys

def test_endpoint(name, url, payload):
    try:
        start = time.time()
        r = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start
        if r.status_code == 200:
            data = r.json()
            if name == "technical":
                points = len(data.get('data', []))
                print(f"✓ {name}: {elapsed:.2f}s - {points} data points")
            elif name == "overview":
                price = data.get('livePrice')
                print(f"✓ {name}: {elapsed:.2f}s - BTC ${price:,.2f}")
            elif name == "forecast":
                acc = data.get('accuracy', 0)
                print(f"✓ {name}: {elapsed:.2f}s - Accuracy: {acc:.1f}%")
            else:
                print(f"✓ {name}: {elapsed:.2f}s - OK")
            return True
        else:
            print(f"✗ {name}: HTTP {r.status_code}")
            return False
    except Exception as e:
        print(f"✗ {name}: {e}")
        return False

base = "http://127.0.0.1:8001"
print("Testing Crypto API Endpoints...")
print("-" * 40)

# Test all endpoints
test_endpoint("technical", f"{base}/api/crypto/technical", {"symbol": "BTC", "days": 90})
test_endpoint("overview", f"{base}/api/crypto/overview", {"symbol": "BTC"})
test_endpoint("forecast", f"{base}/api/crypto/forecast", {"symbol": "BTC", "lookback_days": 30})

print("-" * 40)
print("Testing cached responses...")
test_endpoint("technical (cached)", f"{base}/api/crypto/technical", {"symbol": "BTC", "days": 90})
test_endpoint("overview (cached)", f"{base}/api/crypto/overview", {"symbol": "BTC"})

print("-" * 40)
print("All tests complete!")
