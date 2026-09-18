"""Run full engine pipeline for key tickers and print QA lists"""
import os, sys, json, time, logging
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "stock_market", ".env"))
logging.basicConfig(level=logging.WARNING)

# Fix Windows console encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from stock_market.news_engine.engine import get_sentiment_snapshot, _l1_cache, TARGET_NEWS_COUNT

TICKERS = ["AAPL", "NVDA", "GOOGL", "META", "CSCO"]

for ticker in TICKERS:
    _l1_cache.clear()
    t0 = time.perf_counter()
    snapshot = get_sentiment_snapshot(ticker, force_refresh=True)
    elapsed = (time.perf_counter() - t0) * 1000
    
    count = len(snapshot.articles)
    if count >= TARGET_NEWS_COUNT:
        cov = "FULL"
    elif count >= 3:
        cov = "PARTIAL"
    elif count >= 1:
        cov = "INSUFFICIENT"
    else:
        cov = "NONE"
    
    print(f"\n{'='*60}")
    print(f"  {ticker} -- {snapshot.company_name}")
    print(f"  Status: {snapshot.status.value} | Coverage: {cov} ({count}/{TARGET_NEWS_COUNT})")
    print(f"  Score: {snapshot.score:.3f} | Label: {snapshot.label.value}")
    print(f"  Providers: {snapshot.providers_attempted}")
    print(f"  Processing: {elapsed:.0f}ms")
    print(f"{'='*60}")
    
    for i, a in enumerate(snapshot.articles[:8]):
        title = a.title[:65] if a.title else "(empty)"
        print(f"  [{i+1:2d}] rel={a.relevance_score:.3f}  {title}")
        print(f"       score={a.rule_score:.3f}  label={a.finbert_label}")
