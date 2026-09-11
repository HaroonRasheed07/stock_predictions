import time
import sys
import os
import logging

# Add parent directory to path for shared modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared_sentiment import analyze_news_sentiment

logger = logging.getLogger(__name__)

# --- Sentiment cache (10-minute TTL) ---
_sentiment_cache: dict = {}
_SENTIMENT_CACHE_TTL = 600  # 10 minutes


def analyze_sentiment(ticker):
    """
    Analyze sentiment for a ticker using multi-source news providers.
    Falls back: NewsData.io -> GDELT -> Alpha Vantage.
    Results are cached for 10 minutes.
    Returns: dict with score, label, positive_count, negative_count, news
    """
    cache_key = f"sentiment_{ticker}"
    if cache_key in _sentiment_cache:
        ts, cached = _sentiment_cache[cache_key]
        if time.time() - ts < _SENTIMENT_CACHE_TTL:
            return cached

    try:
        # Use multi-source news aggregator (NewsData -> GDELT -> AlphaVantage)
        from news_providers import news_aggregator
        articles = news_aggregator.fetch_news(ticker, max_results=10)

        if articles:
            # Convert NormalizedArticle objects to dicts for shared_sentiment
            news_items = [a.__dict__ for a in articles]

            # Score sentiment using keyword-based analyzer
            result = analyze_news_sentiment(news_items)

            base_score = result["sentiment_score"]

            # Synthesize 7-day trend (mocked — Phase 3 will replace with real history)
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
                "news_impact_summary": (
                    f"Recent headlines show a {mood.lower()} sentiment. "
                    f"Positive mentions: {result['positive_count']}, "
                    f"Negative mentions: {result['negative_count']}."
                ),
                "market_mood": mood,
            }
            _sentiment_cache[cache_key] = (time.time(), sentiment_result)
            return sentiment_result
        else:
            neutral_result = {
                "score": 0.0,
                "label": "Neutral",
                "positive_count": 0,
                "negative_count": 0,
                "news": [],
                "sentiment_trend_7d": [],
                "news_impact_summary": "No recent news found for this asset.",
                "market_mood": "Unknown",
            }
            _sentiment_cache[cache_key] = (time.time(), neutral_result)
            return neutral_result

    except Exception as e:
        logger.error(f"Sentiment analysis error for {ticker}: {e}")
        return {
            "score": 0.0,
            "label": "Neutral",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
            "sentiment_trend_7d": [],
            "news_impact_summary": "Error fetching sentiment data.",
            "market_mood": "Unknown",
        }


def show_sentiment_analysis(ticker):
    """Streamlit display function - not used by API."""
    import streamlit as st
    st.subheader("News Sentiment Analysis")
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
