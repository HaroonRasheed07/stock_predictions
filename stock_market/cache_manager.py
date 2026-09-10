# cache_manager.py — Production-grade Dual-Layer Persistent Cache & SWR Lifecycle Engine
"""
Dual-Layer Cache (L1 Memory LRU + L2 SQLite Persistent Store)
with Stale-While-Revalidate (SWR), Single-Flight Request Coalescing Locks,
Bounded Background Concurrency, and Cache Observability Metadata.
"""

import sqlite3
import json
import time
import threading
import logging
import os
from typing import Any, Optional, Dict, Tuple, Callable
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "market_cache.db")
MAX_L1_ENTRIES = 200
MAX_CONCURRENT_MARKET_REFRESHES = 2

# Semaphore to bound concurrent heavy background refreshes (512MB RAM protection)
_refresh_semaphore = threading.BoundedSemaphore(MAX_CONCURRENT_MARKET_REFRESHES)
_refresh_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="cache_bg_refresh")


class SingleFlightLock:
    """
    Single-Flight Request Coalescing Manager.
    Prevents cache stampedes by ensuring only ONE background refresh or computation
    executes for a given cache_key at any given time.
    """
    def __init__(self):
        self._locks: Dict[str, threading.Lock] = {}
        self._in_progress: Dict[str, bool] = {}
        self._master_lock = threading.Lock()

    def try_acquire(self, key: str) -> bool:
        """
        Attempts to acquire the refresh lock for `key`.
        Returns True if acquired (meaning this caller should perform the refresh).
        Returns False if a refresh is ALREADY in progress for `key`.
        """
        with self._master_lock:
            if self._in_progress.get(key, False):
                return False
            self._in_progress[key] = True
            return True

    def release(self, key: str):
        """Release the refresh lock for `key`."""
        with self._master_lock:
            self._in_progress.pop(key, None)

    def is_running(self, key: str) -> bool:
        """Check if a refresh is currently running for `key`."""
        with self._master_lock:
            return self._in_progress.get(key, False)


_single_flight = SingleFlightLock()


class PersistentCacheManager:
    """
    Thread-safe SQLite + In-Memory Dual-Layer Cache with WAL Mode.
    L1: In-memory dict for instant sub-millisecond reads.
    L2: SQLite database (`market_cache.db`) for persistent storage across process restarts.
    """
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._l1_cache: Dict[str, Dict[str, Any]] = {}
        self._l1_lock = threading.Lock()
        self._db_lock = threading.Lock()
        self._init_db()
        self._load_l1_from_l2()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self):
        """Initialize SQLite database table with WAL mode."""
        with self._db_lock:
            try:
                conn = self._get_connection()
                with conn:
                    conn.execute("""
                        CREATE TABLE IF NOT EXISTS cache_entries (
                            key TEXT PRIMARY KEY,
                            category TEXT,
                            ticker TEXT,
                            period TEXT,
                            created_at REAL,
                            updated_at REAL,
                            fresh_until REAL,
                            stale_until REAL,
                            payload_json TEXT,
                            version TEXT DEFAULT 'v1'
                        );
                    """)
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_category ON cache_entries(category);")
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_fresh ON cache_entries(fresh_until);")
                conn.close()
                logger.info(f"SQLite cache database initialized at {self.db_path}")
            except Exception as e:
                logger.error(f"Failed to initialize SQLite cache DB: {e}")

    def _load_l1_from_l2(self):
        """Warm up L1 memory cache from L2 SQLite database on startup."""
        with self._db_lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                now = time.time()
                cursor.execute(
                    "SELECT key, category, ticker, period, created_at, updated_at, fresh_until, stale_until, payload_json, version FROM cache_entries WHERE stale_until > ?",
                    (now,)
                )
                rows = cursor.fetchall()
                conn.close()

                count = 0
                with self._l1_lock:
                    for row in rows:
                        key, cat, tick, per, c_at, u_at, f_until, s_until, p_json, ver = row
                        try:
                            payload = json.loads(p_json)
                            self._l1_cache[key] = {
                                "payload": payload,
                                "created_at": c_at,
                                "updated_at": u_at,
                                "fresh_until": f_until,
                                "stale_until": s_until,
                                "category": cat,
                                "ticker": tick,
                                "period": per,
                                "version": ver,
                            }
                            count += 1
                        except Exception:
                            pass
                logger.info(f"Loaded {count} persistent cache entries into L1 memory.")
            except Exception as e:
                logger.error(f"Failed to pre-load L1 cache from L2 SQLite: {e}")

    def set(
        self,
        key: str,
        payload: Any,
        fresh_ttl_seconds: float,
        stale_ttl_seconds: float = 86400.0,  # 24 hours default stale TTL
        category: str = "general",
        ticker: str = "",
        period: str = "",
        version: str = "v1"
    ):
        """
        Write or update a cache entry in both L1 Memory and L2 SQLite.
        `fresh_ttl_seconds`: Duration for which data is completely fresh.
        `stale_ttl_seconds`: Duration during which stale data may be served while refreshing in background.
        """
        now = time.time()
        fresh_until = now + fresh_ttl_seconds
        stale_until = now + stale_ttl_seconds

        entry = {
            "payload": payload,
            "created_at": now,
            "updated_at": now,
            "fresh_until": fresh_until,
            "stale_until": stale_until,
            "category": category,
            "ticker": ticker,
            "period": period,
            "version": version,
        }

        # 1. Update L1 Memory Cache
        with self._l1_lock:
            # Evict if capacity exceeded
            if len(self._l1_cache) >= MAX_L1_ENTRIES:
                sorted_keys = sorted(self._l1_cache.keys(), key=lambda k: self._l1_cache[k]["updated_at"])
                for k in sorted_keys[:max(1, len(sorted_keys) // 5)]:
                    del self._l1_cache[k]
            self._l1_cache[key] = entry

        # 2. Persist to L2 SQLite in background or synchronously
        try:
            p_json = json.dumps(payload, default=str)
            with self._db_lock:
                conn = self._get_connection()
                with conn:
                    conn.execute("""
                        INSERT INTO cache_entries 
                        (key, category, ticker, period, created_at, updated_at, fresh_until, stale_until, payload_json, version)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(key) DO UPDATE SET
                            created_at=excluded.created_at,
                            updated_at=excluded.updated_at,
                            fresh_until=excluded.fresh_until,
                            stale_until=excluded.stale_until,
                            payload_json=excluded.payload_json,
                            version=excluded.version;
                    """, (key, category, ticker, period, now, now, fresh_until, stale_until, p_json, version))
                conn.close()
        except Exception as e:
            logger.error(f"SQLite cache write failed for key={key}: {e}")

    def get_swr(
        self,
        key: str,
        refresh_func: Optional[Callable[[], Any]] = None,
        fresh_ttl_seconds: float = 120.0,
        stale_ttl_seconds: float = 86400.0,
        category: str = "general",
        ticker: str = "",
        period: str = ""
    ) -> Tuple[Optional[Any], Dict[str, Any]]:
        """
        Stale-While-Revalidate getter:
        - Returns (payload, metadata).
        - If FRESH (age < fresh_ttl): Returns payload immediately with status="HIT".
        - If STALE (fresh_ttl < age < stale_ttl): Returns payload immediately with status="STALE",
          and schedules single-flight background refresh if `refresh_func` provided.
        - If EXPIRED or MISS: Returns (None, status="MISS").
        """
        now = time.time()
        entry = None

        # Check L1 Memory
        with self._l1_lock:
            if key in self._l1_cache:
                entry = self._l1_cache[key]

        # Fallback to L2 SQLite if not in L1
        if entry is None:
            with self._db_lock:
                try:
                    conn = self._get_connection()
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT category, ticker, period, created_at, updated_at, fresh_until, stale_until, payload_json, version FROM cache_entries WHERE key=?",
                        (key,)
                    )
                    row = cursor.fetchone()
                    conn.close()
                    if row:
                        cat, tick, per, c_at, u_at, f_until, s_until, p_json, ver = row
                        payload = json.loads(p_json)
                        entry = {
                            "payload": payload,
                            "created_at": c_at,
                            "updated_at": u_at,
                            "fresh_until": f_until,
                            "stale_until": s_until,
                            "category": cat,
                            "ticker": tick,
                            "period": per,
                            "version": ver,
                        }
                        with self._l1_lock:
                            self._l1_cache[key] = entry
                except Exception as e:
                    logger.error(f"L2 SQLite read error for key={key}: {e}")

        # Evaluate SWR status
        if entry is not None:
            fresh_until = entry["fresh_until"]
            stale_until = entry["stale_until"]

            meta = {
                "created_at": entry["created_at"],
                "updated_at": entry["updated_at"],
                "fresh_until": fresh_until,
                "is_stale": now > fresh_until,
                "refresh_in_progress": _single_flight.is_running(key),
            }

            if now <= fresh_until:
                # 1. FRESH: Return immediately
                meta["status"] = "HIT"
                return entry["payload"], meta

            elif now <= stale_until:
                # 2. STALE BUT VALID: Return immediately + schedule background refresh
                meta["status"] = "STALE"
                if refresh_func is not None:
                    self.trigger_background_refresh(
                        key, refresh_func, fresh_ttl_seconds, stale_ttl_seconds, category, ticker, period
                    )
                return entry["payload"], meta

        # 3. EXPIRED OR MISS
        meta = {
            "created_at": 0.0,
            "updated_at": 0.0,
            "fresh_until": 0.0,
            "is_stale": True,
            "refresh_in_progress": _single_flight.is_running(key),
            "status": "MISS"
        }
        return None, meta

    def trigger_background_refresh(
        self,
        key: str,
        refresh_func: Callable[[], Any],
        fresh_ttl_seconds: float,
        stale_ttl_seconds: float,
        category: str = "general",
        ticker: str = "",
        period: str = ""
    ) -> bool:
        """
        Triggers a background refresh task under single-flight locking and bounded concurrency.
        Returns True if a new background task was submitted, False if already running or rejected.
        """
        if not _single_flight.try_acquire(key):
            # Already refreshing in background — single flight protection active
            return False

        def _worker():
            acquired_sem = False
            start_time = time.perf_counter()
            try:
                # Acquire semaphore for memory protection
                acquired_sem = _refresh_semaphore.acquire(blocking=False)
                if not acquired_sem:
                    logger.debug(f"[PERF] Refresh semaphore busy for {key}, skipping BG refresh.")
                    return

                logger.info(f"[PERF] Background refresh STARTED for key={key}")
                new_payload = refresh_func()

                if new_payload is not None:
                    self.set(
                        key=key,
                        payload=new_payload,
                        fresh_ttl_seconds=fresh_ttl_seconds,
                        stale_ttl_seconds=stale_ttl_seconds,
                        category=category,
                        ticker=ticker,
                        period=period
                    )
                    duration = (time.perf_counter() - start_time) * 1000
                    logger.info(f"[PERF] Background refresh COMPLETED for key={key} in {duration:.1f}ms")
                else:
                    logger.warning(f"[PERF] Background refresh returned None for key={key}. Retaining existing cache.")
            except Exception as e:
                logger.error(f"[PERF] Background refresh FAILED for key={key}: {e}. Retaining valid cache.")
            finally:
                if acquired_sem:
                    _refresh_semaphore.release()
                _single_flight.release(key)

        try:
            _refresh_executor.submit(_worker)
            return True
        except Exception as e:
            logger.error(f"Failed to submit background refresh job: {e}")
            _single_flight.release(key)
            return False


# Global Singleton Instance
cache_manager = PersistentCacheManager()
