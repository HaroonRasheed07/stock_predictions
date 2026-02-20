import requests
import re

def check_detail_page(news_id, slug):
    url = f"https://cryptopanic.com/news/{news_id}/{slug}"
    print(f"Fetching {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        content = resp.text
        print(f"Status: {resp.status_code}")
        
        # Look for the source link.
        # Often it's in a specific class or element.
        # Let's dump a few lines or search for common patterns.
        
        # Pattern 1: a link that looks like a source
        # In CryptoPanic, it's often <a href="..." class="source-link" ...> or similar
        # But simple regex search:
        
        # Regex to find http/https links that are NOT cryptopanic.com
        # This is noisy, so I'll just check for common strings near "Source"
        
        if "description-body" in content:
            print("Found description-body")
            
        print("\n--- Searching for links ---")
        # Very rough extraction of all hrefs
        links = re.findall(r'href=["\'](http[^"\']+)["\']', content)
        external_links = [l for l in links if "cryptopanic.com" not in l and "facebook" not in l and "twitter" not in l]
        
        for l in external_links[:10]:
            print(f"External: {l}")
            
    except Exception as e:
        print(f"Error: {e}")

check_detail_page(29009628, "Luxury-Watch-Prices-Rise-Amid-Economic-Challenges")
