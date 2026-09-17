"""
news_engine/models.py — Canonical data models for Stock Vanta News Engine.

All providers normalize to these models. All consumers read from these models.
One ticker → one canonical article set → one canonical sentiment snapshot.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
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

    generated_at: str = ""
    expires_at: str = ""
    data_freshness: str = "fresh"
    methodology_version: str = "3"

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
        
        Uses the same ±0.15 threshold as sentiment_label for consistency.
        mood MUST agree with sentiment_label — never contradict it.
        """
        if self.score > 0.15:
            return "Bullish"
        elif self.score < -0.15:
            return "Bearish"
        return "Neutral"

    def _compute_summary(self) -> str:
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
                for a in self.articles[:10]
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
                }
                for a in self.articles[:20]
            ],
            "sentiment_trend_7d": [],  # Populated by get_sentiment_for_api() from history DB
            "news_impact_summary": self.news_impact_summary,
            "market_mood": self.market_mood,
            "methodology_version": self.methodology_version,
            "provider_summary": self.provider_summary,
        }
