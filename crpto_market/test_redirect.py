import requests

def test_redirect(news_id):
    # Try the 'click' endpoint pattern
    url = f"https://cryptopanic.com/news/{news_id}/click/"
    print(f"Testing URL: {url}")
    
    try:
        # Use a user-agent to avoid being blocked if necessary
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.head(url, headers=headers, allow_redirects=True, timeout=10)
        
        print(f"Final URL: {resp.url}")
        print(f"History: {[r.url for r in resp.history]}")
        
        if "cryptopanic.com" not in resp.url:
            print("SUCCESS: Redirected to external source.")
        else:
            print("FAILURE: Stayed on CryptoPanic (or redirected to another internal page).")
            
    except Exception as e:
        print(f"Error: {e}")

# ID from previous debug session
test_redirect(29009628)
