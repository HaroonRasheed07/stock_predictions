import requests
import sys
import os

# Add parent directory to path for shared modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared_sentiment import analyze_news_sentiment

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
    
    # Format news items exactly like sentiment.py
    news_items = []
    for article in news_json['results'][:10]:
        news_items.append({
            "title": article.get('title', 'No Title'),
            "source": article.get('source_id', 'Unknown'),
            "url": article.get('link', '#'),
            "published_at": article.get('pubDate', ''),
            "full_text": article.get('title', '') + ' ' + article.get('description', '')
        })
    
    print(f"Formatted items: {len(news_items)}")
    
    try:
        result = analyze_news_sentiment(news_items)
        print(f"Result: {result}")
    except Exception as e:
        print(f"ERROR in analyze_news_sentiment: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"No results. Response: {news_json}")
