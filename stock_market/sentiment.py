import requests
import numpy as np
import sys
import os
import time
from urllib.parse import quote

# Add parent directory to path for shared modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared_sentiment import analyze_news_sentiment, score_text_keywords

# --- Sentiment cache (10-minute TTL) ---
_sentiment_cache: dict = {}
_SENTIMENT_CACHE_TTL = 600  # 10 minutes


def analyze_sentiment(ticker):
    """
    Analyze sentiment for a ticker using newsdata.io API.
    Results are cached for 10 minutes to avoid repeated slow API calls.
    Returns: dict with score, label, positive_count, negative_count, news
    """
    # Check cache first
    cache_key = f"sentiment_{ticker}"
    if cache_key in _sentiment_cache:
        ts, cached = _sentiment_cache[cache_key]
        if time.time() - ts < _SENTIMENT_CACHE_TTL:
            return cached

    try:
        api_key = "pub_d4ca502ff69e478d991d8d30f9557d64"
        # URL-encode the ticker to handle special chars like =, ^, etc.
        # e.g. "GC=F" -> "GC%3DF", "^GSPC" -> "%5EGSPC"
        encoded_ticker = quote(ticker, safe="")
        url = f"https://newsdata.io/api/1/news?apikey={api_key}&q={encoded_ticker}&language=en&size=10"
        response = requests.get(url, timeout=10)
        news_json = response.json()

        if 'results' in news_json and len(news_json['results']) > 0:
            # Format news items
            news_items = []
            for article in news_json['results'][:10]:
                news_items.append({
                    "title": article.get('title', 'No Title'),
                    "source": article.get('source_id', 'Unknown'),
                    "url": article.get('link', '#'),
                    "published_at": article.get('pubDate', ''),
                    "full_text": (article.get('title') or '') + ' ' + (article.get('description') or '')
                })
            
            # Use shared sentiment analyzer
            result = analyze_news_sentiment(news_items)
            
            # Synthesize trend (mocked for past 7 days based on current sentiment for demo)
            base_score = result["sentiment_score"]
            import random
            trend_7d = [
                {"date": f"Day {-i}", "score": max(-1.0, min(1.0, base_score + random.uniform(-0.2, 0.2)))}
                for i in range(7, 0, -1)
            ]
            
            # Market mood
            if base_score > 0.3:
                mood = "Bullish"
            elif base_score > 0.1:
                mood = "Slightly Bullish"
            elif base_score < -0.3:
                mood = "Bearish"
            elif base_score < -0.1:
                mood = "Slightly Bearish"
            else:
                mood = "Mixed/Neutral"

            sentiment_result = {
                "score": base_score,
                "label": result["sentiment_label"],
                "positive_count": result["positive_count"],
                "negative_count": result["negative_count"],
                "news": result["news"],
                "sentiment_trend_7d": trend_7d,
                "news_impact_summary": f"Recent headlines show a {mood.lower()} sentiment. Positive mentions: {result['positive_count']}, Negative mentions: {result['negative_count']}.",
                "market_mood": mood
            }
            _sentiment_cache[cache_key] = (time.time(), sentiment_result)
            return sentiment_result
        else:
            # No news found, return neutral
            neutral_result = {
                "score": 0.0,
                "label": "Neutral",
                "positive_count": 0,
                "negative_count": 0,
                "news": [],
                "sentiment_trend_7d": [],
                "news_impact_summary": "No recent news found for this asset.",
                "market_mood": "Unknown"
            }
            _sentiment_cache[cache_key] = (time.time(), neutral_result)
            return neutral_result
    
    except Exception as e:
        print(f"Sentiment analysis error: {str(e)}")
        # Return neutral on error
        return {
            "score": 0.0,
            "label": "Neutral",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
            "sentiment_trend_7d": [],
            "news_impact_summary": "Error fetching sentiment data.",
            "market_mood": "Unknown"
        }


def show_sentiment_analysis(ticker):
    """Streamlit display function - not used by API."""
    import streamlit as st
    st.subheader("News Sentiment Analysis ")
    result = analyze_sentiment(ticker)
    
    col1, col2, col3 = st.columns(3)
    col1.metric("Sentiment", result["label"], f"{result['score']:.2f}")
    col2.metric("Positive", result["positive_count"])
    col3.metric("Negative", result["negative_count"])
    
    if result["news"]:
        st.write("### Headlines:")
        for item in result["news"][:5]:
            emoji = "🟢" if item.get("sentiment", 0) > 0.1 else "🔴" if item.get("sentiment", 0) < -0.1 else "🟡"
            st.write(f"{emoji} {item['title']} ({item.get('source', 'Unknown')})")
    else:
        st.warning("No news data returned.")

