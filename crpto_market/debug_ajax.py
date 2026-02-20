import cloudscraper

def test_ajax(news_id):
    # Potential API endpoint derived from Vue config
    url = f"https://cryptopanic.com/news/click/{news_id}/"
    print(f"Testing AJAX Endpoint: {url}")
    
    try:
        scraper = cloudscraper.create_scraper()
        # Try GET
        resp = scraper.get(url, headers={"X-Requested-With": "XMLHttpRequest"}, timeout=10)
        print(f"GET Status: {resp.status_code}")
        print(f"GET Content: {resp.text[:500]}")
        
        try:
            data = resp.json()
            print("GET JSON:", data)
            if 'url' in data:
                print("SUCCESS: Found URL in JSON")
        except:
             print("GET response is not JSON")

        # Try POST just in case
        resp = scraper.post(url, headers={"X-Requested-With": "XMLHttpRequest", "X-CSRFToken": "dummy"}, timeout=10)
        print(f"POST Status: {resp.status_code}")
        
    except Exception as e:
        print(f"Error: {e}")

test_ajax(29009628)
