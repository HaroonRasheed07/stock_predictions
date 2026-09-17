import re
from typing import List, Dict, Any, Optional

# Keyword-based sentiment for fast, reliable scoring without heavy ML models
POSITIVE_KEYWORDS = [
    'surge', 'soar', 'rally', 'boom', 'bull', 'bullish', 'gain', 'gains', 'rise', 'rising',
    'up', 'jump', 'growth', 'strong', 'stronger', 'record', 'high', 'highs', 'outperform',
    'beat', 'beats', 'exceed', 'profit', 'profits', 'positive', 'optimistic', 'hope',
    'recovery', 'rebound', 'upgrade', 'upgraded', 'buy', 'outperform', 'success', 'breakthrough',
    'moon', 'rocket', 'pump', ' ATH', ' all-time', 'partnership', 'deal', 'expansion',
    'adoption', 'mainstream', 'institutional', 'ETF', 'approval', 'launch', 'listing',
    # Extended set
    'rally', 'surpasses', 'outlook', 'momentum', 'accelerat', 'milestone',
    'innovat', 'partner', 'acqui', 'revenue', 'earnings beat', 'dividend',
    'authoriz', 'greenlight', 'backlog', 'pipeline', 'uptick', 'revis up',
    'inflow', 'accumul', 'undervalu', 'upside', 'breakout',
]

NEGATIVE_KEYWORDS = [
    'crash', 'fall', 'fell', 'drop', 'dropping', 'plunge', 'plummet', 'decline', 'dump',
    'bear', 'bearish', 'down', 'loss', 'losses', 'weak', 'weakness', 'low', 'lows',
    'underperform', 'miss', 'misses', 'negative', 'pessimistic', 'fear', 'panic', 'sell',
    'selling', 'dumping', 'correction', 'recession', 'inflation', 'debt', 'bankrupt',
    'liquidation', 'liquidated', 'hack', 'exploit', 'scam', 'fraud', 'investigation',
    'lawsuit', 'ban', 'banned', 'restriction', 'regulatory', 'crackdown', 'FUD',
    # Extended set
    'downgrad', 'overvalu', 'warning', 'risk', 'cautious', 'headwind', 'drag',
    'slump', 'tumble', 'retreat', 'pullback', 'selloff', 'sell-off', 'capitul',
    'restructur', 'layoff', 'cuts', 'recall', 'defect', 'delay', 'postpone',
    'resign', 'depart', 'sec charges', 'subpoena', 'probe', 'settl',
]

# Ticker → common company name aliases for entity matching
COMPANY_ALIASES: Dict[str, List[str]] = {
    "AAPL": ["apple"],
    "MSFT": ["microsoft"],
    "NVDA": ["nvidia"],
    "GOOGL": ["google", "alphabet"],
    "GOOG": ["google", "alphabet"],
    "AMZN": ["amazon"],
    "META": ["meta", "facebook"],
    "TSLA": ["tesla"],
    "JPM": ["jpmorgan", "jp morgan"],
    "V": ["visa"],
    "JNJ": ["johnson & johnson", "johnson and johnson", "j&j"],
    "WMT": ["walmart"],
    "PG": ["procter", "pg "],
    "MA": ["mastercard"],
    "UNH": ["unitedhealth"],
    "HD": ["home depot"],
    "DIS": ["disney"],
    "BAC": ["bank of america"],
    "XOM": ["exxon", "exxonmobil"],
    "PFE": ["pfizer"],
    "CSCO": ["cisco"],
    "NFLX": ["netflix"],
    "CRM": ["salesforce"],
    "AMD": ["amd", "advanced micro"],
    "INTC": ["intel"],
    "KO": ["coca-cola", "coca cola", "coke"],
    "PEP": ["pepsi"],
    "ADBE": ["adobe"],
    "COST": ["costco"],
    "NKE": ["nike"],
    "MRK": ["merck"],
    "ABBV": ["abbvie"],
    "TMO": ["thermo fisher"],
    "ACN": ["accenture"],
    "AVGO": ["broadcom"],
    "MCD": ["mcdonald"],
    "COP": ["conocophillips", "conoco"],
    "WFC": ["wells fargo"],
    "DHR": ["danaher"],
    "LIN": ["linde"],
    "PM": ["philip morris", "pm "],
    "TXN": ["texas instruments"],
    "RTX": ["rtx", "raytheon"],
    "HON": ["honeywell"],
    "LOW": ["lowe", "lowes"],
    "IBM": ["ibm"],
    "QCOM": ["qualcomm"],
    "CAT": ["caterpillar"],
    "BA": ["boeing"],
    "GE": ["ge ", "general electric", "geelectric"],
    "SPY": ["s&p 500", "spy etf"],
    "QQQ": ["nasdaq 100", "qqq etf"],
    "GLD": ["gold etf"],
    "IWM": ["russell 2000", "iwm etf"],
}


def score_text_keywords(text: str) -> float:
    """Score text from -1.0 (negative) to +1.0 (positive) based on keywords."""
    text_lower = text.lower()

    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw.lower() in text_lower)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw.lower() in text_lower)

    total = pos_count + neg_count
    if total == 0:
        return 0.0

    score = (pos_count - neg_count) / total
    return max(-1.0, min(1.0, score * 1.5))


def is_entity_relevant(text: str, ticker: str) -> bool:
    """
    Check if article text is actually about the target ticker/company.
    Returns True if the text mentions the ticker symbol or company name.
    """
    text_lower = text.lower()
    # Always relevant if ticker symbol is mentioned
    if ticker.lower() in text_lower:
        return True
    # Check company name aliases
    aliases = COMPANY_ALIASES.get(ticker.upper(), [])
    for alias in aliases:
        if alias.lower() in text_lower:
            return True
    return False


def analyze_text_sentiment(texts: List[str]) -> List[float]:
    """Analyze sentiment of texts - keyword-based scoring."""
    scores = []
    for text in texts:
        scores.append(score_text_keywords(text))
    return scores


def analyze_news_sentiment(
    news_items: List[Dict[str, Any]],
    ticker: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyze sentiment of news items.
    Returns dict with sentiment_score, sentiment_label, status, positive_count, negative_count, and scored news.

    status:
      - "sufficient": enough relevant articles to form a meaningful opinion
      - "insufficient": no relevant articles found (empty after filtering)
      - "error": provider errors (empty input)
    """
    if not news_items:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Neutral",
            "status": "insufficient",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "news": []
        }

    # Entity relevance filtering: only score articles actually about the target
    if ticker:
        relevant = [
            item for item in news_items
            if is_entity_relevant(
                item.get("title", "") + " " + item.get("full_text", "") + " " + item.get("description", ""),
                ticker,
            )
        ]
    else:
        relevant = news_items

    if not relevant:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Insufficient News",
            "status": "insufficient",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "news": []
        }

    texts = [item.get("title", "") + " " + item.get("full_text", "") for item in relevant]
    scores = analyze_text_sentiment(texts)

    scored_news = []
    for i, item in enumerate(relevant):
        score = scores[i] if i < len(scores) else 0.0
        scored_news.append({
            **item,
            "sentiment": round(score, 4)
        })

    positive_count = sum(1 for s in scores if s > 0.1)
    negative_count = sum(1 for s in scores if s < -0.1)
    neutral_count = len(scores) - positive_count - negative_count

    avg_sentiment = sum(scores) / len(scores) if scores else 0.0

    if avg_sentiment > 0.1:
        label = "Positive"
    elif avg_sentiment < -0.1:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "sentiment_score": round(avg_sentiment, 4),
        "sentiment_label": label,
        "status": "sufficient",
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": neutral_count,
        "news": scored_news
    }
