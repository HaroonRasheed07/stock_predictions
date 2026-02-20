import requests

def inspect_click_page(news_id):
    url = f"https://cryptopanic.com/news/{news_id}/click/"
    print(f"Fetching content from: {url}")
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        # validation=False? No, strictly get content
        resp = requests.get(url, headers=headers, timeout=10)
        
        print(f"Status Code: {resp.status_code}")
        content = resp.text
        
        if 'http-equiv="refresh"' in content.lower():
            print("FOUND: Meta Refresh")
        if 'window.location' in content:
            print("FOUND: JS Redirect (window.location)")
            
        # Print a snippet to be sure
        print("\n--- Snippet ---")
        print(content[:1000])

    except Exception as e:
        print(f"Error: {e}")

inspect_click_page(29009628)
