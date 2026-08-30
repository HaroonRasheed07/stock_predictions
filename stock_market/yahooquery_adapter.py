# yahooquery_adapter.py — High-performance Yahoo Finance data adapter
"""
Drop-in replacement for yfinance using yahooquery's batch/async architecture.
Provides get_fast_live_data() and get_fast_history() with identical output
structure to yfinance, ensuring zero cascading changes in downstream code.

Strategy:
  - Shared session: One curl_cffi session initialized lazily and reused across
    all Ticker instances. This avoids repeated setup_session() calls which
    can timeout on flaky connections.
  - Live quotes: Multi-symbol Ticker(symbols).price (single batch API call)
  - History:     Parallel individual Ticker(symbol).history() via ThreadPoolExecutor
"""

import pandas as pd
import numpy as np
import threading
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Union
from yahooquery import Ticker as YQTicker
from yahooquery.session_management import initialize_session

logger = logging.getLogger(__name__)

# Interval auto-determination based on period (mirrors yfinance logic)
_INTERVAL_MAP = {
    "1d": "5m", "5d": "15m", "1mo": "90m",
    "6mo": "1d", "1y": "1d", "2y": "1d", "5y": "1d",
    "10y": "1d", "ytd": "1d", "max": "1d",
}

# Module-level shared session (initialized lazily, thread-safe)
_shared_session = None
_session_lock = threading.Lock()
_session_ready = False


def _get_shared_session():
    """
    Lazily initialize a single curl_cffi session for all yahooquery calls.
    Thread-safe via double-checked locking.
    """
    global _shared_session, _session_ready
    if _session_ready:
        return _shared_session
    with _session_lock:
        if _shared_session is None:
            logger.info("Initializing yahooquery shared session...")
            _shared_session = initialize_session()
            _session_ready = True
            logger.info("Yahooquery session ready.")
    return _shared_session


def warm_session():
    """Pre-initialize the session in background. Called at FastAPI startup."""
    try:
        _get_shared_session()
    except Exception as e:
        logger.warning(f"Session warm-up failed (non-fatal): {e}")


def _resolve_interval(period: str, interval: Optional[str] = None) -> str:
    """Auto-determine interval if not provided, matching yfinance behavior."""
    if interval:
        return interval
    return _INTERVAL_MAP.get(period, "1d")


def _empty_ohlcv_df() -> pd.DataFrame:
    """Return an empty DataFrame with the OHLCV column schema expected downstream."""
    return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])


def _flatten_yq_history(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform yahooquery history output into a flat DataFrame with
    capitalized OHLCV columns matching yfinance output format.

    yahooquery returns columns: open, high, low, close, volume, adjclose
    with a MultiIndex on rows (symbol, date) for multi-symbol queries.
    """
    if df is None or df.empty:
        return _empty_ohlcv_df()

    # Drop symbol level from MultiIndex rows
    if isinstance(df.index, pd.MultiIndex):
        if df.index.nlevels > 1:
            df = df.droplevel(0, axis=0)
            df.index = pd.to_datetime(df.index)

    # Column mapping: yahooquery lowercase -> yfinance Title Case
    col_map = {}
    if "adjclose" in df.columns:
        col_map["adjclose"] = "Close"
    if "close" in df.columns and "Close" not in col_map.values():
        col_map["close"] = "Close"
    for c in ["open", "high", "low", "volume"]:
        if c in df.columns:
            col_map[c] = c.capitalize()

    df = df.rename(columns=col_map)
    keep_cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
    df = df[keep_cols].copy()

    # Handle missing Volume (common for forex and indices)
    if "Volume" not in df.columns:
        df["Volume"] = 0.0
    else:
        df["Volume"] = df["Volume"].fillna(0)

    # Drop rows where Close is NaN (incomplete bars)
    df = df.dropna(subset=["Close"])
    return df


def _fetch_single_history(symbol: str, period: str, interval: str) -> pd.DataFrame:
    """Fetch history for one symbol using the shared session."""
    try:
        session = _get_shared_session()
        yq = YQTicker(symbol, session=session)
        df = yq.history(period=period, interval=interval)
        return _flatten_yq_history(df)
    except Exception as e:
        logger.warning(f"History fetch failed for {symbol}: {e}")
        return _empty_ohlcv_df()


def get_fast_history(
    symbol: str,
    period: str = "1y",
    interval: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetch historical OHLCV data for a single symbol using yahooquery.
    Returns a DataFrame identical to yfinance's download():
      - DatetimeIndex
      - Columns: Open, High, Low, Close, Volume (Title Case)
    """
    try:
        resolved = _resolve_interval(period, interval)
        result = _fetch_single_history(symbol, period, resolved)

        if result.empty:
            raise ValueError(f"No data returned for {symbol} (period={period}, interval={resolved})")
        return result
    except Exception as e:
        raise RuntimeError(f"yahooquery history error for {symbol}: {e}")


def get_fast_live_data(
    symbols: Union[str, List[str]],
) -> Dict[str, Dict[str, Any]]:
    """
    Batch-fetch live quote data using yahooquery's multi-symbol .price endpoint.
    Single API call for all symbols.
    Returns {ticker: {regularMarketPrice, regularMarketChangePercent, ...}} dict.
    """
    try:
        if isinstance(symbols, str):
            symbols = [symbols]

        session = _get_shared_session()
        yq = YQTicker(symbols, session=session)
        price_data = yq.price  # {ticker: {…}} from v6/quote endpoint

        result = {}
        for sym in symbols:
            try:
                info = price_data.get(sym, {})
                if info is None or not isinstance(info, dict):
                    result[sym] = _fallback_quote(sym)
                    continue

                result[sym] = {
                    "regularMarketPrice": float(info.get("regularMarketPrice", 0) or 0),
                    "regularMarketChangePercent": float(info.get("regularMarketChangePercent", 0) or 0),
                    "regularMarketVolume": float(info.get("regularMarketVolume", 0) or 0),
                    "regularMarketOpen": float(info.get("regularMarketOpen", 0) or 0),
                    "regularMarketPreviousClose": float(info.get("regularMarketPreviousClose", 0) or 0),
                    "regularMarketDayHigh": float(info.get("regularMarketDayHigh", 0) or 0),
                    "regularMarketDayLow": float(info.get("regularMarketDayLow", 0) or 0),
                }
            except Exception as e:
                logger.warning(f"Price parse failed for {sym}: {e}")
                result[sym] = _fallback_quote(sym)

        return result
    except Exception as e:
        logger.error(f"Batch price fetch failed: {e}")
        return {sym: _fallback_quote(sym) for sym in (symbols if isinstance(symbols, list) else [symbols])}


def get_fast_batch_history(
    symbols: List[str],
    period: str = "5d",
    interval: Optional[str] = None,
) -> Dict[str, pd.DataFrame]:
    """
    Fetch historical data for multiple symbols in parallel using ThreadPoolExecutor.
    Each symbol uses the shared session to avoid repeated initialization timeouts.
    """
    try:
        resolved = _resolve_interval(period, interval)

        results: Dict[str, pd.DataFrame] = {}
        with ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as executor:
            futures = {
                executor.submit(_fetch_single_history, sym, period, resolved): sym
                for sym in symbols
            }
            for future in as_completed(futures):
                sym = futures[future]
                try:
                    results[sym] = future.result(timeout=60)
                except Exception as e:
                    logger.warning(f"Batch history timeout for {sym}: {e}")
                    results[sym] = _empty_ohlcv_df()

        # Preserve input order
        return {sym: results.get(sym, _empty_ohlcv_df()) for sym in symbols}
    except Exception as e:
        logger.error(f"Batch history fetch failed: {e}")
        return {sym: _empty_ohlcv_df() for sym in symbols}


def _fallback_quote(sym: str) -> Dict[str, Any]:
    """Return a zeroed-out quote dict when Yahoo Finance is unreachable."""
    return {
        "regularMarketPrice": 0.0,
        "regularMarketChangePercent": 0.0,
        "regularMarketVolume": 0.0,
        "regularMarketOpen": 0.0,
        "regularMarketPreviousClose": 0.0,
        "regularMarketDayHigh": 0.0,
        "regularMarketDayLow": 0.0,
    }


def search_yahoo(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search Yahoo Finance for matching tickers/names via v1/finance/search API.
    Falls back to v6/quote endpoint search if v1 fails.
    Returns [{ticker, name, asset_class, exchange}] for autocomplete dropdowns.
    """
    results = _search_yahoo_v1(query, limit)
    if results:
        return results

    # Fallback: try v6/quote endpoint search
    results = _search_yahoo_v6(query, limit)
    return results


def _search_yahoo_v1(query: str, limit: int) -> List[Dict[str, Any]]:
    """Primary search via Yahoo Finance v1/finance/search API."""
    try:
        import requests as _requests

        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotes_count": limit,
            "news_count": 0,
            "lists_count": 0,
            "enableFuzzyQuery": True,
            "quotesQueryId": "tss_match_phrase_query",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        }

        resp = _requests.get(url, params=params, headers=headers, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        return _parse_yahoo_quotes(data.get("quotes", []), limit)
    except Exception as e:
        logger.debug(f"Yahoo v1 search failed for '{query}': {e}")
        return []


def _search_yahoo_v6(query: str, limit: int) -> List[Dict[str, Any]]:
    """Fallback search using yahooquery's quote endpoint."""
    try:
        session = _get_shared_session()
        yq = YQTicker(query, session=session)
        quote_data = yq.quote

        if not quote_data or not isinstance(quote_data, dict):
            return []

        # v6 returns a single quote for the exact symbol
        # Try to get the symbol and its info
        results = []
        for sym, info in quote_data.items():
            if not isinstance(info, dict) or sym == query.upper():
                continue
            asset_class = "stock"
            qt = info.get("quoteType", "").upper()
            if qt == "ETF":
                asset_class = "etf"
            elif qt == "CURRENCY":
                asset_class = "forex"
            elif qt == "INDEX":
                asset_class = "index"

            results.append({
                "ticker": sym,
                "name": info.get("shortName") or info.get("longName") or sym,
                "asset_class": asset_class,
                "exchange": info.get("exchange", ""),
            })
            if len(results) >= limit:
                break

        return results
    except Exception as e:
        logger.debug(f"Yahoo v6 search failed for '{query}': {e}")
        return []


def _parse_yahoo_quotes(quotes: list, limit: int) -> List[Dict[str, Any]]:
    """Parse Yahoo Finance quote results into our standard format."""
    results = []
    for quote in quotes[:limit]:
        quote_type = quote.get("quoteType", "").upper()
        asset_class = "stock"
        if quote_type == "ETF":
            asset_class = "etf"
        elif quote_type == "CURRENCY":
            asset_class = "forex"
        elif quote_type == "INDEX":
            asset_class = "index"
        elif quote_type in ("FUTURE", "COMMODITY"):
            asset_class = "commodity"

        symbol = quote.get("symbol", "")
        if not symbol:
            continue

        results.append({
            "ticker": symbol,
            "name": quote.get("longname") or quote.get("shortname") or symbol,
            "asset_class": asset_class,
            "exchange": quote.get("exchange", ""),
        })

    return results
