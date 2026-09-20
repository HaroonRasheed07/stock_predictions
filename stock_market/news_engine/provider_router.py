"""
provider_router.py — Quota-aware provider selection and orchestration.

Reservoir strategy:
1. Build one unified candidate reservoir across ALL providers and time windows
2. Progressively expand time windows (24h → 72h → 7d) if insufficient unique relevant articles
3. Never stop early based on raw article count — only stop when unique relevant count >= target
4. Cache merge: always merge new fetch with valid cached articles, never replace
5. Free providers (RSS, GDELT) are never skipped and never stopped early

Key principles:
- Target 8 articles after relevance + dedup
- Minimum desired: 5 articles
- Fetch more candidates than needed (relevance filter removes many)
- Never stop when raw count is high but unique relevant count is low
- Marketaux is scarce: enrich only, never dependency
- RSS is free: always try first
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

from .models import NewsArticle, CompanyIdentity
from .providers import get_all_providers, NewsProvider
from .provider_budget import budget_manager, ProviderState

logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────────

TARGET_NEWS_COUNT = 8               # Canonical target after relevance + dedup
MIN_DESIRED_NEWS_COUNT = 5          # Minimum desired (strong attempt to reach)
MAX_CANDIDATES = 80                 # Cap on raw candidates per ticker

# Progressive time windows (days)
NEWS_PRIMARY_WINDOW_DAYS = 1        # Stage A: 0-24h
NEWS_SECONDARY_WINDOW_DAYS = 3      # Stage B: 0-72h
NEWS_MAX_AGE_DAYS = 7               # Stage C: 0-7d (absolute max)

# Coverage status thresholds
COVERAGE_FULL = "FULL"             # 8+
COVERAGE_GOOD = "GOOD"             # 5-7
COVERAGE_PARTIAL = "PARTIAL"       # 3-4
COVERAGE_INSUFFICIENT = "INSUFFICIENT"  # 1-2
COVERAGE_NONE = "NONE"             # 0


def get_coverage_status(count: int) -> str:
    """Determine coverage status from article count."""
    if count >= TARGET_NEWS_COUNT:
        return COVERAGE_FULL
    elif count >= MIN_DESIRED_NEWS_COUNT:
        return COVERAGE_GOOD
    elif count >= 3:
        return COVERAGE_PARTIAL
    elif count >= 1:
        return COVERAGE_INSUFFICIENT
    return COVERAGE_NONE


# Provider roles
ROLE_RSS = "rss"              # Free, always try first (fresh)
ROLE_FRESH = "fresh"          # Primary fresh source (Currents)
ROLE_ENRICHMENT = "enrichment" # Scarce source (Marketaux)
ROLE_GAP_FILL = "gap_fill"    # Delayed/fallback (NewsData)
ROLE_SUPPLEMENT = "supplement" # Backup (GDELT)

# Provider role assignments — WATERFALL ORDER
PROVIDER_ROLES = {
    "rss": ROLE_RSS,
    "currents": ROLE_FRESH,
    "marketaux": ROLE_ENRICHMENT,
    "newsdata": ROLE_GAP_FILL,
    "gdelt": ROLE_SUPPLEMENT,
}

# Provider waterfall priority (lower = earlier)
PROVIDER_WATERFALL_PRIORITY = {
    "rss": 0,
    "currents": 1,
    "marketaux": 2,
    "newsdata": 3,
    "gdelt": 4,
}


# ─── Provider Router ────────────────────────────────────────────────────────

class ProviderRouter:
    """
    Selects providers based on reservoir strategy:
    1. Cache (already have articles) — always included
    2. RSS (free, fresh)
    3. Currents (fresh API)
    4. Marketaux (enrichment, if quota allows)
    5. NewsData (gap-fill)
    6. GDELT (supplement)
    
    Does NOT stop early — the engine tracks unique relevant count.
    """

    def __init__(self):
        pass

    def select_providers(
        self,
        cached_article_count: int = 0,
        target_count: int = TARGET_NEWS_COUNT,
        ticker_type: str = "stock",
    ) -> List[str]:
        """
        Return ordered list of provider names to call (waterfall order).
        
        Always returns ALL available providers — the engine decides when to stop
        based on unique relevant count, not raw count.
        """
        all_providers = get_all_providers()
        available = {p.name: p for p in all_providers if p.is_available()}
        selected = []

        for name in sorted(
            available.keys(),
            key=lambda n: PROVIDER_WATERFALL_PRIORITY.get(n, 99)
        ):
            if not budget_manager.can_call(name):
                logger.info(f"[ROUTER] Skipping {name} (quota exhausted or cooldown)")
                continue
            selected.append(name)

        return selected

    def should_stop_fetching(
        self,
        unique_relevant_count: int,
        target_count: int = TARGET_NEWS_COUNT,
        providers_called: int = 0,
        current_provider: str = "",
    ) -> bool:
        """Determine if we should stop calling providers.

        ONLY stops when unique relevant articles >= target.
        Free providers (rss, gdelt) are NEVER stopped — they cost nothing.
        Raw count is NOT used — only unique relevant count after dedup.
        """
        # Never stop free providers — they cost nothing
        if current_provider in ("rss", "gdelt"):
            return False

        # Stop when we have enough unique relevant articles
        if unique_relevant_count >= target_count:
            return True

        return False

    def get_provider_priority(self, provider_name: str) -> int:
        """Lower number = higher priority. Used for ordering."""
        return PROVIDER_WATERFALL_PRIORITY.get(provider_name, 99)


# ─── Observability ──────────────────────────────────────────────────────────

class FetchMetrics:
    """Track fetch metrics for observability."""

    def __init__(self):
        self.provider_calls: Dict[str, int] = {}
        self.provider_successes: Dict[str, int] = {}
        self.provider_failures: Dict[str, int] = {}
        self.cache_hits = 0
        self.cache_misses = 0
        self.stale_cache_hits = 0
        self.singleflight_coalesced = 0
        self.articles_fetched = 0
        self.articles_after_relevance = 0
        self.articles_after_dedup = 0
        self._start_time = 0

    def start(self):
        self._start_time = __import__("time").time()

    def record_provider_call(self, provider: str, success: bool):
        self.provider_calls[provider] = self.provider_calls.get(provider, 0) + 1
        if success:
            self.provider_successes[provider] = self.provider_successes.get(provider, 0) + 1
        else:
            self.provider_failures[provider] = self.provider_failures.get(provider, 0) + 1

    def summary(self) -> Dict:
        elapsed = __import__("time").time() - self._start_time if self._start_time else 0
        total_calls = sum(self.provider_calls.values())
        return {
            "elapsed_ms": round(elapsed * 1000, 1),
            "provider_calls": dict(self.provider_calls),
            "provider_successes": dict(self.provider_successes),
            "provider_failures": dict(self.provider_failures),
            "total_provider_calls": total_calls,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "stale_cache_hits": self.stale_cache_hits,
            "singleflight_coalesced": self.singleflight_coalesced,
            "articles_fetched": self.articles_fetched,
            "articles_after_relevance": self.articles_after_relevance,
            "articles_after_dedup": self.articles_after_dedup,
        }


# ─── Singleton ──────────────────────────────────────────────────────────────

provider_router = ProviderRouter()
fetch_metrics = FetchMetrics()
