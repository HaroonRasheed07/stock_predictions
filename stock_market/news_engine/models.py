"""
news_engine/models.py — Canonical data models for Stock Vanta News Engine.

All providers normalize to these models. All consumers read from these models.
One ticker → one canonical article set → one canonical sentiment snapshot.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from enum import Enum
import hashlib
import re


# ─── Enums ──────────────────────────────────────────────────────────────────

class SourceType(str, Enum):
    AGGREGATOR = "aggregator"
    PUBLISHER_RSS = "publisher_rss"
    COMPANY_OFFICIAL = "company_official"
    REGULATORY = "regulatory"


class SentimentStatus(str, Enum):
    SUFFICIENT = "sufficient"
    INSUFFICIENT = "insufficient"
    NO_RELEVANT_NEWS = "no_relevant_news"
    NEWS_UNAVAILABLE = "news_unavailable"
    ERROR = "error"


class SentimentLabel(str, Enum):
    POSITIVE = "Positive"
    NEGATIVE = "Negative"
    NEUTRAL = "Neutral"
    INSUFFICIENT = "Insufficient News"
    UNAVAILABLE = "News Unavailable"
    ERROR = "Error"


# ─── Company Identity ──────────────────────────────────────────────────────

@dataclass
class CompanyIdentity:
    """Resolved company identity for a ticker."""
    ticker: str
    canonical_name: str
    short_name: str = ""
    aliases: List[str] = field(default_factory=list)
    exchange: str = ""
    asset_type: str = "equity"
    sector: str = ""
    industry: str = ""


# ─── Normalized Article ────────────────────────────────────────────────────

@dataclass
class NewsArticle:
    """Canonical article model. Every provider normalizes to this."""
    id: str = ""
    ticker: str = ""
    title: str = ""
    description: str = ""
    url: str = ""
    publisher: str = ""
    published_at: str = ""
    provider: str = ""
    provider_article_id: str = ""
    source_type: SourceType = SourceType.AGGREGATOR
    matched_entities: List[str] = field(default_factory=list)
    relevance_score: float = 0.0
    duplicate_group: int = -1
    is_representative: bool = False

    # Provider-provided sentiment metadata (for diagnostics)
    raw_sentiment_label: str = ""
    raw_sentiment_score: float = 0.0
    entity_match_score: float = 0.0  # Provider entity relevance (0-1)
    entity_count: int = 0  # How many entities the provider identified

    # FinBERT output (populated later)
    finbert_label: str = ""
    finbert_positive: float = 0.0
    finbert_neutral: float = 0.0
    finbert_negative: float = 0.0

    def __post_init__(self):
        if not self.id:
            self.id = self._generate_id()

    def _generate_id(self) -> str:
        norm_title = re.sub(r'[^a-z0-9]', '', self.title.lower())
        norm_url = re.sub(r'[?#].*', '', self.url.lower())
        return hashlib.md5(f"{norm_title}|{norm_url}".encode()).hexdigest()


# ─── Provider Result ────────────────────────────────────────────────────────

@dataclass
class ProviderResult:
    """Result from a single news provider."""
    provider: str
    articles: List[NewsArticle] = field(default_factory=list)
    success: bool = True
    error: str = ""
    latency_ms: float = 0.0
    raw_count: int = 0
    quota_remaining: Optional[int] = None


# ─── Sentiment Snapshot ────────────────────────────────────────────────────

@dataclass
class ArticleSentiment:
    """Per-article sentiment with all metadata."""
    article_id: str
    title: str
    url: str
    publisher: str
    published_at: str
    relevance_score: float
    finbert_label: str
    finbert_positive: float
    finbert_neutral: float
    finbert_negative: float
    weighted_score: float = 0.0
    source_quality: float = 0.5
    entity_match_score: float = 0.0
    entity_count: int = 0
    rule_score: float = 0.0  # Raw rule-engine score before pseudo-prob conversion
    drivers: List[Dict[str, Any]] = field(default_factory=list)  # Extracted sentiment drivers
    events: List[str] = field(default_factory=list)  # Event types from rule engine


# ─── Sentiment Drivers ──────────────────────────────────────────────────────

DRIVER_CATEGORIES = {
    'EARNINGS': 'Earnings',
    'REVENUE': 'Revenue',
    'GUIDANCE': 'Guidance',
    'ANALYST_ACTION': 'Analyst Ratings',
    'CONTRACT': 'Contracts',
    'PRODUCT': 'Products',
    'M_A': 'M&A',
    'REGULATORY': 'Regulation',
    'LEGAL': 'Legal',
    'MANAGEMENT': 'Management',
    'CAPITAL_RETURN': 'Capital Returns',
    'CYBERSECURITY': 'Cybersecurity',
    'MARKET_REACTION': 'Market Reaction',
    'GENERAL': 'Other',
}


def extract_drivers_from_article(title: str, description: str, rule_score: float, events: list, matched_phrases: list) -> List[Dict[str, Any]]:
    """Extract structured sentiment drivers from a single article's metadata."""
    drivers = []
    direction = "positive" if rule_score > 0.05 else "negative" if rule_score < -0.05 else "neutral"
    if direction == "neutral":
        return drivers

    for event_type in events:
        category = DRIVER_CATEGORIES.get(event_type, 'Other')
        strength = min(abs(rule_score), 1.0)
        drivers.append({
            "category": category,
            "direction": direction,
            "strength": round(strength, 2),
            "event_type": event_type,
        })
    return drivers


def aggregate_drivers(all_drivers: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
    """Aggregate drivers across articles, keep strongest per category."""
    by_category: Dict[str, Dict[str, Any]] = {}
    for d in all_drivers:
        cat = d["category"]
        if cat not in by_category:
            by_category[cat] = {
                "category": cat,
                "direction": d["direction"],
                "total_strength": 0.0,
                "article_count": 0,
            }
        entry = by_category[cat]
        entry["total_strength"] += d["strength"]
        entry["article_count"] += 1
        if d["strength"] > max(0.1, 0.0):
            entry["direction"] = d["direction"]

    result = sorted(by_category.values(), key=lambda x: x["total_strength"], reverse=True)
    for r in result:
        r["contribution"] = round(r["total_strength"] / max(1, r["article_count"]), 2)
        del r["total_strength"]
    return result[:top_n]


def generate_explanation(
    score: float,
    label: str,
    drivers: List[Dict[str, Any]],
    article_count: int,
    source_count: int,
) -> str:
    """Generate deterministic, human-readable explanation from drivers."""
    pos_drivers = [d["category"] for d in drivers if d["direction"] == "positive"]
    neg_drivers = [d["category"] for d in drivers if d["direction"] == "negative"]

    parts = []

    if label == "Insufficient News":
        return f"Not enough relevant articles to compute a reliable sentiment score. Found {article_count} article(s)."

    if not pos_drivers and not neg_drivers:
        if abs(score) < 0.05:
            parts.append("News coverage is mostly factual with no strong directional catalyst.")
        elif score > 0:
            parts.append("Slight positive bias in recent coverage, but evidence is limited.")
        else:
            parts.append("Slight negative bias in recent coverage, but evidence is limited.")
    else:
        if pos_drivers and not neg_drivers:
            parts.append(f"Recent coverage shows positive signals driven by {' and '.join(pos_drivers[:3])}.")
        elif neg_drivers and not pos_drivers:
            parts.append(f"Recent coverage shows negative signals driven by {' and '.join(neg_drivers[:3])}.")
        else:
            parts.append(f"Mixed signals: positive drivers ({', '.join(pos_drivers[:3])}) offset by negative drivers ({', '.join(neg_drivers[:3])}).")

    parts.append(f"Based on {article_count} relevant article{'s' if article_count != 1 else ''} from {source_count} source{'s' if source_count != 1 else ''}.")
    return " ".join(parts)


@dataclass
class SentimentSnapshot:
    """ONE canonical sentiment result for a ticker. Consumed by all pages."""
    ticker: str
    company_name: str = ""
    status: SentimentStatus = SentimentStatus.INSUFFICIENT
    label: SentimentLabel = SentimentLabel.INSUFFICIENT
    score: float = 0.0

    positive_pct: float = 0.0
    neutral_pct: float = 0.0
    negative_pct: float = 0.0

    article_count: int = 0
    relevant_article_count: int = 0
    source_count: int = 0
    providers_attempted: List[str] = field(default_factory=list)

    articles: List[ArticleSentiment] = field(default_factory=list)
    news_headlines: List[Dict[str, Any]] = field(default_factory=list)
    drivers: List[Dict[str, Any]] = field(default_factory=list)
    explanation: str = ""

    generated_at: str = ""
    expires_at: str = ""
    data_freshness: str = "fresh"
    methodology_version: str = "3"
    coverage_status: str = "unknown"  # FULL, PARTIAL, INSUFFICIENT, NONE
    freshest_article_at: str = ""
    oldest_article_at: str = ""

    provider_summary: Dict[str, Any] = field(default_factory=dict)

    # Legacy compatibility fields (for existing frontend)
    sentiment_score: float = 0.0
    sentiment_label: str = "Neutral"
    positive_count: int = 0
    negative_count: int = 0
    market_mood: str = "Unknown"
    news_impact_summary: str = ""
    news_count: int = 0
    source_providers: List[str] = field(default_factory=list)

    def __post_init__(self):
        now = datetime.now(timezone.utc).isoformat()
        if not self.generated_at:
            self.generated_at = now
        # Sync legacy fields
        self.sentiment_score = self.score
        self.sentiment_label = self.label.value if isinstance(self.label, SentimentLabel) else self.label
        self.positive_count = sum(1 for a in self.articles if a.finbert_label == "positive")
        self.negative_count = sum(1 for a in self.articles if a.finbert_label == "negative")
        self.news_count = self.relevant_article_count
        self.source_providers = self.providers_attempted
        if self.status == SentimentStatus.INSUFFICIENT:
            self.market_mood = "Unknown"
            self.news_impact_summary = "Not enough relevant recent news to calculate reliable sentiment."
        elif self.status == SentimentStatus.NO_RELEVANT_NEWS:
            self.market_mood = "Unknown"
            self.news_impact_summary = "No relevant company-specific news found."
        elif self.status == SentimentStatus.NEWS_UNAVAILABLE:
            self.market_mood = "Unknown"
            self.news_impact_summary = "News temporarily unavailable. Try again shortly."
        elif self.status == SentimentStatus.ERROR:
            self.market_mood = "Unknown"
            self.news_impact_summary = "Error fetching sentiment data."
        else:
            self.market_mood = self._compute_mood()
            self.news_impact_summary = self._compute_summary()

    def _compute_mood(self) -> str:
        """Compute mood label aligned with sentiment_label thresholds.
        
        Uses the same +/-0.15 threshold as sentiment_label for consistency.
        mood MUST agree with sentiment_label -- never contradict it.
        """
        if self.score >= 0.15:
            return "Bullish"
        elif self.score <= -0.15:
            return "Bearish"
        return "Neutral"

    def _compute_summary(self) -> str:
        if self.explanation:
            return self.explanation
        return (
            f"Based on {self.relevant_article_count} relevant articles "
            f"from {self.source_count} sources. "
            f"Positive: {self.positive_count}, "
            f"Neutral: {self.relevant_article_count - self.positive_count - self.negative_count}, "
            f"Negative: {self.negative_count}."
        )

    def to_legacy_dict(self) -> Dict[str, Any]:
        """Return dict matching the existing frontend EnhancedSentiment interface.
        Includes article count distribution (positive_count, neutral_count, negative_count)
        and distribution percentages that match the counts."""
        neutral_count = self.relevant_article_count - self.positive_count - self.negative_count
        has_articles = self.relevant_article_count > 0
        is_available = self.status.value == "sufficient"

        # Never show fake 100% neutral when there are zero articles
        pos_pct = self.positive_pct if has_articles else 0.0
        neg_pct = self.negative_pct if has_articles else 0.0
        neu_pct = self.neutral_pct if has_articles else 0.0
        pos_count = self.positive_count if has_articles else 0
        neg_count = self.negative_count if has_articles else 0
        neu_count = neutral_count if has_articles else 0

        return {
            "ticker": self.ticker,
            "sentiment_score": self.score if is_available else 0.0,
            "sentiment_label": self.sentiment_label,
            "status": self.status.value,
            "score": self.score if is_available else 0.0,
            "label": self.sentiment_label,
            "positive_count": pos_count,
            "negative_count": neg_count,
            "neutral_count": neu_count,
            "positive_pct": pos_pct,
            "neutral_pct": neu_pct,
            "negative_pct": neg_pct,
            "article_count": self.article_count,
            "relevant_article_count": self.relevant_article_count,
            "source_count": self.source_count,
            "news_count": self.relevant_article_count,
            "source_providers": self.source_providers,
            "providers_attempted": self.providers_attempted,
            "generated_at": self.generated_at,
            "data_freshness": self.data_freshness,
            "score_available": is_available,
            "news": [
                {
                    "title": a.title,
                    "source": a.publisher,
                    "url": a.url,
                    "published_at": a.published_at,
                    "sentiment": a.weighted_score,
                }
                for a in self.articles[:8]
            ],
            "articles": [
                {
                    "article_id": a.article_id,
                    "title": a.title,
                    "url": a.url,
                    "publisher": a.publisher,
                    "published_at": a.published_at,
                    "relevance_score": a.relevance_score,
                    "finbert_label": a.finbert_label,
                    "finbert_positive": a.finbert_positive,
                    "finbert_neutral": a.finbert_neutral,
                    "finbert_negative": a.finbert_negative,
                    "weighted_score": a.weighted_score,
                    "source_quality": a.source_quality,
                    "rule_score": getattr(a, 'rule_score', 0.0),
                }
                for a in self.articles[:20]
            ],
            "sentiment_trend_7d": [],  # Populated by get_sentiment_for_api() from history DB
            "drivers": self.drivers,
            "explanation": self.explanation or self._compute_summary(),
            "news_impact_summary": self.news_impact_summary,
            "coverage_status": getattr(self, 'coverage_status', 'unknown'),
            "freshest_article_at": getattr(self, 'freshest_article_at', ''),
            "oldest_article_at": getattr(self, 'oldest_article_at', ''),
            "target_count": 8,
            "market_mood": self.market_mood,
            "methodology_version": self.methodology_version,
            "provider_summary": self.provider_summary,
        }
