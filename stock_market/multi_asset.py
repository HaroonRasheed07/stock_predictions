# multi_asset.py — Asset registry & Yahoo Finance symbol mapping
"""
Provides asset class definitions, Yahoo Finance symbol mapping,
and utility functions for multi-asset support.
"""

from typing import Optional, List, Dict, Any


# ─── Asset Class Definitions ───────────────────────────────────────────────────

ASSET_CLASSES = {
    "stock": "Stock",
    "forex": "Forex",
    "commodity": "Commodity",
    "index": "Index",
    "etf": "ETF",
    "future": "Future",
}

# ─── Yahoo Finance Asset Registry ──────────────────────────────────────────────
# Each entry: { "name": str, "class": str, "has_volume": bool, "currency": str }

ASSET_REGISTRY: Dict[str, Dict[str, Any]] = {
    # ── Stocks ──────────────────────────────────────────────────────────────────
    "AAPL":  {"name": "Apple Inc",           "class": "stock",     "has_volume": True,  "currency": "USD"},
    "MSFT":  {"name": "Microsoft Corp",      "class": "stock",     "has_volume": True,  "currency": "USD"},
    "NVDA":  {"name": "NVIDIA Corp",         "class": "stock",     "has_volume": True,  "currency": "USD"},
    "TSLA":  {"name": "Tesla Inc",           "class": "stock",     "has_volume": True,  "currency": "USD"},
    "AMZN":  {"name": "Amazon.com Inc",      "class": "stock",     "has_volume": True,  "currency": "USD"},
    "GOOGL": {"name": "Alphabet Inc",        "class": "stock",     "has_volume": True,  "currency": "USD"},
    "META":  {"name": "Meta Platforms",       "class": "stock",     "has_volume": True,  "currency": "USD"},
    "AMD":   {"name": "Adv. Micro Devices",  "class": "stock",     "has_volume": True,  "currency": "USD"},
    "NFLX":  {"name": "Netflix Inc",         "class": "stock",     "has_volume": True,  "currency": "USD"},
    "INTC":  {"name": "Intel Corp",          "class": "stock",     "has_volume": True,  "currency": "USD"},
    "JPM":   {"name": "JPMorgan Chase",      "class": "stock",     "has_volume": True,  "currency": "USD"},
    "V":     {"name": "Visa Inc",            "class": "stock",     "has_volume": True,  "currency": "USD"},
    "WMT":   {"name": "Walmart Inc",         "class": "stock",     "has_volume": True,  "currency": "USD"},
    "PG":    {"name": "Procter & Gamble",    "class": "stock",     "has_volume": True,  "currency": "USD"},
    "XOM":   {"name": "Exxon Mobil",         "class": "stock",     "has_volume": True,  "currency": "USD"},
    "JNJ":   {"name": "Johnson & Johnson",   "class": "stock",     "has_volume": True,  "currency": "USD"},
    "HD":    {"name": "Home Depot",          "class": "stock",     "has_volume": True,  "currency": "USD"},
    "BAC":   {"name": "Bank of America",     "class": "stock",     "has_volume": True,  "currency": "USD"},
    "DIS":   {"name": "Walt Disney",         "class": "stock",     "has_volume": True,  "currency": "USD"},
    "PYPL":  {"name": "PayPal Holdings",     "class": "stock",     "has_volume": True,  "currency": "USD"},

    # ── ETFs ────────────────────────────────────────────────────────────────────
    "SPY":   {"name": "S&P 500 ETF",         "class": "etf",       "has_volume": True,  "currency": "USD"},
    "QQQ":   {"name": "Invesco QQQ",         "class": "etf",       "has_volume": True,  "currency": "USD"},

    # ── Forex ───────────────────────────────────────────────────────────────────
    "EURUSD=X": {"name": "EUR/USD",          "class": "forex",     "has_volume": False, "currency": "USD"},
    "GBPUSD=X": {"name": "GBP/USD",          "class": "forex",     "has_volume": False, "currency": "USD"},
    "USDJPY=X": {"name": "USD/JPY",          "class": "forex",     "has_volume": False, "currency": "JPY"},
    "AUDUSD=X": {"name": "AUD/USD",          "class": "forex",     "has_volume": False, "currency": "USD"},
    "USDCAD=X": {"name": "USD/CAD",          "class": "forex",     "has_volume": False, "currency": "CAD"},
    "USDCHF=X": {"name": "USD/CHF",          "class": "forex",     "has_volume": False, "currency": "CHF"},

    # ── Commodities / Futures ───────────────────────────────────────────────────
    "GC=F":  {"name": "Gold Futures",        "class": "commodity",  "has_volume": True,  "currency": "USD"},
    "SI=F":  {"name": "Silver Futures",      "class": "commodity",  "has_volume": True,  "currency": "USD"},
    "CL=F":  {"name": "Crude Oil Futures",   "class": "commodity",  "has_volume": True,  "currency": "USD"},
    "NG=F":  {"name": "Natural Gas Futures", "class": "commodity",  "has_volume": True,  "currency": "USD"},
    "HG=F":  {"name": "Copper Futures",      "class": "commodity",  "has_volume": True,  "currency": "USD"},

    # ── Major Indices ───────────────────────────────────────────────────────────
    "^GSPC":  {"name": "S&P 500",            "class": "index",     "has_volume": True,  "currency": "USD"},
    "^DJI":   {"name": "Dow Jones Industrial","class": "index",    "has_volume": True,  "currency": "USD"},
    "^IXIC":  {"name": "NASDAQ Composite",   "class": "index",     "has_volume": True,  "currency": "USD"},
    "^RUT":   {"name": "Russell 2000",       "class": "index",     "has_volume": True,  "currency": "USD"},
    "^FTSE":  {"name": "FTSE 100",           "class": "index",     "has_volume": True,  "currency": "GBP"},
    "^N225":  {"name": "Nikkei 225",         "class": "index",     "has_volume": True,  "currency": "JPY"},
}


# ─── Default Watchlists by Category ───────────────────────────────────────────

DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META",
    "GC=F", "SI=F", "CL=F",
    "EURUSD=X", "GBPUSD=X",
    "^GSPC", "^DJI",
]

WATCHLIST_BY_CATEGORY = {
    "stocks":      ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD", "NFLX", "JPM"],
    "forex":       ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X", "USDCHF=X"],
    "commodities": ["GC=F", "SI=F", "CL=F", "NG=F", "HG=F"],
    "indices":     ["^GSPC", "^DJI", "^IXIC", "^RUT", "^FTSE", "^N225"],
    "etfs":        ["SPY", "QQQ"],
}


# ─── Utility Functions ─────────────────────────────────────────────────────────

def get_asset_info(ticker: str) -> Dict[str, Any]:
    """
    Get asset metadata for a ticker.
    Returns registry info if known, otherwise infers from ticker format.
    """
    ticker_upper = ticker.upper().strip()

    if ticker_upper in ASSET_REGISTRY:
        info = ASSET_REGISTRY[ticker_upper]
        return {
            "ticker": ticker_upper,
            "name": info["name"],
            "asset_class": info["class"],
            "asset_class_label": ASSET_CLASSES.get(info["class"], "Unknown"),
            "has_volume": info["has_volume"],
            "currency": info["currency"],
        }

    # Infer asset class from ticker format
    asset_class = "stock"
    has_volume = True
    currency = "USD"

    if ticker_upper.endswith("=X"):
        asset_class = "forex"
        has_volume = False
    elif ticker_upper.endswith("=F"):
        asset_class = "future"
        has_volume = True
    elif ticker_upper.startswith("^"):
        asset_class = "index"
        has_volume = True

    return {
        "ticker": ticker_upper,
        "name": ticker_upper,
        "asset_class": asset_class,
        "asset_class_label": ASSET_CLASSES.get(asset_class, "Unknown"),
        "has_volume": has_volume,
        "currency": currency,
    }


def search_assets(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Search the asset registry by ticker symbol or name.
    Returns matching entries with metadata.
    """
    query_lower = query.lower().strip()
    if not query_lower:
        return []

    results = []
    for ticker, info in ASSET_REGISTRY.items():
        if (query_lower in ticker.lower() or
                query_lower in info["name"].lower()):
            results.append({
                "ticker": ticker,
                "name": info["name"],
                "asset_class": info["class"],
                "asset_class_label": ASSET_CLASSES.get(info["class"], "Unknown"),
                "has_volume": info["has_volume"],
                "currency": info["currency"],
            })
            if len(results) >= limit:
                break

    return results


def get_default_watchlist() -> List[str]:
    """Return the default multi-asset watchlist."""
    return list(DEFAULT_WATCHLIST)


def get_watchlist_by_category(category: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Get watchlist grouped by category.
    If category is specified, return only that category's tickers.
    """
    if category and category in WATCHLIST_BY_CATEGORY:
        return {category: WATCHLIST_BY_CATEGORY[category]}
    return dict(WATCHLIST_BY_CATEGORY)

def get_default_watchlist() -> List[str]:
    """Get the default multi-asset watchlist."""
    return DEFAULT_WATCHLIST
