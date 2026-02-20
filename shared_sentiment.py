import re
from typing import List, Dict, Any

# Keyword-based sentiment for fast, reliable scoring without heavy ML models
POSITIVE_KEYWORDS = [
    'surge', 'soar', 'rally', 'boom', 'bull', 'bullish', 'gain', 'gains', 'rise', 'rising',
    'up', 'jump', 'growth', 'strong', 'stronger', 'record', 'high', 'highs', 'outperform',
    'beat', 'beats', 'exceed', 'profit', 'profits', 'positive', 'optimistic', 'hope',
    'recovery', 'rebound', 'upgrade', 'upgraded', 'buy', 'outperform', 'success', 'breakthrough',
    'moon', 'rocket', 'pump', ' ATH', ' all-time', 'partnership', 'deal', 'expansion',
    'adoption', 'mainstream', 'institutional', 'ETF', 'approval', 'launch', 'listing'
]

NEGATIVE_KEYWORDS = [
    'crash', 'fall', 'fell', 'drop', 'dropping', 'plunge', 'plummet', 'decline', 'dump',
    'bear', 'bearish', 'down', 'loss', 'losses', 'weak', 'weakness', 'low', 'lows',
    'underperform', 'miss', 'misses', 'negative', 'pessimistic', 'fear', 'panic', 'sell',
    'selling', 'dumping', 'correction', 'recession', 'inflation', 'debt', 'bankrupt',
    'liquidation', 'liquidated', 'hack', 'exploit', 'scam', 'fraud', 'investigation',
    'lawsuit', 'ban', 'banned', 'restriction', 'regulatory', 'crackdown', 'FUD'
]

def score_text_keywords(text: str) -> float:
    """Score text from -1.0 (negative) to +1.0 (positive) based on keywords."""
    text_lower = text.lower()
    
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw.lower() in text_lower)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw.lower() in text_lower)
    
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    
    # Normalize to -1 to +1 range
    score = (pos_count - neg_count) / total
    # Scale to make stronger signals
    return max(-1.0, min(1.0, score * 1.5))

def analyze_sentiment_vader(texts: List[str]) -> List[float]:
    """Fallback sentiment using VADER if available, else keywords."""
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        analyzer = SentimentIntensityAnalyzer()
        scores = []
        for text in texts:
            scores.append(analyzer.polarity_scores(text)['compound'])
        return scores
    except ImportError:
        # Fall back to keyword-based
        return [score_text_keywords(t) for t in texts]


def analyze_text_sentiment(texts: List[str]) -> List[float]:
    """Analyze sentiment of texts - tries multiple methods."""
    scores = []
    for text in texts:
        scores.append(score_text_keywords(text))
    return scores


def analyze_news_sentiment(news_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze sentiment of news items.
    Returns dict with sentiment_score, label, positive_count, negative_count, and scored news.
    """
    if not news_items:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Neutral",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "news": []
        }
    
    texts = [item.get("title", "") + " " + item.get("full_text", "") for item in news_items]
    scores = analyze_text_sentiment(texts)
    
    # Add scores to news items
    scored_news = []
    for i, item in enumerate(news_items):
        score = scores[i] if i < len(scores) else 0.0
        scored_news.append({
            **item,
            "sentiment": round(score, 4)
        })
    
    # Count sentiments
    positive_count = sum(1 for s in scores if s > 0.1)
    negative_count = sum(1 for s in scores if s < -0.1)
    neutral_count = len(scores) - positive_count - negative_count
    
    # Average sentiment
    avg_sentiment = sum(scores) / len(scores) if scores else 0.0
    
    # Determine label
    if avg_sentiment > 0.1:
        label = "Positive"
    elif avg_sentiment < -0.1:
        label = "Negative"
    else:
        label = "Neutral"
    
    return {
        "sentiment_score": round(avg_sentiment, 4),
        "sentiment_label": label,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": neutral_count,
        "news": scored_news
    }
