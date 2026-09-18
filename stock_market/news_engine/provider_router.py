"""
provider_router.py — Quota-aware provider selection and orchestration.

Waterfall strategy (freshness-first):
1. Cache / existing recent articles
2. RSS (free, fresh)
3. Currents (fresh coverage)
4. Marketaux (high-precision enrichment, scarce)
5. NewsData (gap-fill, may be delayed)
6. GDELT (free supplement)

Key principles:
- Target 8 articles after relevance + dedup
- Fetch more candidates than needed (2x target)
- Stop immediately when adequate coverage exists
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

TARGET_NEWS_COUNT = 8           # Canonical target after relevance + dedup
CANDIDATE_MULTIPLIER = 2.5      # Fetch 2.5x candidates to ensure 8 after pipeline
MAX_CANDIDATES = 25             # Cap on raw candidates per ticker

# Freshness windows (hours)
FRESHNESS_WINDOW_PRIMARY = 24    # First try: last 24 hours
FRESHNESS_WINDOW_SECONDARY = 72  # Expand to 72 hours if needed
FRESHNESS_WINDOW_MAX = 168       # Maximum: 7 days

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
    Selects providers based on waterfall strategy:
    1. Cache (already have articles)
    2. RSS (free, fresh)
    3. Currents (fresh API)
    4. Marketaux (enrichment, if quota allows)
    5. NewsData (gap-fill)
    6. GDELT (supplement)
    
    Stops when target count reached.
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

        Strategy:
        1. If cache already has enough -> no providers needed
        2. RSS first (free, fresh)
        3. Currents (fresh coverage)
        4. Marketaux ONLY if still below target and quota allows
        5. NewsData for gap-fill
        6. GDELT as last resort
        """
        needed = target_count - cached_article_count
        if needed <= 0:
            return []

        all_providers = get_all_providers()
        available = {p.name: p for p in all_providers if p.is_available()}
        selected = []

        # Waterfall: follow the priority order strictly
        for name in sorted(
            available.keys(),
            key=lambda n: PROVIDER_WATERFALL_PRIORITY.get(n, 99)
        ):
            if not budget_manager.can_call(name):
                logger.info(f"[ROUTER] Skipping {name} (quota exhausted or cooldown)")
                continue

            role = PROVIDER_ROLES.get(name, ROLE_SUPPLEMENT)

            # Marketaux: only add if still need more after free + fresh sources
            if role == ROLE_ENRICHMENT:
                estimated_from_earlier = cached_article_count + (8 * len(selected))
                if estimated_from_earlier >= target_count * CANDIDATE_MULTIPLIER:
                    logger.info(f"[ROUTER] Skipping {name} (estimated {estimated_from_earlier} >= target {target_count})")
                    continue

            selected.append(name)

        return selected

    def should_stop_fetching(
        self,
        articles_collected: int,
        target_count: int = TARGET_NEWS_COUNT,
        providers_called: int = 0,
    ) -> bool:
        """Determine if we should stop calling providers."""
        # Stop if we have enough raw candidates
        if articles_collected >= target_count * CANDIDATE_MULTIPLIER:
            return True
        # Hard cap
        if articles_collected >= MAX_CANDIDATES:
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
