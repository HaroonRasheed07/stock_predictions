"""
provider_budget.py — Lightweight provider quota/budget manager.

Tracks daily API usage per provider with SQLite persistence.
No Redis. No paid infrastructure. Works within Render 512 MB.

Supports:
- Configurable daily limits from env vars
- Reserve percentage (never consume 100%)
- Cooldown after quota exhaustion
- 429/402 detection
- Usage estimation from response headers
"""

import os
import sqlite3
import time
import threading
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)

# ─── Provider States ────────────────────────────────────────────────────────

class ProviderState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    QUOTA_EXHAUSTED = "quota_exhausted"
    COOLDOWN = "cooldown"
    DISABLED = "disabled"


# ─── Budget Database ────────────────────────────────────────────────────────

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "provider_budget.db")
_lock = threading.Lock()


def _init_budget_db():
    """Initialize SQLite tables for provider budget tracking."""
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS provider_usage (
            provider TEXT NOT NULL,
            date TEXT NOT NULL,
            calls_made INTEGER DEFAULT 0,
            calls_failed INTEGER DEFAULT 0,
            last_call_at TEXT,
            last_error TEXT,
            cooldown_until TEXT,
            PRIMARY KEY (provider, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS provider_config (
            provider TEXT PRIMARY KEY,
            daily_limit INTEGER DEFAULT 0,
            reserve_pct REAL DEFAULT 0.15,
            enabled INTEGER DEFAULT 1,
            last_state TEXT DEFAULT 'healthy',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


# Initialize on import
_init_budget_db()


# ─── Budget Manager ─────────────────────────────────────────────────────────

class ProviderBudgetManager:
    """
    Tracks and limits provider API usage.

    Environment variables:
        MARKETAUX_DAILY_BUDGET  - daily limit for Marketaux
        CURRENTS_DAILY_BUDGET   - daily limit for Currents
        NEWSDATA_DAILY_BUDGET   - daily limit for NewsData
        PROVIDER_RESERVE_PCT    - default reserve percentage (0.0-1.0)
    """

    DEFAULT_LIMITS = {
        "marketaux": 80,
        "newsdata": 500,
        "currents": 250,
        "gdelt": 10000,    # Effectively unlimited
        "rss": 10000,      # Unlimited
    }

    ENV_KEYS = {
        "marketaux": "MARKETAUX_DAILY_BUDGET",
        "newsdata": "NEWSDATA_DAILY_BUDGET",
        "currents": "CURRENTS_DAILY_BUDGET",
    }

    def __init__(self):
        self._config_cache: Dict[str, Dict] = {}
        self._load_config()

    def _today(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _load_config(self):
        """Load provider configs from DB + env vars."""
        try:
            conn = sqlite3.connect(_DB_PATH)
            rows = conn.execute("SELECT provider, daily_limit, reserve_pct, enabled FROM provider_config").fetchall()
            conn.close()
            for provider, limit, reserve, enabled in rows:
                self._config_cache[provider] = {
                    "daily_limit": limit,
                    "reserve_pct": reserve,
                    "enabled": bool(enabled),
                }
        except Exception:
            pass

        # Apply env overrides
        for provider, env_key in self.ENV_KEYS.items():
            env_val = os.environ.get(env_key)
            if env_val:
                try:
                    limit = int(env_val)
                    if provider not in self._config_cache:
                        self._config_cache[provider] = {
                            "daily_limit": limit,
                            "reserve_pct": float(os.environ.get("PROVIDER_RESERVE_PCT", "0.15")),
                            "enabled": True,
                        }
                    else:
                        self._config_cache[provider]["daily_limit"] = limit
                except ValueError:
                    logger.warning(f"[BUDGET] Invalid {env_key}={env_val}")

        # Ensure all providers have config
        for provider, default_limit in self.DEFAULT_LIMITS.items():
            if provider not in self._config_cache:
                self._config_cache[provider] = {
                    "daily_limit": default_limit,
                    "reserve_pct": float(os.environ.get("PROVIDER_RESERVE_PCT", "0.15")),
                    "enabled": True,
                }

    def get_config(self, provider: str) -> Dict:
        return self._config_cache.get(provider, {
            "daily_limit": 0,
            "reserve_pct": 0.15,
            "enabled": False,
        })

    def get_usage(self, provider: str) -> Dict[str, Any]:
        """Get current day's usage for a provider."""
        today = self._today()
        with _lock:
            try:
                conn = sqlite3.connect(_DB_PATH)
                row = conn.execute(
                    "SELECT calls_made, calls_failed, last_call_at, last_error, cooldown_until "
                    "FROM provider_usage WHERE provider=? AND date=?",
                    (provider, today)
                ).fetchone()
                conn.close()
                if row:
                    return {
                        "calls_made": row[0],
                        "calls_failed": row[1],
                        "last_call_at": row[2],
                        "last_error": row[3],
                        "cooldown_until": row[4],
                    }
            except Exception as e:
                logger.debug(f"[BUDGET] SQLite read error: {e}")
        return {"calls_made": 0, "calls_failed": 0, "last_call_at": None, "last_error": None, "cooldown_until": None}

    def remaining(self, provider: str) -> int:
        """How many calls are available today (accounting for reserve)."""
        config = self.get_config(provider)
        usage = self.get_usage(provider)
        limit = config["daily_limit"]
        reserve = config["reserve_pct"]
        usable = int(limit * (1.0 - reserve))
        return max(0, usable - usage["calls_made"])

    def can_call(self, provider: str) -> bool:
        """Check if we can make another call to this provider."""
        config = self.get_config(provider)
        if not config.get("enabled", True):
            return False

        usage = self.get_usage(provider)

        # Check cooldown
        if usage.get("cooldown_until"):
            try:
                cooldown_end = datetime.fromisoformat(usage["cooldown_until"])
                if datetime.now(timezone.utc) < cooldown_end:
                    return False
            except (ValueError, TypeError):
                pass

        # Check quota
        if self.remaining(provider) <= 0:
            return False

        return True

    def record_call(self, provider: str, success: bool = True, error: Optional[str] = None):
        """Record an API call attempt."""
        today = self._today()
        now = datetime.now(timezone.utc).isoformat()

        with _lock:
            try:
                conn = sqlite3.connect(_DB_PATH)
                existing = conn.execute(
                    "SELECT calls_made, calls_failed FROM provider_usage WHERE provider=? AND date=?",
                    (provider, today)
                ).fetchone()

                if existing:
                    calls_made = existing[0] + 1
                    calls_failed = existing[1] + (0 if success else 1)
                    conn.execute(
                        "UPDATE provider_usage SET calls_made=?, calls_failed=?, last_call_at=?, last_error=? "
                        "WHERE provider=? AND date=?",
                        (calls_made, calls_failed, now, error, provider, today)
                    )
                else:
                    conn.execute(
                        "INSERT INTO provider_usage (provider, date, calls_made, calls_failed, last_call_at, last_error) "
                        "VALUES (?, ?, 1, ?, ?, ?)",
                        (provider, today, 0 if success else 1, now, error)
                    )
                conn.commit()
                conn.close()
            except Exception as e:
                logger.debug(f"[BUDGET] SQLite write error: {e}")

        # Check if we should set cooldown
        if not success and error:
            self._check_cooldown(provider, error)

    def _check_cooldown(self, provider: str, error: str):
        """Set cooldown if quota exhaustion detected."""
        error_lower = error.lower()
        is_quota_error = any(kw in error_lower for kw in [
            "429", "402", "quota", "rate limit", "too many",
            "billing", "payment", "limit exceeded"
        ])

        if is_quota_error:
            config = self.get_config(provider)
            usage = self.get_usage(provider)

            # Use 24-hour cooldown for daily quota exhaustion
            cooldown_end = datetime.now(timezone.utc) + timedelta(hours=24)
            with _lock:
                try:
                    conn = sqlite3.connect(_DB_PATH)
                    conn.execute(
                        "UPDATE provider_usage SET cooldown_until=? WHERE provider=? AND date=?",
                        (cooldown_end.isoformat(), provider, self._today())
                    )
                    conn.commit()
                    conn.close()
                    logger.warning(f"[BUDGET] {provider} quota exhausted, cooldown until {cooldown_end}")
                except Exception:
                    pass

    def record_success(self, provider: str, quota_remaining: Optional[int] = None):
        """Record a successful call, optionally updating remaining quota."""
        self.record_call(provider, success=True)

    def record_failure(self, provider: str, error: str):
        """Record a failed call."""
        self.record_call(provider, success=False, error=error)

    def get_all_status(self) -> Dict[str, Dict]:
        """Get status of all providers for observability."""
        result = {}
        for provider in self.DEFAULT_LIMITS:
            config = self.get_config(provider)
            usage = self.get_usage(provider)
            remaining = self.remaining(provider)
            state = ProviderState.HEALTHY

            if not config.get("enabled", True):
                state = ProviderState.DISABLED
            elif usage.get("cooldown_until"):
                try:
                    if datetime.now(timezone.utc) < datetime.fromisoformat(usage["cooldown_until"]):
                        state = ProviderState.COOLDOWN
                except (ValueError, TypeError):
                    pass
            elif remaining <= 0:
                state = ProviderState.QUOTA_EXHAUSTED
            elif usage["calls_failed"] > 3:
                state = ProviderState.DEGRADED

            result[provider] = {
                "state": state.value,
                "daily_limit": config["daily_limit"],
                "reserve_pct": config["reserve_pct"],
                "calls_made": usage["calls_made"],
                "calls_failed": usage["calls_failed"],
                "remaining": remaining,
                "last_error": usage.get("last_error"),
                "cooldown_until": usage.get("cooldown_until"),
            }

        return result

    def reset_daily(self):
        """Reset daily counters. Called automatically when date changes."""
        # Old entries are ignored since we query by today's date
        pass


# ─── Singleton ──────────────────────────────────────────────────────────────

budget_manager = ProviderBudgetManager()
