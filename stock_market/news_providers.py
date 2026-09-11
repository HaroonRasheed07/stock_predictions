"""
news_providers.py — Multi-Source News Provider Abstraction Layer

Implements a pluggable news provider architecture with:
- NewsDataProvider (NewsData.io)
- GDELTProvider (GDELT DOC API — free, no API key)
- AlphaVantageProvider (Alpha Vantage News API — requires optional API key)
- Circuit breakers, rate-limit protection, provider fallback
- Normalized article schema across all providers
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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Normalized Article Schema
# ---------------------------------------------------------------------------

@dataclass
class NormalizedArticle:
    """Unified article schema across all news providers."""
    title: str
    source: str
    url: str
    published_at: str
    full_text: str
    provider: str  # which provider returned this
    description: str = ""
    url_to_image: Optional[str] = None

    def fingerprint(self) -> str:
        """Return a dedup fingerprint based on normalized title + URL."""
        norm_title = re.sub(r'[^a-z0-9]', '', self.title.lower())
        norm_url = re.sub(r'[?#].*', '', self.url.lower())
        return hashlib.md5(f"{norm_title}|{norm_url}".encode()).hexdigest()


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

class CircuitBreaker:
    """
    Per-provider circuit breaker.
    States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing).
    """
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 300.0,  # 5 minutes
        half_open_max_calls: int = 1,
    ):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._half_open_max_calls = half_open_max_calls
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
                return self._half_open_calls < self._half_open_max_calls
            # OPEN
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
                logger.warning(
                    f"Circuit breaker OPEN after {self._failure_count} failures. "
                    f"Recovery in {self._recovery_timeout}s."
                )

    def is_available(self) -> bool:
        return self.state != self.OPEN


# ---------------------------------------------------------------------------
# Rate Limiter (per-provider)
# ---------------------------------------------------------------------------

class RateLimiter:
    """Token-bucket rate limiter for API providers."""
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

    def wait_time(self) -> float:
        now = time.time()
        with self._lock:
            if self._calls:
                oldest = min(self._calls)
                return max(0.0, self._window - (now - oldest))
        return 0.0


# ---------------------------------------------------------------------------
# Abstract News Provider
# ---------------------------------------------------------------------------

class NewsProvider(ABC):
    """Abstract base class for all news providers."""
    def __init__(self, name: str):
        self.name = name
        self.circuit_breaker = CircuitBreaker()
        self.rate_limiter = RateLimiter()
        self._metrics = {"total_calls": 0, "successes": 0, "failures": 0, "total_latency_ms": 0.0}

    @abstractmethod
    def fetch(self, query: str, max_results: int = 10) -> List[NormalizedArticle]:
        """Fetch news articles for a query. Returns normalized articles."""
        pass

    def is_available(self) -> bool:
        return self.circuit_breaker.is_available() and self.rate_limiter.allow()


# ---------------------------------------------------------------------------
# NewsData.io Provider
# ---------------------------------------------------------------------------

class NewsDataProvider(NewsProvider):
    """NewsData.io provider — primary news source."""
    def __init__(self):
        super().__init__("newsdata")
        self._api_key = os.environ.get(
            "NEWSDATA_API_KEY",
            "pub_d4ca502ff69e478d991d8d30f9557d64"  # fallback to existing key
        )
        self._timeout = 10

    def fetch(self, query: str, max_results: int = 10) -> List[NormalizedArticle]:
        if not self.is_available():
            logger.debug(f"[NEWS] {self.name} unavailable (circuit open or rate limited)")
            return []

        try:
            encoded = quote(query, safe="")
            url = (
                f"https://newsdata.io/api/1/news"
                f"?apikey={self._api_key}&q={encoded}&language=en&size={min(max_results, 10)}"
            )
            resp = requests.get(url, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("results", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("description", "") or ""
                articles.append(NormalizedArticle(
                    title=title,
                    source=item.get("source_id", "Unknown"),
                    url=item.get("link", "#"),
                    published_at=item.get("pubDate", ""),
                    full_text=f"{title} {desc}".strip(),
                    provider=self.name,
                    description=desc,
                    url_to_image=item.get("image_url"),
                ))

            self.circuit_breaker.record_success()
            logger.debug(f"[NEWS] {self.name} returned {len(articles)} articles for '{query}'")
            return articles

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} timeout for query '{query}'")
            return []
        except requests.exceptions.HTTPError as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} HTTP error {e.response.status_code} for '{query}'")
            return []
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} error: {e}")
            return []


# ---------------------------------------------------------------------------
# GDELT Provider (free, no API key required)
# ---------------------------------------------------------------------------

class GDELTProvider(NewsProvider):
    """
    GDELT DOC API provider — secondary fallback.
    Free tier: 1 request per second, no API key required.
    Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-updates/
    """
    def __init__(self):
        super().__init__("gdelt")
        self._base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
        self._timeout = 12
        # GDELT allows 1 req/sec — be conservative at 1 per 3 seconds
        self.rate_limiter = RateLimiter(max_calls=10, window_seconds=30.0)

    def _build_query(self, query: str) -> str:
        """
        Build GDELT-compatible query.
        GDELT uses its own query syntax — wrap ticker in quotes for exact match.
        """
        # Strip special chars that break GDELT query
        clean = re.sub(r'[^A-Za-z0-9\s\.\-]', '', query).strip()
        if not clean:
            clean = query
        return f'"{clean}"'

    def fetch(self, query: str, max_results: int = 10) -> List[NormalizedArticle]:
        if not self.is_available():
            logger.debug(f"[NEWS] {self.name} unavailable")
            return []

        try:
            gdelt_query = self._build_query(query)
            params = {
                "query": gdelt_query,
                "mode": "ArtList",
                "maxrecords": min(max_results, 50),
                "format": "json",
                "sort": "DateDesc",
                "timespan": "3d",  # last 3 days
                "sourcelang": "eng",
            }
            headers = {"User-Agent": "StockMarketAnalytics/1.0"}
            resp = requests.get(self._base_url, params=params, timeout=self._timeout, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("articles", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("seendescription", "") or ""
                articles.append(NormalizedArticle(
                    title=title,
                    source=item.get("domain", "Unknown"),
                    url=item.get("url", "#"),
                    published_at=item.get("seendate", ""),
                    full_text=f"{title} {desc}".strip(),
                    provider=self.name,
                    description=desc,
                    url_to_image=item.get("socialimage"),
                ))

            self.circuit_breaker.record_success()
            logger.debug(f"[NEWS] {self.name} returned {len(articles)} articles for '{query}'")
            return articles

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} timeout for query '{query}'")
            return []
        except requests.exceptions.HTTPError as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} HTTP error {e.response.status_code} for '{query}'")
            return []
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} error: {e}")
            return []


# ---------------------------------------------------------------------------
# Alpha Vantage Provider (optional, env-gated)
# ---------------------------------------------------------------------------

class AlphaVantageProvider(NewsProvider):
    """
    Alpha Vantage News & Sentiment API — optional tertiary provider.
    Requires free API key from https://www.alphavantage.co/support/#api-key
    Rate limit: 5 requests/day on free tier.
    """
    def __init__(self):
        super().__init__("alpha_vantage")
        self._api_key = os.environ.get("ALPHA_VANTAGE_API_KEY", "")
        self._base_url = "https://www.alphavantage.co/query"
        self._timeout = 12
        # Very conservative: 5/day free tier
        self.rate_limiter = RateLimiter(max_calls=4, window_seconds=86400.0)

    def is_available(self) -> bool:
        if not self._api_key:
            return False
        return self.circuit_breaker.is_available() and self.rate_limiter.allow()

    def fetch(self, query: str, max_results: int = 10) -> List[NormalizedArticle]:
        if not self.is_available():
            logger.debug(f"[NEWS] {self.name} unavailable (no API key or rate limited)")
            return []

        try:
            params = {
                "function": "NEWS_SENTIMENT",
                "tickers": query.upper(),
                "apikey": self._api_key,
                "limit": min(max_results, 50),
            }
            resp = requests.get(self._base_url, params=params, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("feed", [])[:max_results]:
                title = item.get("title", "") or ""
                summary = item.get("summary", "") or ""
                source = item.get("source", "Unknown")
                url = item.get("url", "#")
                published = item.get("time_published", "")

                articles.append(NormalizedArticle(
                    title=title,
                    source=source,
                    url=url,
                    published_at=published,
                    full_text=f"{title} {summary}".strip(),
                    provider=self.name,
                    description=summary,
                    url_to_image=item.get("banner_image"),
                ))

            self.circuit_breaker.record_success()
            logger.debug(f"[NEWS] {self.name} returned {len(articles)} articles for '{query}'")
            return articles

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            return []
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.warning(f"[NEWS] {self.name} error: {e}")
            return []


# ---------------------------------------------------------------------------
# Multi-Source News Aggregator
# ---------------------------------------------------------------------------

class MultiSourceNewsAggregator:
    """
    Orchestrates news fetching across multiple providers with:
    - Provider priority fallback (NewsData -> GDELT -> Alpha Vantage)
    - Circuit breaker per provider
    - Rate-limit protection per provider
    - Article deduplication across sources
    - Normalized schema output
    """
    def __init__(self):
        self.providers: List[NewsProvider] = [
            NewsDataProvider(),     # Primary: NewsData.io
            GDELTProvider(),        # Secondary: GDELT (free, no key)
            AlphaVantageProvider(), # Tertiary: Alpha Vantage (optional key)
        ]
        self._dedup_lock = threading.Lock()

    def fetch_news(
        self,
        ticker: str,
        max_results: int = 10,
        min_sources: int = 1,
    ) -> List[NormalizedArticle]:
        """
        Fetch news from providers in priority order.
        Falls back to next provider if primary fails or returns insufficient results.
        Deduplicates articles across sources.
        """
        all_articles: List[NormalizedArticle] = []
        seen_fingerprints: set = set()

        for provider in self.providers:
            if not provider.is_available():
                logger.debug(f"[NEWS] Skipping {provider.name} (unavailable)")
                continue

            try:
                start = time.perf_counter()
                articles = provider.fetch(ticker, max_results=max_results)
                latency = (time.perf_counter() - start) * 1000

                provider._metrics["total_calls"] += 1
                provider._metrics["total_latency_ms"] += latency

                if articles:
                    provider._metrics["successes"] += 1
                else:
                    provider._metrics["failures"] += 1

                for article in articles:
                    fp = article.fingerprint()
                    if fp not in seen_fingerprints:
                        seen_fingerprints.add(fp)
                        all_articles.append(article)

                logger.info(
                    f"[NEWS] {provider.name} contributed {len(articles)} articles "
                    f"(total unique: {len(all_articles)}) for '{ticker}' "
                    f"latency={latency:.0f}ms"
                )

                if len(all_articles) >= max_results:
                    break

            except Exception as e:
                provider._metrics["total_calls"] += 1
                provider._metrics["failures"] += 1
                logger.warning(f"[NEWS] {provider.name} failed for '{ticker}': {e}")
                continue

        # Sort by recency (most recent first) — best-effort since formats vary
        all_articles.sort(key=lambda a: a.published_at or "", reverse=True)

        logger.info(
            f"[NEWS] Aggregated {len(all_articles)} unique articles for '{ticker}' "
            f"from {len(set(a.provider for a in all_articles))} provider(s)"
        )

        return all_articles[:max_results]

    def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """Return health status and metrics of all providers."""
        status = {}
        for provider in self.providers:
            m = provider._metrics
            avg_latency = (m["total_latency_ms"] / m["total_calls"]) if m["total_calls"] > 0 else 0.0
            status[provider.name] = {
                "available": provider.is_available(),
                "circuit_state": provider.circuit_breaker.state,
                "total_calls": m["total_calls"],
                "successes": m["successes"],
                "failures": m["failures"],
                "avg_latency_ms": round(avg_latency, 1),
                "rate_limiter_calls": len(provider.rate_limiter._calls),
            }
        return status


# ---------------------------------------------------------------------------
# Global Singleton
# ---------------------------------------------------------------------------

news_aggregator = MultiSourceNewsAggregator()
