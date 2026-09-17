"""Cross-page consistency test."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath('.')))

from news_engine.engine import get_sentiment_snapshot
from sentiment import analyze_sentiment

tickers = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA']
print("=== Cross-Page Consistency Test ===")
print(f"{'Ticker':8s} {'snapshot_label':16s} {'analyze_label':16s} {'Match':>6s}")
print("-" * 50)

for t in tickers:
    snap = get_sentiment_snapshot(t, force_refresh=False)
    api = analyze_sentiment(t)
    snap_label = snap.label.value
    api_label = api.get('label', 'N/A')
    match = snap_label == api_label
    status = "OK" if match else "MISMATCH"
    print(f"{t:8s} {snap_label:16s} {api_label:16s} {status:>6s}")

# Test sentiment history
print("\n=== Sentiment History Test ===")
from news_engine.engine import get_sentiment_history
for t in ['AAPL', 'MSFT']:
    history = get_sentiment_history(t, "7d")
    print(f"{t}: {len(history)} history points")

# Test market status
print("\n=== Market Status Test ===")
from market_status import get_market_status, is_market_open
ms = get_market_status()
print(f"Status: {ms['status']}")
print(f"Label: {ms['label']}")
print(f"Is open: {is_market_open()}")
print(f"Next open: {ms.get('next_open', 'N/A')}")
