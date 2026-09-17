"""
news_engine/providers.py — Multi-source news provider abstraction.

Implements:
- NewsDataProvider (NewsData.io)
- MarketauxProvider (entity-aware financial news)
- CurrentsProvider (broad coverage)
- GDELTProvider (free, no key)
- RSSProvider (free, no quota)

Each returns the same normalized NewsArticle model.
"""

import os
import re
import time
import hashlib
import logging
import threading
import requests
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import quote
from datetime import datetime, timezone, timedelta

from .models import NewsArticle, ProviderResult, SourceType, CompanyIdentity

logger = logging.getLogger(__name__)


# ─── Circuit Breaker ────────────────────────────────────────────────────────

class CircuitBreaker:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 300.0):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._half_open_calls = 0
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        with self._lock:
            if self._state == self.OPEN:
                if time.time() - self._last_failure_time >= self._recovery_timeout:
                    self._state = self.HALF_OPEN
                    self._half_open_calls = 0
            return self._state

    def allow_request(self) -> bool:
        with self._lock:
            if self._state == self.CLOSED:
                return True
            if self._state == self.HALF_OPEN:
                return self._half_open_calls < 1
            if time.time() - self._last_failure_time >= self._recovery_timeout:
                self._state = self.HALF_OPEN
                self._half_open_calls = 0
                return True
            return False

    def record_success(self):
        with self._lock:
            self._failure_count = 0
            self._state = self.CLOSED

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self._failure_threshold:
                self._state = self.OPEN
                logger.warning(f"Circuit breaker OPEN after {self._failure_count} failures.")


# ─── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter:
    def __init__(self, max_calls: int = 10, window_seconds: float = 60.0):
        self._max_calls = max_calls
        self._window = window_seconds
        self._calls: List[float] = []
        self._lock = threading.Lock()

    def allow(self) -> bool:
        now = time.time()
        with self._lock:
            self._calls = [t for t in self._calls if now - t < self._window]
            if len(self._calls) < self._max_calls:
                self._calls.append(now)
                return True
            return False

    def remaining(self) -> int:
        now = time.time()
        with self._lock:
            self._calls = [t for t in self._calls if now - t < self._window]
            return max(0, self._max_calls - len(self._calls))


# ─── Abstract Provider ──────────────────────────────────────────────────────

class NewsProvider(ABC):
    def __init__(self, name: str):
        self.name = name
        self.circuit_breaker = CircuitBreaker()
        self.rate_limiter = RateLimiter()
        self._metrics = {"total_calls": 0, "successes": 0, "failures": 0, "total_latency_ms": 0.0}

    @abstractmethod
    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        pass

    def is_available(self) -> bool:
        """Check provider availability. Subclasses override for provider-specific checks."""
        return self.circuit_breaker.state != CircuitBreaker.OPEN


# ─── NewsData.io ────────────────────────────────────────────────────────────

class NewsDataProvider(NewsProvider):
    def __init__(self):
        super().__init__("newsdata")
        self._api_key = os.environ.get("NEWSDATA_API_KEY", "")
        self._base_url = "https://newsdata.io/api/1/news"
        self._timeout = 10
        self.rate_limiter = RateLimiter(max_calls=10, window_seconds=60.0)

    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        if not self.is_available() or not self.rate_limiter.allow():
            return ProviderResult(provider=self.name, success=False, error="unavailable")

        start = time.perf_counter()
        try:
            # Search by ticker symbol for better relevance
            query = ticker
            encoded = quote(query, safe="")
            url = f"{self._base_url}?apikey={self._api_key}&q={encoded}&language=en&size={min(max_results, 10)}"
            resp = requests.get(url, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("results", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("description", "") or ""
                articles.append(NewsArticle(
                    title=title,
                    description=desc,
                    url=item.get("link", "#"),
                    publisher=item.get("source_id", "Unknown"),
                    published_at=item.get("pubDate", ""),
                    provider=self.name,
                    provider_article_id=item.get("article_id", ""),
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency

            return ProviderResult(
                provider=self.name,
                articles=articles,
                success=True,
                latency_ms=latency,
                raw_count=len(articles),
            )

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error="timeout")
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── Marketaux ──────────────────────────────────────────────────────────────

class MarketauxProvider(NewsProvider):
    def __init__(self):
        super().__init__("marketaux")
        self._api_key = os.environ.get("MARKETAUX_API_KEY", "")
        self._base_url = "https://api.marketaux.com/v1"
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=80, window_seconds=86400.0)

    def is_available(self) -> bool:
        if not self._api_key:
            return False
        return self.circuit_breaker.state != CircuitBreaker.OPEN

    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        if not self.is_available() or not self.rate_limiter.allow():
            return ProviderResult(provider=self.name, success=False, error="unavailable")

        start = time.perf_counter()
        try:
            published_after = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%S")
            params = {
                "api_token": self._api_key,
                "symbols": ticker,
                "language": "en",
                "published_after": published_after,
                "limit": min(max_results, 50),
                "group_similar": "true",
            }
            resp = requests.get(f"{self._base_url}/news/all", params=params, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("data", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("description", "") or ""
                # Marketaux provides entity-level sentiment
                entities = item.get("entities", [])
                raw_sentiment = ""
                raw_score = 0.0
                matched = []
                if entities:
                    for ent in entities:
                        ent_symbol = ent.get("symbol", "").upper()
                        ent_name = ent.get("name", "")
                        matched.append(ent_name)
                        if ent_symbol == ticker.upper():
                            raw_sentiment = ent.get("sentiment", "")
                            raw_score = ent.get("sentiment_score", 0.0)

                articles.append(NewsArticle(
                    title=title,
                    description=desc,
                    url=item.get("url", "#"),
                    publisher=item.get("source", "Unknown"),
                    published_at=item.get("published_at", ""),
                    provider=self.name,
                    provider_article_id=item.get("uuid", ""),
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                    matched_entities=matched,
                    raw_sentiment_label=raw_sentiment,
                    raw_sentiment_score=raw_score,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency

            return ProviderResult(
                provider=self.name,
                articles=articles,
                success=True,
                latency_ms=latency,
                raw_count=len(articles),
            )

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error="timeout")
        except requests.exceptions.HTTPError as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=f"HTTP {e.response.status_code}")
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── Currents ───────────────────────────────────────────────────────────────

class CurrentsProvider(NewsProvider):
    def __init__(self):
        super().__init__("currents")
        self._api_key = os.environ.get("CURRENTS_API_KEY", "")
        self._base_url = "https://api.currentsapi.services/v1"
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=200, window_seconds=86400.0)

    def is_available(self) -> bool:
        if not self._api_key:
            return False
        return self.circuit_breaker.state != CircuitBreaker.OPEN

    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        if not self.is_available() or not self.rate_limiter.allow():
            return ProviderResult(provider=self.name, success=False, error="unavailable")

        start = time.perf_counter()
        try:
            published_after = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%S")
            params = {
                "apiKey": self._api_key,
                "keyword": ticker,
                "language": "en",
                "published_after": published_after,
            }
            resp = requests.get(f"{self._base_url}/search", params=params, timeout=self._timeout)
            resp.raise_for_status()
            resp.encoding = 'utf-8'
            data = resp.json()

            articles = []
            for item in data.get("news", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("description", "") or ""
                articles.append(NewsArticle(
                    title=title,
                    description=desc,
                    url=item.get("url", "#"),
                    publisher=item.get("source", "Unknown"),
                    published_at=item.get("published", ""),
                    provider=self.name,
                    provider_article_id=item.get("id", ""),
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency

            return ProviderResult(
                provider=self.name,
                articles=articles,
                success=True,
                latency_ms=latency,
                raw_count=len(articles),
            )

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error="timeout")
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── GDELT ──────────────────────────────────────────────────────────────────

class GDELTProvider(NewsProvider):
    def __init__(self):
        super().__init__("gdelt")
        self._base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=10, window_seconds=30.0)

    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(provider=self.name, success=False, error="unavailable")

        start = time.perf_counter()
        try:
            query = f'"{company.canonical_name}"'
            params = {
                "query": query,
                "mode": "ArtList",
                "maxrecords": min(max_results, 50),
                "format": "json",
                "sort": "DateDesc",
                "timespan": f"{lookback_days}d",
                "sourcelang": "eng",
            }
            headers = {"User-Agent": "StockVanta/1.0"}
            resp = requests.get(self._base_url, params=params, timeout=self._timeout, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("articles", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("seendescription", "") or ""
                articles.append(NewsArticle(
                    title=title,
                    description=desc,
                    url=item.get("url", "#"),
                    publisher=item.get("domain", "Unknown"),
                    published_at=item.get("seendate", ""),
                    provider=self.name,
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency

            return ProviderResult(
                provider=self.name,
                articles=articles,
                success=True,
                latency_ms=latency,
                raw_count=len(articles),
            )

        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── RSS Provider ───────────────────────────────────────────────────────────

# Verified public RSS feeds for financial news
_RSS_SOURCES = [
    {
        "id": "yahoo_finance",
        "name": "Yahoo Finance",
        "url": "https://finance.yahoo.com/news/rssindex",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "general_finance",
    },
    {
        "id": "marketwatch",
        "name": "MarketWatch",
        "url": "https://feeds.marketwatch.com/marketwatch/topstories/",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "markets",
    },
    {
        "id": "cnbc_top",
        "name": "CNBC",
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "markets",
    },
    {
        "id": "reuters_business",
        "name": "Reuters Business",
        "url": "https://www.reutersagency.com/feed/?best-topics=business-finance",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "general_finance",
    },
    {
        "id": "seeking_alpha",
        "name": "Seeking Alpha",
        "url": "https://seekingalpha.com/market_currents.xml",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "general_finance",
    },
]


class RSSProvider(NewsProvider):
    def __init__(self):
        super().__init__("rss")
        self._timeout = 8
        self.rate_limiter = RateLimiter(max_calls=100, window_seconds=60.0)  # generous for free RSS

    def fetch(
        self,
        ticker: str,
        company: CompanyIdentity,
        lookback_days: int = 3,
        max_results: int = 10,
    ) -> ProviderResult:
        if not self.is_available():
            return ProviderResult(provider=self.name, success=False, error="unavailable")

        start = time.perf_counter()
        all_articles = []

        for source in _RSS_SOURCES:
            try:
                articles = self._fetch_feed(source, ticker, company, lookback_days)
                all_articles.extend(articles)
                if len(all_articles) >= max_results:
                    break
            except Exception as e:
                logger.debug(f"[RSS] {source['id']} error: {e}")
                continue

        latency = (time.perf_counter() - start) * 1000
        self._metrics["total_calls"] += 1
        self._metrics["successes"] += 1
        self._metrics["total_latency_ms"] += latency

        return ProviderResult(
            provider=self.name,
            articles=all_articles[:max_results],
            success=True,
            latency_ms=latency,
            raw_count=len(all_articles),
        )

    def _fetch_feed(self, source: dict, ticker: str, company: CompanyIdentity, lookback_days: int) -> List[NewsArticle]:
        """Fetch and parse a single RSS feed, filtering for ticker relevance."""
        resp = requests.get(source["url"], timeout=self._timeout, headers={"User-Agent": "StockVanta/1.0"})
        resp.raise_for_status()
        content = resp.text

        articles = []
        # Simple XML parsing (avoid lxml dependency)
        items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)

        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        for item_xml in items[:20]:  # Parse at most 20 items per feed
            title_match = re.search(r'<title[^>]*>(.*?)</title>', item_xml, re.DOTALL)
            link_match = re.search(r'<link[^>]*>(.*?)</link>', item_xml, re.DOTALL)
            desc_match = re.search(r'<description[^>]*>(.*?)</description>', item_xml, re.DOTALL)
            pub_match = re.search(r'<pubDate[^>]*>(.*?)</pubDate>', item_xml, re.DOTALL)

            title = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', title_match.group(1)).strip() if title_match else ""
            link = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', link_match.group(1)).strip() if link_match else ""
            desc = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', desc_match.group(1)).strip() if desc_match else ""
            # Clean HTML from description
            desc = re.sub(r'<[^>]+>', '', desc).strip()
            pub_date = pub_match.group(1).strip() if pub_match else ""

            if not title:
                continue

            # Check if article might be about this ticker/company
            text = f"{title} {desc}".lower()
            is_relevant = (
                ticker.lower() in text
                or company.canonical_name.lower() in text
                or company.short_name.lower() in text
                or any(alias.lower() in text for alias in company.aliases)
            )

            if not is_relevant:
                continue

            articles.append(NewsArticle(
                title=title,
                description=desc[:500],  # Truncate long descriptions
                url=link,
                publisher=source["name"],
                published_at=pub_date,
                provider="rss",
                provider_article_id=f"{source['id']}_{hashlib.md5(title.encode()).hexdigest()[:8]}",
                source_type=source["source_type"],
                ticker=ticker,
            ))

        return articles


# ─── Provider Registry ──────────────────────────────────────────────────────

def get_all_providers() -> List[NewsProvider]:
    """Return all registered providers in priority order."""
    return [
        MarketauxProvider(),     # Best for stock-specific news
        NewsDataProvider(),      # Broad coverage
        CurrentsProvider(),      # Additional coverage
        GDELTProvider(),         # Free fallback
        RSSProvider(),           # Free supplement
    ]


def get_provider_status(providers: List[NewsProvider]) -> Dict[str, Dict[str, Any]]:
    """Return health status of all providers."""
    status = {}
    for p in providers:
        m = p._metrics
        avg_latency = (m["total_latency_ms"] / m["total_calls"]) if m["total_calls"] > 0 else 0.0
        status[p.name] = {
            "available": p.is_available(),
            "circuit_state": p.circuit_breaker.state,
            "total_calls": m["total_calls"],
            "successes": m["successes"],
            "failures": m["failures"],
            "avg_latency_ms": round(avg_latency, 1),
            "rate_remaining": p.rate_limiter.remaining(),
        }
    return status
