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

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from .models import NewsArticle, ProviderResult, SourceType, CompanyIdentity
from .company_resolver import get_search_queries

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    """Parse a boolean env flag (1/true/yes/on enable)."""
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _identity_terms(company: CompanyIdentity, ticker: str) -> List[str]:
    """Distinct, word-boundary-safe search terms for a company (deduplicated)."""
    terms: List[str] = []
    seen = set()

    def _add(t: str):
        t = (t or "").strip()
        if not t or len(t) < 2:
            return
        key = t.lower()
        if key in seen:
            return
        seen.add(key)
        terms.append(t)

    _add(company.canonical_name)
    _add(company.short_name)
    for alias in company.aliases:
        _add(alias)
    _add(ticker)
    return terms


def _text_mentions(text: str, company: CompanyIdentity, ticker: str) -> bool:
    """True when text mentions the company (word-boundary match, no bare substrings)."""
    low = (text or "").lower()
    for term in _identity_terms(company, ticker):
        if re.search(r"(?<![\w])" + re.escape(term.lower()) + r"(?![\w])", low):
            return True
    return False


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

    def is_available(self) -> bool:
        # Free-tier NewsData license does NOT cover commercial use — keep it
        # disabled unless explicitly opted in (see NEWS_SOURCES.md / final report).
        if not _env_flag("ENABLE_NEWSDATA", default=False):
            return False
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
            # Quoted multi-word name queries drastically improve precision
            # (q=Dell returns junk; q="Dell Technologies" returns company news).
            queries_to_try = []
            for q in _identity_terms(company, ticker)[:3]:
                queries_to_try.append(f'"{q}"' if " " in q else q)
            queries_to_try.append(f"{ticker} stock")

            all_articles = []
            seen_urls = set()

            for query in queries_to_try[:3]:
                encoded = quote(query, safe="")
                url = (
                    f"{self._base_url}?apikey={self._api_key}&q={encoded}"
                    f"&language=en&size={min(max_results, 10)}"
                )
                resp = requests.get(url, timeout=self._timeout)
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("results", [])[:max_results]:
                    link = item.get("link", "#")
                    if link in seen_urls:
                        continue
                    seen_urls.add(link)

                    title = item.get("title", "") or ""
                    desc = item.get("description", "") or ""
                    all_articles.append(NewsArticle(
                        title=title,
                        description=desc,
                        url=link,
                        publisher=item.get("source_id", "Unknown"),
                        published_at=item.get("pubDate", ""),
                        provider=self.name,
                        provider_article_id=item.get("article_id", ""),
                        source_type=SourceType.AGGREGATOR,
                        ticker=ticker,
                    ))

                if len(all_articles) >= max_results:
                    break

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
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

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error="timeout")
        except requests.exceptions.HTTPError as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            status_code = e.response.status_code if e.response is not None else 0
            body = ""
            try:
                body = (e.response.text or "")[:160] if e.response is not None else ""
            except Exception:
                pass
            result = ProviderResult(
                provider=self.name, success=False,
                error=f"HTTP {status_code} {body}".strip(),
            )
            result._http_status = status_code
            return result
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
        correlation_id = f"mx-{ticker}-{int(time.time())}"
        try:
            published_after = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%S")
            # Free plan caps articles per request (observed: 3); asking for more
            # returns a warning and clamps. Request the plan size directly.
            page_size = int(os.environ.get("MARKETAUX_PAGE_SIZE", "3"))
            params = {
                "api_token": self._api_key,
                "symbols": ticker,
                "language": "en",
                "published_after": published_after,
                "limit": min(max_results, page_size),
                "group_similar": "true",
                "filter_entities": "true",
                "must_have_entities": "true",
            }
            resp = requests.get(f"{self._base_url}/news/all", params=params, timeout=self._timeout)

            # Extract header-based usage tracking before raise_for_status.
            # X-UsageLimit-Remaining = plan quota (what we want);
            # X-RateLimit-Remaining = per-minute limiter (separate).
            quota_remaining = None
            usage_pct = None
            try:
                qr = resp.headers.get("X-UsageLimit-Remaining") or resp.headers.get("X-RateLimit-Remaining")
                if qr is not None:
                    quota_remaining = int(qr)
                up = resp.headers.get("X-UsageLimit-Usage") or resp.headers.get("X-RateLimit-Usage")
                if up is not None:
                    usage_pct = float(up.replace("%", "")) / 100.0
            except (ValueError, TypeError, AttributeError):
                pass

            resp.raise_for_status()
            data = resp.json()

            articles = []
            for item in data.get("data", [])[:max_results]:
                title = item.get("title", "") or ""
                desc = item.get("description", "") or ""
                entities = item.get("entities", [])
                raw_sentiment = ""
                raw_score = 0.0
                matched = []
                best_match_score = 0.0
                entity_cnt = len(entities)
                if entities:
                    for ent in entities:
                        ent_symbol = ent.get("symbol", "").upper()
                        ent_name = ent.get("name", "")
                        match_score = ent.get("match_score", 0.0)
                        matched.append(ent_name)
                        if ent_symbol == ticker.upper():
                            raw_sentiment = ent.get("sentiment", "")
                            raw_score = ent.get("sentiment_score", 0.0)
                            best_match_score = max(best_match_score, match_score)
                if not matched:
                    matched = [company.short_name] if company.short_name else []

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
                    entity_match_score=best_match_score,
                    entity_count=entity_cnt,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency

            result = ProviderResult(
                provider=self.name,
                articles=articles,
                success=True,
                latency_ms=latency,
                raw_count=len(articles),
            )
            # Attach header-derived data for budget tracking
            result.quota_remaining = quota_remaining
            result._correlation_id = correlation_id
            return result

        except requests.exceptions.Timeout:
            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            result = ProviderResult(provider=self.name, success=False, error="timeout")
            result._correlation_id = correlation_id
            return result
        except requests.exceptions.HTTPError as e:
            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            status_code = e.response.status_code if e.response is not None else 0
            body = ""
            try:
                body = (e.response.text or "")[:160] if e.response is not None else ""
            except Exception:
                pass
            result = ProviderResult(
                provider=self.name, success=False,
                error=f"HTTP {status_code} {body}".strip(),
            )
            result._http_status = status_code
            result._correlation_id = correlation_id
            return result
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            result = ProviderResult(provider=self.name, success=False, error=str(e))
            result._correlation_id = correlation_id
            return result


# ─── Currents ───────────────────────────────────────────────────────────────

class CurrentsProvider(NewsProvider):
    def __init__(self):
        super().__init__("currents")
        self._api_key = os.environ.get("CURRENTS_API_KEY", "")
        self._base_url = "https://api.currentsapi.services/v1"
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=200, window_seconds=86400.0)

    def is_available(self) -> bool:
        if not _env_flag("ENABLE_CURRENTS", default=True):
            return False
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
            start_date = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

            # Deduplicated identity terms; try up to 3 per fetch for coverage
            queries_to_try = _identity_terms(company, ticker)

            all_articles = []
            seen_urls = set()

            for query in queries_to_try[:3]:  # Try up to 3 queries for better coverage
                params = {
                    "apiKey": self._api_key,
                    "keywords": query,
                    "language": "en",
                    "start_date": start_date,
                    "category": "business",
                }
                resp = requests.get(f"{self._base_url}/search", params=params, timeout=self._timeout)
                resp.raise_for_status()
                resp.encoding = 'utf-8'
                data = resp.json()

                for item in data.get("news", []):
                    url = item.get("url", "#")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    title = item.get("title", "") or ""
                    desc = item.get("description", "") or ""
                    all_articles.append(NewsArticle(
                        title=title,
                        description=desc,
                        url=url,
                        publisher=item.get("author", "Unknown") or item.get("source", "Unknown"),
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
                articles=all_articles[:max_results],
                success=True,
                latency_ms=latency,
                raw_count=len(all_articles),
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
            status_code = e.response.status_code if e.response is not None else 0
            body = ""
            try:
                body = (e.response.text or "")[:160] if e.response is not None else ""
            except Exception:
                pass
            result = ProviderResult(
                provider=self.name, success=False,
                error=f"HTTP {status_code} {body}".strip(),
            )
            result._http_status = status_code
            return result
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── GDELT ──────────────────────────────────────────────────────────────────

# GDELT asks for >= 1 request / 5 seconds (429 otherwise). The limiter is
# process-wide because provider instances are recreated per pipeline run.
_GDELT_LOCK = threading.Lock()
_GDELT_LAST_CALL = [0.0]
GDELT_MIN_INTERVAL_SECONDS = float(os.environ.get("GDELT_MIN_INTERVAL_SECONDS", "6"))


class GDELTProvider(NewsProvider):
    def __init__(self):
        super().__init__("gdelt")
        self._base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
        self._timeout = 15
        self.rate_limiter = RateLimiter(max_calls=10, window_seconds=60.0)

    def _wait_for_slot(self):
        """Ensure >= GDELT_MIN_INTERVAL_SECONDS between calls (process-wide)."""
        with _GDELT_LOCK:
            elapsed = time.time() - _GDELT_LAST_CALL[0]
            wait = GDELT_MIN_INTERVAL_SECONDS - elapsed
            if wait > 0:
                time.sleep(wait)
            _GDELT_LAST_CALL[0] = time.time()

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
            # ONE query per fetch: prefer a multi-word company name as a phrase
            # ("Dell Technologies"), which is precise; bare tickers are noisy.
            terms = _identity_terms(company, ticker)
            phrase = next((t for t in terms if " " in t), terms[0] if terms else ticker)
            query = f'"{phrase}"' if " " in phrase else phrase

            self._wait_for_slot()
            params = {
                "query": query,
                "mode": "ArtList",
                "maxrecords": min(max_results, 50),
                "format": "json",
                "sort": "DateDesc",
                "timespan": f"{lookback_days}d",
                "sourcelang": "eng",
                "include": "Title,Description",
            }
            headers = {"User-Agent": "StockVantex/1.0 (news aggregation; admin@stockvantex.com)"}
            resp = requests.get(self._base_url, params=params, timeout=self._timeout, headers=headers)
            if resp.status_code == 429:
                # Preserve the guidance text so the budget manager applies the
                # short rate-limit cooldown instead of a daily one.
                result = ProviderResult(
                    provider=self.name, success=False,
                    error=f"HTTP 429 {(resp.text or '')[:160]}",
                )
                result._http_status = 429
                self.circuit_breaker.record_failure()
                self._metrics["total_calls"] += 1
                self._metrics["failures"] += 1
                return result
            resp.raise_for_status()
            data = resp.json()

            articles = []
            seen_urls = set()
            for item in data.get("articles", []):
                url = item.get("url", "#")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                articles.append(NewsArticle(
                    title=item.get("title", "") or "",
                    description=item.get("seendescription", "") or "",
                    url=url,
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

# Verified public RSS feeds for financial news (live-probed: HTTP 200 + items).
# Dead feeds (reutersagency, yahoo rssindex, empty businesswire) are removed.
_RSS_SOURCES = [
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
        "id": "wsj_markets",
        "name": "WSJ Markets",
        "url": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "markets",
    },
    {
        "id": "bloomberg_markets",
        "name": "Bloomberg Markets",
        "url": "https://feeds.bloomberg.com/markets/news.rss",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "markets",
    },
    {
        "id": "ft_markets",
        "name": "FT Markets",
        "url": "https://www.ft.com/markets?format=rss",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "markets",
    },
    {
        "id": "seeking_alpha",
        "name": "Seeking Alpha",
        "url": "https://seekingalpha.com/market_currents.xml",
        "source_type": SourceType.PUBLISHER_RSS,
        "category": "general_finance",
    },
    {
        "id": "prnewswire_fin",
        "name": "PR Newswire",
        "url": "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss",
        "source_type": SourceType.COMPANY_OFFICIAL,
        "category": "press_releases",
    },
    {
        "id": "prnewswire_tech",
        "name": "PR Newswire",
        "url": "https://www.prnewswire.com/rss/technology-latest-news/technology-latest-news-list.rss",
        "source_type": SourceType.COMPANY_OFFICIAL,
        "category": "press_releases",
    },
]

# Shared parsed-feed cache: the same feeds are re-fetched for every ticker and
# every pipeline stage. Parse once per 5 minutes process-wide.
_FEED_CACHE: Dict[str, Tuple[float, List[Dict[str, str]]]] = {}
_FEED_CACHE_TTL = 300.0
_FEED_CACHE_LOCK = threading.Lock()


def _parse_feed_items(content: str, limit: int = 100) -> List[Dict[str, str]]:
    items = []
    for item_xml in re.findall(r"<item>(.*?)</item>", content, re.DOTALL)[:limit]:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", item_xml, re.DOTALL)
        link_match = re.search(r"<link[^>]*>(.*?)</link>", item_xml, re.DOTALL)
        desc_match = re.search(r"<description[^>]*>(.*?)</description>", item_xml, re.DOTALL)
        pub_match = re.search(r"<pubDate[^>]*>(.*?)</pubDate>", item_xml, re.DOTALL)

        title = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", title_match.group(1)).strip() if title_match else ""
        link = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", link_match.group(1)).strip() if link_match else ""
        desc = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", desc_match.group(1)).strip() if desc_match else ""
        desc = re.sub(r"<[^>]+>", "", desc).strip()
        pub_date = pub_match.group(1).strip() if pub_match else ""
        if title:
            items.append({"title": title, "link": link, "description": desc, "pubDate": pub_date})
    return items


def _get_feed_items(url: str, timeout: int = 12) -> List[Dict[str, str]]:
    """Fetch+parse an RSS feed with a 5-minute shared cache."""
    now = time.time()
    with _FEED_CACHE_LOCK:
        cached = _FEED_CACHE.get(url)
        if cached and now - cached[0] < _FEED_CACHE_TTL:
            return cached[1]
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": "StockVantex/1.0 (news aggregation; admin@stockvantex.com)"})
    resp.raise_for_status()
    items = _parse_feed_items(resp.text)
    with _FEED_CACHE_LOCK:
        _FEED_CACHE[url] = (time.time(), items)
    return items


class RSSProvider(NewsProvider):
    def __init__(self):
        super().__init__("rss")
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=100, window_seconds=60.0)

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
            except Exception as e:
                logger.debug(f"[RSS] {source['id']} error: {e}")
                continue

        latency = (time.perf_counter() - start) * 1000
        self._metrics["total_calls"] += 1
        self._metrics["successes"] += 1
        self._metrics["total_latency_ms"] += latency

        return ProviderResult(
            provider=self.name,
            articles=all_articles,
            success=True,
            latency_ms=latency,
            raw_count=len(all_articles),
        )

    def _fetch_feed(self, source: dict, ticker: str, company: CompanyIdentity, lookback_days: int) -> List[NewsArticle]:
        """Fetch (cached) feed items and keep only company mentions.

        Identity terms are matched with word boundaries — the old substring
        matching let sector keywords like 'ai' match 'daily' and flooded the
        reservoir with articles that could never pass relevance scoring.
        """
        items = _get_feed_items(source["url"], timeout=self._timeout)

        articles = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        for item in items:
            title = item["title"]
            link = item["link"]
            desc = item["description"]
            pub_date = item["pubDate"]

            if not _text_mentions(f"{title} {desc}", company, ticker):
                continue

            # Recency filter when we can parse the date
            if pub_date:
                try:
                    parsed = datetime.strptime(pub_date[:22].strip(), "%a, %d %b %Y %H:%M:%S %z")
                    if parsed < cutoff:
                        continue
                except (ValueError, TypeError):
                    try:
                        parsed = datetime.strptime(pub_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        if parsed < cutoff:
                            continue
                    except (ValueError, TypeError):
                        pass

            articles.append(NewsArticle(
                title=title,
                description=desc[:500],
                url=link,
                publisher=source["name"],
                published_at=pub_date,
                provider="rss",
                provider_article_id=f"{source['id']}_{hashlib.md5(title.encode()).hexdigest()[:8]}",
                source_type=source["source_type"],
                ticker=ticker,
            ))

        return articles


# ─── Yahoo Finance per-ticker RSS (free, headline display + link permitted) ─

_YAHOO_RSS_CACHE: Dict[str, Tuple[float, List[Dict[str, str]]]] = {}
_YAHOO_RSS_CACHE_TTL = 300.0
_YAHOO_RSS_LOCK = threading.Lock()


class YahooRSSProvider(NewsProvider):
    """Per-ticker headlines from Yahoo Finance RSS (~50% ticker relevance)."""

    def __init__(self):
        super().__init__("yahoo_rss")
        self._timeout = 10
        self.rate_limiter = RateLimiter(max_calls=60, window_seconds=60.0)

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
            key = ticker.upper()
            now = time.time()
            with _YAHOO_RSS_LOCK:
                cached = _YAHOO_RSS_CACHE.get(key)
                if cached and now - cached[0] < _YAHOO_RSS_CACHE_TTL:
                    items = cached[1]
                else:
                    items = None

            if items is None:
                url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={quote(key)}&region=US&lang=en-US"
                resp = requests.get(url, timeout=self._timeout,
                                    headers={"User-Agent": "StockVantex/1.0 (news aggregation; admin@stockvantex.com)"})
                resp.raise_for_status()
                items = _parse_feed_items(resp.text, limit=50)
                with _YAHOO_RSS_LOCK:
                    _YAHOO_RSS_CACHE[key] = (time.time(), items)

            articles = [
                NewsArticle(
                    title=item["title"],
                    description=item["description"][:500],
                    url=item["link"],
                    publisher="Yahoo Finance",
                    published_at=item["pubDate"],
                    provider=self.name,
                    provider_article_id=f"yf_{hashlib.md5(item['title'].encode()).hexdigest()[:8]}",
                    source_type=SourceType.PUBLISHER_RSS,
                    ticker=ticker,
                )
                for item in items if item.get("title")
            ]

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency
            return ProviderResult(
                provider=self.name, articles=articles, success=True,
                latency_ms=latency, raw_count=len(articles),
            )
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── Google News RSS (DISABLED by default: Google News ToS = non-commercial) ─

class GoogleNewsRSSProvider(NewsProvider):
    """Google News RSS search. Off by default — Google News ToS restricts
    commercial/automated reuse. Enable only after legal review (ENABLE_GOOGLE_NEWS_RSS)."""

    def __init__(self):
        super().__init__("google_news_rss")
        self._timeout = 10
        self.rate_limiter = RateLimiter(max_calls=10, window_seconds=60.0)

    def is_available(self) -> bool:
        return _env_flag("ENABLE_GOOGLE_NEWS_RSS", default=False) and \
            self.circuit_breaker.state != CircuitBreaker.OPEN

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
            terms = _identity_terms(company, ticker)
            phrase = next((t for t in terms if " " in t), terms[0] if terms else ticker)
            q = f'"{phrase}" when:{max(1, lookback_days)}d'
            url = f"https://news.google.com/rss/search?q={quote(q)}&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(url, timeout=self._timeout,
                                headers={"User-Agent": "StockVantex/1.0"})
            resp.raise_for_status()
            items = _parse_feed_items(resp.text, limit=50)

            articles = [
                NewsArticle(
                    title=item["title"],
                    description=item["description"][:500],
                    url=item["link"],
                    publisher="Google News",
                    published_at=item["pubDate"],
                    provider=self.name,
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                )
                for item in items if item.get("title")
            ][:max_results]

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency
            return ProviderResult(
                provider=self.name, articles=articles, success=True,
                latency_ms=latency, raw_count=len(articles),
            )
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── Alpha Vantage NEWS_SENTIMENT (DISABLED by default: free tier = non-commercial)

class AlphaVantageProvider(NewsProvider):
    """Alpha Vantage NEWS_SENTIMENT. Off by default — the free tier license is
    personal/non-commercial (see report §licensing). Enable only after a written
    commercial agreement (ENABLE_ALPHAVANTAGE + valid ALPHAVANTAGE_API_KEY)."""

    def __init__(self):
        super().__init__("alphavantage")
        self._api_key = os.environ.get("ALPHAVANTAGE_API_KEY", "")
        self._timeout = 12
        self.rate_limiter = RateLimiter(max_calls=25, window_seconds=86400.0)

    def is_available(self) -> bool:
        if not _env_flag("ENABLE_ALPHAVANTAGE", default=False):
            return False
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
            params = {
                "function": "NEWS_SENTIMENT",
                "tickers": ticker,
                "limit": min(max_results, 50),
                "apikey": self._api_key,
            }
            resp = requests.get("https://www.alphavantage.co/query", params=params, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()

            if data.get("Note") or data.get("Error Message"):
                msg = data.get("Note") or data.get("Error Message")
                result = ProviderResult(provider=self.name, success=False, error=f"HTTP 429 {msg}")
                result._http_status = 429
                return result

            articles = []
            for item in data.get("feed", [])[:max_results]:
                raw_label, raw_score = "", 0.0
                for ts in item.get("ticker_sentiment", []):
                    if ts.get("ticker", "").upper() == ticker.upper():
                        raw_score = float(ts.get("ticker_sentiment_score", 0) or 0)
                        raw_label = "positive" if raw_score > 0.15 else "negative" if raw_score < -0.15 else "neutral"
                articles.append(NewsArticle(
                    title=item.get("title", "") or "",
                    description=item.get("summary", "") or "",
                    url=item.get("url", "#"),
                    publisher=item.get("source", "Unknown"),
                    published_at=item.get("time_published", ""),
                    provider=self.name,
                    provider_article_id=item.get("title", "")[:64],
                    source_type=SourceType.AGGREGATOR,
                    ticker=ticker,
                    raw_sentiment_label=raw_label,
                    raw_sentiment_score=raw_score,
                ))

            latency = (time.perf_counter() - start) * 1000
            self.circuit_breaker.record_success()
            self._metrics["total_calls"] += 1
            self._metrics["successes"] += 1
            self._metrics["total_latency_ms"] += latency
            return ProviderResult(
                provider=self.name, articles=articles, success=True,
                latency_ms=latency, raw_count=len(articles),
            )
        except Exception as e:
            self.circuit_breaker.record_failure()
            self._metrics["total_calls"] += 1
            self._metrics["failures"] += 1
            return ProviderResult(provider=self.name, success=False, error=str(e))


# ─── Provider Registry ──────────────────────────────────────────────────────

def get_all_providers() -> List[NewsProvider]:
    """Return all registered providers in priority order.

    Flag-gated providers (Google News RSS, Alpha Vantage, NewsData) only
    appear when their ENABLE_* flag is on — see licensing notes in the report.
    """
    providers: List[NewsProvider] = [
        RSSProvider(),
        YahooRSSProvider(),
        CurrentsProvider(),
        MarketauxProvider(),
        NewsDataProvider(),
        GDELTProvider(),
    ]
    if _env_flag("ENABLE_GOOGLE_NEWS_RSS", default=False):
        providers.append(GoogleNewsRSSProvider())
    if _env_flag("ENABLE_ALPHAVANTAGE", default=False):
        providers.append(AlphaVantageProvider())
    return providers


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
