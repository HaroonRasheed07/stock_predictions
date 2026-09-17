"""
provider_router.py — Quota-aware provider selection and orchestration.

Decides WHICH providers to call, in WHAT order, and WHEN to stop.

Key principles:
- Marketaux is scarce: use only when primary sources are insufficient
- RSS is free: always try first
- GDELT is free: use as supplement
- Stop fetching when target article count is reached
- Never call exhausted providers
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

from .models import NewsArticle, CompanyIdentity
from .providers import get_all_providers, NewsProvider
from .provider_budget import budget_manager, ProviderState

logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────────

TARGET_ARTICLES = 10          # Desired final article count
CANDIDATE_MULTIPLIER = 2.5    # Fetch 2.5x candidates to ensure 10 after dedup
MAX_CANDIDATES = 25           # Cap on raw candidates per ticker

# Provider roles
ROLE_RSS = "rss"              # Free, always try
ROLE_PRIMARY = "primary"      # Main API source (NewsData/Currents)
ROLE_ENRICHMENT = "enrichment" # Scarce source (Marketaux)
ROLE_SUPPLEMENT = "supplement" # Backup (GDELT)

# Provider role assignments
PROVIDER_ROLES = {
    "rss": ROLE_RSS,
    "gdelt": ROLE_SUPPLEMENT,
    "newsdata": ROLE_PRIMARY,
    "currents": ROLE_PRIMARY,
    "marketaux": ROLE_ENRICHMENT,
}


# ─── Provider Router ────────────────────────────────────────────────────────

class ProviderRouter:
    """
    Selects providers based on:
    - Cached article count
    - Target count
    - Provider health/quota
    - Provider role priority
    """

    def __init__(self):
        pass

    def select_providers(
        self,
        cached_article_count: int = 0,
        target_count: int = TARGET_ARTICLES,
        ticker_type: str = "stock",
    ) -> List[str]:
        """
        Return ordered list of provider names to call.

        Strategy:
        1. If cache already has enough -> no providers needed
        2. Always include free sources (RSS, GDELT)
        3. Add primary sources if needed
        4. Add Marketaux ONLY if still below target and quota allows
        """
        needed = target_count - cached_article_count
        if needed <= 0:
            return []

        all_providers = get_all_providers()
        available = {p.name: p for p in all_providers if p.is_available()}
        selected = []

        # Phase 1: Free sources first (RSS + GDELT)
        for name in ["rss", "gdelt"]:
            if name in available and budget_manager.can_call(name):
                selected.append(name)

        # Phase 2: Primary sources (NewsData, Currents)
        # Add until we think we have enough candidates
        estimated_from_free = cached_article_count + (5 * len(selected))  # rough estimate
        if estimated_from_free < target_count * CANDIDATE_MULTIPLIER:
            for name in ["newsdata", "currents"]:
                if name in available and budget_manager.can_call(name):
                    selected.append(name)
                    # Re-estimate after adding
                    estimated_from_free += 8  # rough estimate per primary

        # Phase 3: Marketaux only if still need more
        # Check: do we have enough from free + primary?
        estimated_total = cached_article_count + (5 * len([n for n in selected if PROVIDER_ROLES.get(n) != ROLE_ENRICHMENT]))
        if estimated_total < target_count and "marketaux" in available:
            if budget_manager.can_call("marketaux"):
                selected.append("marketaux")
                logger.info(f"[ROUTER] Adding Marketaux for enrichment (estimated {estimated_total} < target {target_count})")
            else:
                logger.info(f"[ROUTER] Marketaux skipped (quota exhausted or cooldown)")

        return selected

    def should_stop_fetching(
        self,
        articles_collected: int,
        target_count: int = TARGET_ARTICLES,
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
        role = PROVIDER_ROLES.get(provider_name, ROLE_SUPPLEMENT)
        priority_map = {
            ROLE_RSS: 0,         # Always first (free)
            ROLE_SUPPLEMENT: 1,  # GDELT (free)
            ROLE_PRIMARY: 2,     # NewsData/Currents (limited)
            ROLE_ENRICHMENT: 3,  # Marketaux (scarce)
        }
        return priority_map.get(role, 99)


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
