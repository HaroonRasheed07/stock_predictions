import cloudscraper
from bs4 import BeautifulSoup
import re

def test_bypass(news_id):
    url = f"https://cryptopanic.com/news/{news_id}/click/"
    print(f"Testing Cloudscraper on: {url}")
    
    try:
        scraper = cloudscraper.create_scraper()
        resp = scraper.get(url, timeout=10)
        
        print(f"Status: {resp.status_code}")
        
        soup = BeautifulSoup(resp.text, 'lxml')
        meta_refresh = soup.find('meta', attrs={'http-equiv': re.compile("^refresh$", re.I)})
        
        if meta_refresh:
            content = meta_refresh.get('content', '')
            print(f"Meta Refresh Content: {content}")
            if "url=" in content.lower():
                target = re.split(r'url=', content, flags=re.I)[-1].strip()
                print(f"Target URL: {target}")
        else:
            print("No meta refresh found.")
            print(f"Final URL: {resp.url}")
            # check title to see if we are still on Cloudflare page
            if "Just a moment" in soup.title.text if soup.title else "":
                print("STILL BLOCKED by Cloudflare.")
            else:
                 print(f"Title: {soup.title.text if soup.title else 'No title'}")

    except Exception as e:
        print(f"Error: {e}")

test_bypass(29009628)
