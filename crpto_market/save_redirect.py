import requests

def save_redirect_html(news_id):
    url = f"https://cryptopanic.com/news/{news_id}/click/"
    print(f"Fetching {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        with open("e:/fyp_web/crpto3/redirect_dump.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("Saved to redirect_dump.html")
    except Exception as e:
        print(f"Error: {e}")

save_redirect_html(29009628)
