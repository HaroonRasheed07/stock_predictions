"""
news_engine — Stock Vanta Multi-Source Financial News & Canonical Sentiment Engine.

One ticker → one canonical article set → one canonical sentiment snapshot.
"""

from .models import (
    NewsArticle, SentimentSnapshot, CompanyIdentity,
    SentimentStatus, SentimentLabel, SourceType, ProviderResult, ArticleSentiment,
)
from .company_resolver import resolve_company, get_search_queries
from .providers import get_all_providers, get_provider_status
from .finbert_sentiment import analyze_sentiment_batch, analyze_single, is_model_available
from .engine import get_sentiment_snapshot, get_sentiment_for_api, get_news_provider_status

__all__ = [
    "NewsArticle",
    "SentimentSnapshot",
    "CompanyIdentity",
    "SentimentStatus",
    "SentimentLabel",
    "SourceType",
    "ProviderResult",
    "ArticleSentiment",
    "resolve_company",
    "get_search_queries",
    "get_all_providers",
    "get_provider_status",
    "analyze_sentiment_batch",
    "analyze_single",
    "is_model_available",
    "get_sentiment_snapshot",
    "get_sentiment_for_api",
    "get_news_provider_status",
]
