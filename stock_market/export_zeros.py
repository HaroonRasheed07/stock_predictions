"""
export_zeros.py — Export all zero-score articles from the 50-stock benchmark.
Collects ArticleSentiment objects from snapshots, plus description from DB.
"""
import os, sys, json, io, sqlite3, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "stock_market", ".env"))

import logging
logging.basicConfig(level=logging.WARNING)

from stock_market.news_engine.engine import get_sentiment_snapshot, _l1_cache

TICKERS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
    "NFLX", "CSCO", "IBM", "ORCL", "CRM", "ADBE", "AVGO", "QCOM",
    "INTC", "MU", "TXN", "AMAT",
    "JPM", "BAC", "GS", "MS", "V", "MA",
    "XOM", "CVX", "COP",
    "WMT", "COST", "TGT", "HD", "LOW", "KO", "PEP", "MCD", "SBUX",
    "JNJ", "PFE", "MRK", "LLY", "ABBV", "UNH",
    "CAT", "DE", "BA", "GE",
    "DIS", "CMCSA",
]

# Build description lookup from DB
db_path = os.path.join(os.path.dirname(__file__), "news_cache.db")
conn = sqlite3.connect(db_path)
desc_lookup = {}
for row in conn.execute("SELECT title, description FROM news_articles"):
    desc_lookup[row[0]] = row[1] or ""
conn.close()

all_zero = []
all_articles = []

for i, ticker in enumerate(TICKERS):
    _l1_cache.clear()
    try:
        snapshot = get_sentiment_snapshot(ticker, force_refresh=False)
        for a in snapshot.articles:
            description = desc_lookup.get(a.title, "")
            article = {
                "ticker": ticker,
                "headline": a.title,
                "description": description[:500] if description else "",
                "source": a.publisher,
                "published_at": a.published_at,
                "relevance_score": round(a.relevance_score, 3),
                "detected_events": a.events or [],
                "matched_phrases": a.matched_phrases if hasattr(a, 'matched_phrases') else [],
                "rule_score": round(a.rule_score, 4),
                "finbert_label": a.finbert_label or "neutral",
            }
            all_articles.append(article)
            if abs(a.rule_score) < 0.001:
                all_zero.append(article)
        print(f"[{i+1:2d}/{len(TICKERS)}] {ticker}: {len(snapshot.articles)} articles, "
              f"{sum(1 for a in snapshot.articles if abs(a.rule_score) < 0.001)} zero")
    except Exception as e:
        print(f"[{i+1:2d}/{len(TICKERS)}] {ticker}: ERROR {e!s:.50s}")

print(f"\nTotal articles: {len(all_articles)}")
print(f"Zero-score articles: {len(all_zero)}")
if all_articles:
    print(f"Zero-score rate: {len(all_zero)/len(all_articles)*100:.1f}%")

# Export zero-score
output_path = os.path.join(os.path.dirname(__file__), "zero_score_articles.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_zero, f, indent=2, ensure_ascii=False)
print(f"\nExported {len(all_zero)} zero-score articles to {output_path}")

# Export all
all_path = os.path.join(os.path.dirname(__file__), "all_articles.json")
with open(all_path, "w", encoding="utf-8") as f:
    json.dump(all_articles, f, indent=2, ensure_ascii=False)
print(f"All {len(all_articles)} articles exported to {all_path}")
