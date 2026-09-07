# utils.py — Market data loading, caching, and top performers (yahooquery-powered)
"""
Replaces yfinance with yahooquery for 10-50x faster batch data retrieval.
All function signatures and return types are preserved for zero-cascading changes.

Cache strategy:
  - Stale-while-revalidate: Serve stale data immediately, refresh in background
  - Separate TTLs: history (2min), scan (10min), top performers (5min), forecast (15min)
  - Shared OHLCV cache across all endpoints (eliminates duplicate Yahoo Query calls)
"""

import pandas as pd
import time
import logging
import threading
from yahooquery_adapter import get_fast_history, get_fast_batch_history, get_fast_live_data

logger = logging.getLogger(__name__)

# --- Stale-while-revalidate cache ---
_data_cache: dict = {}  # key -> (timestamp, dataframe_or_list)
_DATA_CACHE_TTL = 120  # seconds (2 minutes) — fresh data
_DATA_CACHE_STALE_TTL = 300  # seconds (5 minutes) — serve stale, refresh in bg
_DATA_CACHE_MAX_ENTRIES = 50  # Max cached DataFrames (memory guard for 512MB)

# --- Separate cache for scan operations (10-minute TTL) ---
_scan_cache: dict = {}  # key -> (timestamp, result)
_SCAN_CACHE_TTL = 600  # seconds (10 minutes)
_SCAN_CACHE_MAX_ENTRIES = 100

# --- Top performers cache with separate key and longer TTL ---
_TOP_PERFORMERS_CACHE_TTL = 300  # 5 minutes

# --- Forecast cache (ONNX inference is expensive, cache 15 minutes) ---
_forecast_cache: dict = {}  # key -> (timestamp, result)
_FORECAST_CACHE_TTL = 900  # 15 minutes
_FORECAST_CACHE_MAX_ENTRIES = 20

# --- Background refresh locks (prevent thundering herd) ---
_bg_refresh_locks: dict = {}
_bg_refresh_lock = threading.Lock()

def _get_cached_df(key: str, allow_stale: bool = True):
    """
    Stale-while-revalidate: return fresh data if available.
    If stale but within stale TTL, return it and schedule background refresh.
    """
    if key in _data_cache:
        ts, df = _data_cache[key]
        age = time.time() - ts
        if age < _DATA_CACHE_TTL:
            return df  # Fresh
        if allow_stale and age < _DATA_CACHE_STALE_TTL:
            # Stale but usable — schedule background refresh
            _schedule_bg_refresh(key)
            return df
    return None

def _schedule_bg_refresh(key: str):
    """Schedule a background refresh for stale cache entries."""
    with _bg_refresh_lock:
        if key in _bg_refresh_locks:
            return  # Already refreshing
        _bg_refresh_locks[key] = True

    def _refresh():
        try:
            parts = key.split("|")
            if len(parts) == 3:
                ticker, period, interval = parts
                fresh = get_fast_history(ticker, period=period, interval=interval)
                if fresh is not None and not fresh.empty:
                    _data_cache[key] = (time.time(), fresh)
                    logger.debug(f"Background refresh completed for {key}")
        except Exception as e:
            logger.debug(f"Background refresh failed for {key}: {e}")
        finally:
            with _bg_refresh_lock:
                _bg_refresh_locks.pop(key, None)

    threading.Thread(target=_refresh, daemon=True).start()

def _set_cached_df(key: str, df):
    # Evict oldest entries if cache is full (memory guard for 512MB Render)
    if len(_data_cache) >= _DATA_CACHE_MAX_ENTRIES:
        # Remove oldest 20% of entries
        sorted_keys = sorted(_data_cache.keys(), key=lambda k: _data_cache[k][0])
        for k in sorted_keys[:max(1, len(sorted_keys) // 5)]:
            del _data_cache[k]
    _data_cache[key] = (time.time(), df)

def _get_cached_scan(key: str):
    if key in _scan_cache:
        ts, result = _scan_cache[key]
        if time.time() - ts < _SCAN_CACHE_TTL:
            return result
    return None

def _set_cached_scan(key: str, result):
    if len(_scan_cache) >= _SCAN_CACHE_MAX_ENTRIES:
        sorted_keys = sorted(_scan_cache.keys(), key=lambda k: _scan_cache[k][0])
        for k in sorted_keys[:max(1, len(sorted_keys) // 5)]:
            del _scan_cache[k]
    _scan_cache[key] = (time.time(), result)

def get_cached_forecast(key: str):
    """Get cached forecast result (15-minute TTL)."""
    if key in _forecast_cache:
        ts, result = _forecast_cache[key]
        if time.time() - ts < _FORECAST_CACHE_TTL:
            return result
    return None

def set_cached_forecast(key: str, result):
    """Cache forecast result."""
    if len(_forecast_cache) >= _FORECAST_CACHE_MAX_ENTRIES:
        sorted_keys = sorted(_forecast_cache.keys(), key=lambda k: _forecast_cache[k][0])
        for k in sorted_keys[:max(1, len(sorted_keys) // 5)]:
            del _forecast_cache[k]
    _forecast_cache[key] = (time.time(), result)


def load_data(ticker, period="1y", interval=None, allow_stale=True):
    """
    Load historical OHLCV data for a single ticker.
    Returns a DataFrame with columns: Open, High, Low, Close, Volume.
    Identical interface to the old yfinance version.
    Uses stale-while-revalidate: serves stale data immediately, refreshes in background.
    """
    try:
        # Auto-determine interval if not specified
        if interval is None:
            if period == "1d":
                interval = "5m"
            elif period == "5d":
                interval = "15m"
            elif period == "1mo":
                interval = "90m"
            elif period in ["6mo", "1y", "2y", "5y", "10y", "ytd", "max"]:
                interval = "1d"
            else:
                interval = "1d"

        # Check cache first (stale-while-revalidate)
        cache_key = f"{ticker}|{period}|{interval}"
        cached = _get_cached_df(cache_key, allow_stale=allow_stale)
        if cached is not None:
            return cached

        # Fetch via yahooquery adapter (single-symbol, batch-capable)
        data = get_fast_history(ticker, period=period, interval=interval)

        # Extra safety: ensure OHLCV columns are Series, not single-column DataFrames
        for col in ['Close', 'High', 'Low', 'Open', 'Volume']:
            if col in data.columns:
                val = data[col]
                if isinstance(val, pd.DataFrame):
                    data[col] = val.iloc[:, 0]

        if data.empty:
            raise ValueError(f"No data found for the ticker: {ticker}")

        # Store in cache
        _set_cached_df(cache_key, data)
        return data
    except Exception as e:
        # Re-raise the exception to be caught by FastAPI
        raise RuntimeError(f"Error loading data for {ticker}: {str(e)}")


def get_latest_price(ticker):
    """
    Fetches the latest available price for a ticker.
    Uses yahooquery's batch .price endpoint for speed.
    """
    try:
        live = get_fast_live_data(ticker)
        info = live.get(ticker, {})
        price = info.get("regularMarketPrice", 0)

        if price:
            return price

        # Fallback to last close from history
        df = get_fast_history(ticker, period="1d", interval="1d")
        if not df.empty:
            return float(df["Close"].iloc[-1])

        return None
    except Exception:
        return None


# --- Top Performers Helper ---
STOCK_NAMES = {
    'NVDA': 'NVIDIA Corp',
    'TSLA': 'Tesla Inc',
    'AAPL': 'Apple Inc',
    'MSFT': 'Microsoft Corp',
    'AMZN': 'Amazon.com',
    'GOOGL': 'Alphabet Inc',
    'META': 'Meta Platforms',
    'AMD': 'Adv. Micro Devices',
    'NFLX': 'Netflix Inc',
    'INTC': 'Intel Corp',
    'SPY': 'S&P 500 ETF',
    'QQQ': 'Invesco QQQ',
    'JPM': 'JPMorgan Chase',
    'V': 'Visa Inc',
    'WMT': 'Walmart Inc',
    'PG': 'Procter & Gamble',
    'XOM': 'Exxon Mobil',
    'JNJ': 'Johnson & Johnson',
    'HD': 'Home Depot',
    'BAC': 'Bank of America',
    # Multi-asset defaults
    'GC=F': 'Gold Futures',
    'SI=F': 'Silver Futures',
    'CL=F': 'Crude Oil',
    'EURUSD=X': 'EUR/USD',
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones'
}
TOP_WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'GC=F', 'EURUSD=X', '^GSPC']


def get_top_performing_stocks(limit=6):
    """
    Fetches a watchlist of popular stocks and returns the top performers
    based on the last day's change.
    Uses batch download for speed (single yahooquery call instead of N sequential).
    Results are cached for 5 minutes.
    """
    try:
        # Check cache (separate key, 5-minute TTL)
        cache_key = "__top_performers__"
        if cache_key in _scan_cache:
            ts, cached = _scan_cache[cache_key]
            if time.time() - ts < _TOP_PERFORMERS_CACHE_TTL:
                return cached[:limit]

        # Batch download for all watchlist stocks (parallel threads)
        batch = get_fast_batch_history(TOP_WATCHLIST, period="5d", interval="1d")

        results = []
        for ticker in TOP_WATCHLIST:
            try:
                df = batch.get(ticker)
                if df is None or df.empty or len(df) < 2:
                    continue

                closes = df["Close"]
                if isinstance(closes, pd.DataFrame):
                    closes = closes.iloc[:, 0]

                price = float(closes.iloc[-1])
                prev = float(closes.iloc[-2])

                if pd.isna(price) or pd.isna(prev) or prev == 0:
                    continue

                change = price - prev
                change_percent = (change / prev) * 100

                results.append({
                    "symbol": ticker,
                    "name": STOCK_NAMES.get(ticker, ticker),
                    "price": price,
                    "change": change,
                    "changePercent": change_percent
                })
            except Exception:
                continue

        # Sort by change percent descending (Top Gainers)
        results.sort(key=lambda x: x['changePercent'], reverse=True)

        # Cache for 5 minutes
        _scan_cache[cache_key] = (time.time(), results)

        return results[:limit]
    except Exception as e:
        logger.error(f"Error fetching top performers: {e}")
        return []
