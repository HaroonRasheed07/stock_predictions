"""
sentiment.py — Sentiment analysis facade.

Routes through the new news_engine for canonical sentiment.
Legacy callers continue to work unchanged.
"""

import time
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Add parent directory to path for shared modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def analyze_sentiment(ticker):
    """
    Analyze sentiment for a ticker using the new news_engine pipeline.
    Returns the same dict structure as before for backward compatibility.
    """
    try:
        from news_engine import get_sentiment_for_api
        return get_sentiment_for_api(ticker)
    except ImportError:
        logger.warning("news_engine not available, falling back to legacy sentiment")
        return _legacy_analyze_sentiment(ticker)
    except Exception as e:
        logger.error(f"news_engine error for {ticker}: {e}")
        return {
            "score": 0.0,
            "label": "Error",
            "status": "error",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
            "news_count": 0,
            "source_providers": [],
            "sentiment_trend_7d": [],
            "news_impact_summary": f"Error: {e}",
            "market_mood": "Unknown",
        }


def _legacy_analyze_sentiment(ticker):
    """Fallback legacy sentiment analysis if news_engine is unavailable."""
    from shared_sentiment import analyze_news_sentiment

    cache_key = f"sentiment_{ticker}"
    try:
        from news_providers import news_aggregator
        articles = news_aggregator.fetch_news(ticker, max_results=10)

        if articles:
            news_items = [a.__dict__ for a in articles]
            result = analyze_news_sentiment(news_items, ticker=ticker)
            base_score = result["sentiment_score"]
            status = result["status"]
            sources = list(set(a.provider for a in articles))

            if status == "sufficient":
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
                summary = (
                    f"Recent headlines show a {mood.lower()} sentiment. "
                    f"Positive mentions: {result['positive_count']}, "
                    f"Negative mentions: {result['negative_count']}."
                )
            else:
                mood = "Unknown"
                summary = "No relevant news found for this asset."

            return {
                "score": base_score,
                "label": result["sentiment_label"],
                "status": status,
                "positive_count": result["positive_count"],
                "negative_count": result["negative_count"],
                "news": result["news"],
                "news_count": len(articles),
                "source_providers": sources,
                "sentiment_trend_7d": [],
                "news_impact_summary": summary,
                "market_mood": mood,
            }
        else:
            return {
                "score": 0.0,
                "label": "Insufficient News",
                "status": "insufficient",
                "positive_count": 0,
                "negative_count": 0,
                "news": [],
                "news_count": 0,
                "source_providers": [],
                "sentiment_trend_7d": [],
                "news_impact_summary": "No news providers returned results for this asset.",
                "market_mood": "Unknown",
            }
    except Exception as e:
        logger.error(f"Legacy sentiment error for {ticker}: {e}")
        return {
            "score": 0.0,
            "label": "Error",
            "status": "error",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
            "news_count": 0,
            "source_providers": [],
            "sentiment_trend_7d": [],
            "news_impact_summary": f"Error fetching sentiment data: {e}",
            "market_mood": "Unknown",
        }
