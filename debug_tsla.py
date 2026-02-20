import requests

# Test TSLA specifically with debug
ticker = 'TSLA'
api_key = "pub_d4ca502ff69e478d991d8d30f9557d64"
url = f"https://newsdata.io/api/1/news?apikey={api_key}&q={ticker}&language=en&size=10"

print(f"Fetching: {url}")
response = requests.get(url, timeout=10)
print(f"Status: {response.status_code}")

news_json = response.json()
print(f"Keys: {news_json.keys()}")

if 'results' in news_json:
    print(f"Results count: {len(news_json['results'])}")
    if news_json['results']:
        for item in news_json['results'][:3]:
            print(f"  - {item.get('title', 'No title')[:60]}")
else:
    print(f"No results. Response: {news_json}")
