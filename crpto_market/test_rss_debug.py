
import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
import cloudscraper

def fetch_rss_news(coin: str, limit: int = 50) -> pd.DataFrame:
    """Fetch cryptocurrency news from top tier RSS feeds (Cointelegraph, Decrypt)."""
    feeds = [
        {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss"},
        {"name": "Decrypt", "url": "https://decrypt.co/feed"}
    ]
    
    all_rows = []
    
    # Coin keywords for filtering
    coin_keywords = {
        "BTC": ["bitcoin", "btc"],
        "ETH": ["ethereum", "eth"],
        "BNB": ["binance", "bnb"],
        "SOL": ["solana", "sol"],
        "XRP": ["ripple", "xrp"],
        "ADA": ["cardano", "ada"],
        "DOGE": ["dogecoin", "doge"],
        "DOT": ["polkadot", "dot"],
        "MATIC": ["polygon", "matic"],
        "AVAX": ["avalanche", "avax"],
        "LINK": ["chainlink", "link"],
        "SHIB": ["shiba", "shib"],
        "LTC": ["litecoin", "ltc"],
    }
    
    keywords = coin_keywords.get(coin.upper(), [coin.lower()])
    print(f"Keywords for {coin}: {keywords}")
    
    # Try cloudscraper first, then requests
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False
        }
    )

    for feed in feeds:
        try:
            print(f"Fetching {feed['name']} ({feed['url']})...")
            # Try scraper
            try:
                resp = scraper.get(feed["url"], timeout=15)
            except Exception as e:
                print(f"Cloudscraper failed for {feed['name']}: {e}. Trying requests...")
                resp = requests.get(feed["url"], timeout=15, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})
            
            if resp.status_code != 200:
                print(f"Failed to fetch {feed['name']}: HTTP {resp.status_code}")
                # Print snippet of response if not 200
                print(f"Response snippet: {resp.text[:500]}")
                continue
            
            # Use lxml if possible
            try:
                soup = BeautifulSoup(resp.content, "xml")
            except Exception:
                soup = BeautifulSoup(resp.content, "html.parser")
                
            items = soup.find_all("item")
            print(f"Found {len(items)} items in {feed['name']}")
            
            # Debug: print first item fields
            if items:
                it = items[0]
                print(f"Sample Item - Title: {it.title.text if it.title else 'N/A'}")
            
            for it in items:
                title = it.title.text if it.title else ""
                link = it.link.text if it.link else ""
                pub_date = it.pubDate.text if it.pubDate else ""
                
                # Check different tags for description/summary
                desc = ""
                if it.description:
                    desc = it.description.text
                elif it.find("content:encoded"):
                    desc = it.find("content:encoded").text
                
                # Simple keyword filtering
                text_to_check = (title + " " + desc).lower()
                matches_coin = any(k in text_to_check for k in keywords)
                
                if matches_coin or coin.upper() == "ALL":
                    all_rows.append({
                        "published_at": pd.to_datetime(pub_date, utc=True, errors='coerce'),
                        "title": title,
                        "url": link,
                        "source": feed["name"],
                        "description": desc,
                        "full_text": title + ". " + desc,
                        "is_fallback": False
                    })
        except Exception as e:
            print(f"Error fetching/parsing {feed['name']}: {e}")
            import traceback
            traceback.print_exc()
            continue
            
    # Fallback to general news if no coin-specific news found
    if not all_rows:
        print("No coin-specific news found, falling back to general news...")
        for feed in feeds:
            try:
                resp = scraper.get(feed["url"], timeout=10)
                soup = BeautifulSoup(resp.content, "xml")
                items = soup.find_all("item")[:20] # Take latest 20
                for it in items:
                    all_rows.append({
                        "published_at": pd.to_datetime(it.pubDate.text if it.pubDate else "", utc=True, errors='coerce'),
                        "title": it.title.text if it.title else "",
                        "url": it.link.text if it.link else "",
                        "source": feed["name"],
                        "description": it.description.text if it.description else "",
                        "full_text": (it.title.text if it.title else "") + ". " + (it.description.text if it.description else ""),
                        "is_fallback": True
                    })
            except Exception:
                continue

    df = pd.DataFrame(all_rows)
    if len(df) > 0:
        df = df.dropna(subset=["published_at"])
        df = df.sort_values("published_at", ascending=False).head(limit)
    return df

if __name__ == "__main__":
    # Test with BTC
    print("--- Testing BTC ---")
    btc_news = fetch_rss_news("BTC")
    print(f"BTC News count: {len(btc_news)}")
    
    # Test with a coin that might not be in news lately
    print("\n--- Testing RARE (Fallback) ---")
    rare_news = fetch_rss_news("RARE")
    print(f"RARE News count: {len(rare_news)}")
