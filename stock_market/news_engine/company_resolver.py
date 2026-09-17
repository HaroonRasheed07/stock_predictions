"""
news_engine/company_resolver.py — Resolves ticker → company identity.

Uses a combination of:
1. Well-known company name overrides (fast, reliable)
2. YahooQuery metadata (when available)
3. Ticker symbol as last resort fallback
"""

import logging
import time
from typing import Dict, Optional, List, Any

from .models import CompanyIdentity

logger = logging.getLogger(__name__)

# In-memory cache for company identities (24h TTL)
_identity_cache: Dict[str, tuple] = {}
_IDENTITY_CACHE_TTL = 86400

# Well-known company overrides — covers top 100+ tickers
# This is the primary source of truth for company names.
# YahooQuery metadata is unreliable for free-tier access.
_COMPANY_DB: Dict[str, Dict[str, Any]] = {
    "AAPL": {"name": "Apple Inc.", "short": "Apple", "aliases": ["apple", "aapl"]},
    "MSFT": {"name": "Microsoft Corporation", "short": "Microsoft", "aliases": ["microsoft", "msft"]},
    "NVDA": {"name": "NVIDIA Corporation", "short": "NVIDIA", "aliases": ["nvidia", "nvda"]},
    "GOOGL": {"name": "Alphabet Inc.", "short": "Alphabet", "aliases": ["alphabet", "google", "googl"]},
    "GOOG": {"name": "Alphabet Inc.", "short": "Alphabet", "aliases": ["alphabet", "google", "goog"]},
    "AMZN": {"name": "Amazon.com Inc.", "short": "Amazon", "aliases": ["amazon", "amzn"]},
    "META": {"name": "Meta Platforms Inc.", "short": "Meta", "aliases": ["meta", "facebook"]},
    "TSLA": {"name": "Tesla Inc.", "short": "Tesla", "aliases": ["tesla", "tsla"]},
    "JPM": {"name": "JPMorgan Chase & Co.", "short": "JPMorgan", "aliases": ["jpmorgan", "jp morgan", "jpm"]},
    "V": {"name": "Visa Inc.", "short": "Visa", "aliases": ["visa"]},
    "JNJ": {"name": "Johnson & Johnson", "short": "J&J", "aliases": ["johnson", "j&j", "jnj"]},
    "WMT": {"name": "Walmart Inc.", "short": "Walmart", "aliases": ["walmart", "wmt"]},
    "MA": {"name": "Mastercard Inc.", "short": "Mastercard", "aliases": ["mastercard", "ma"]},
    "UNH": {"name": "UnitedHealth Group Inc.", "short": "UnitedHealth", "aliases": ["unitedhealth", "unh"]},
    "HD": {"name": "Home Depot Inc.", "short": "Home Depot", "aliases": ["home depot", "hd"]},
    "DIS": {"name": "Walt Disney Company", "short": "Disney", "aliases": ["disney", "dis"]},
    "BAC": {"name": "Bank of America Corp.", "short": "Bank of America", "aliases": ["bank of america", "bac"]},
    "XOM": {"name": "Exxon Mobil Corporation", "short": "Exxon", "aliases": ["exxon", "exxonmobil", "xom"]},
    "PFE": {"name": "Pfizer Inc.", "short": "Pfizer", "aliases": ["pfizer", "pfe"]},
    "CSCO": {"name": "Cisco Systems Inc.", "short": "Cisco", "aliases": ["cisco", "csco"]},
    "NFLX": {"name": "Netflix Inc.", "short": "Netflix", "aliases": ["netflix", "nflx"]},
    "CRM": {"name": "Salesforce Inc.", "short": "Salesforce", "aliases": ["salesforce", "crm"]},
    "AMD": {"name": "Advanced Micro Devices Inc.", "short": "AMD", "aliases": ["advanced micro", "amd"]},
    "INTC": {"name": "Intel Corporation", "short": "Intel", "aliases": ["intel", "intc"]},
    "KO": {"name": "Coca-Cola Company", "short": "Coca-Cola", "aliases": ["coca cola", "coke", "ko"]},
    "PEP": {"name": "PepsiCo Inc.", "short": "PepsiCo", "aliases": ["pepsi", "pepsico", "pep"]},
    "ADBE": {"name": "Adobe Inc.", "short": "Adobe", "aliases": ["adobe", "adbe"]},
    "COST": {"name": "Costco Wholesale Corp.", "short": "Costco", "aliases": ["costco", "cost"]},
    "NKE": {"name": "Nike Inc.", "short": "Nike", "aliases": ["nike", "nke"]},
    "MRK": {"name": "Merck & Co. Inc.", "short": "Merck", "aliases": ["merck", "mrk"]},
    "ABBV": {"name": "AbbVie Inc.", "short": "AbbVie", "aliases": ["abbvie", "abbv"]},
    "AVGO": {"name": "Broadcom Inc.", "short": "Broadcom", "aliases": ["broadcom", "avgo"]},
    "MCD": {"name": "McDonald's Corporation", "short": "McDonald's", "aliases": ["mcdonald", "mcd"]},
    "WFC": {"name": "Wells Fargo & Co.", "short": "Wells Fargo", "aliases": ["wells fargo", "wfc"]},
    "LIN": {"name": "Linde plc", "short": "Linde", "aliases": ["linde", "lin"]},
    "TXN": {"name": "Texas Instruments Inc.", "short": "Texas Instruments", "aliases": ["texas instruments", "txn"]},
    "RTX": {"name": "RTX Corporation", "short": "RTX", "aliases": ["rtx", "raytheon"]},
    "HON": {"name": "Honeywell International Inc.", "short": "Honeywell", "aliases": ["honeywell", "hon"]},
    "LOW": {"name": "Lowe's Companies Inc.", "short": "Lowe's", "aliases": ["lowe", "lowes", "low"]},
    "IBM": {"name": "International Business Machines Corp.", "short": "IBM", "aliases": ["ibm"]},
    "QCOM": {"name": "Qualcomm Inc.", "short": "Qualcomm", "aliases": ["qualcomm", "qcom"]},
    "CAT": {"name": "Caterpillar Inc.", "short": "Caterpillar", "aliases": ["caterpillar", "cat"]},
    "BA": {"name": "Boeing Company", "short": "Boeing", "aliases": ["boeing", "ba"]},
    "GE": {"name": "General Electric Company", "short": "GE", "aliases": ["general electric", "ge"]},
    "GS": {"name": "Goldman Sachs Group Inc.", "short": "Goldman Sachs", "aliases": ["goldman sachs", "gs"]},
    "ORCL": {"name": "Oracle Corporation", "short": "Oracle", "aliases": ["oracle", "orcl"]},
    "CVX": {"name": "Chevron Corporation", "short": "Chevron", "aliases": ["chevron", "cvx"]},
    "SPY": {"name": "SPDR S&P 500 ETF Trust", "short": "SPY", "aliases": ["s&p 500", "spy etf"]},
    "QQQ": {"name": "Invesco QQQ Trust", "short": "QQQ", "aliases": ["nasdaq 100", "qqq etf"]},
    "IWM": {"name": "iShares Russell 2000 ETF", "short": "IWM", "aliases": ["russell 2000", "iwm"]},
    "BRK.B": {"name": "Berkshire Hathaway Inc.", "short": "Berkshire Hathaway", "aliases": ["berkshire", "brk"]},
    "BF.B": {"name": "Brown-Forman Inc.", "short": "Brown-Forman", "aliases": ["brown forman"]},
    "PM": {"name": "Philip Morris International Inc.", "short": "Philip Morris", "aliases": ["philip morris", "pm"]},
    "DHR": {"name": "Danaher Corporation", "short": "Danaher", "aliases": ["danaher", "dhr"]},
    "ACN": {"name": "Accenture plc", "short": "Accenture", "aliases": ["accenture", "acn"]},
    "TMO": {"name": "Thermo Fisher Scientific Inc.", "short": "Thermo Fisher", "aliases": ["thermo fisher", "tmo"]},
    "COP": {"name": "ConocoPhillips", "short": "ConocoPhillips", "aliases": ["conocophillips", "conoco", "cop"]},
    "NEE": {"name": "NextEra Energy Inc.", "short": "NextEra", "aliases": ["nextera", "nee"]},
    "PG": {"name": "Procter & Gamble Company", "short": "P&G", "aliases": ["procter", "pg"]},
    "LLY": {"name": "Eli Lilly and Company", "short": "Eli Lilly", "aliases": ["eli lilly", "lilly", "lly"]},
    "SCHW": {"name": "Charles Schwab Corporation", "short": "Charles Schwab", "aliases": ["charles schwab", "schw"]},
    "ABT": {"name": "Abbott Laboratories", "short": "Abbott", "aliases": ["abbott", "abt"]},
    "AMGN": {"name": "Amgen Inc.", "short": "Amgen", "aliases": ["amgen", "amgn"]},
    "ISRG": {"name": "Intuitive Surgical Inc.", "short": "Intuitive Surgical", "aliases": ["intuitive surgical", "isrg"]},
    "BKNG": {"name": "Booking Holdings Inc.", "short": "Booking", "aliases": ["booking", "bkng"]},
    "PLTR": {"name": "Palantir Technologies Inc.", "short": "Palantir", "aliases": ["palantir", "pltr"]},
    "COIN": {"name": "Coinbase Global Inc.", "short": "Coinbase", "aliases": ["coinbase", "coin"]},
    "SNOW": {"name": "Snowflake Inc.", "short": "Snowflake", "aliases": ["snowflake", "snow"]},
    "UBER": {"name": "Uber Technologies Inc.", "short": "Uber", "aliases": ["uber"]},
    "SQ": {"name": "Block Inc.", "short": "Block", "aliases": ["block", "square"]},
    "SHOP": {"name": "Shopify Inc.", "short": "Shopify", "aliases": ["shopify", "shop"]},
    "ZS": {"name": "Zscaler Inc.", "short": "Zscaler", "aliases": ["zscaler", "zs"]},
    "PANW": {"name": "Palo Alto Networks Inc.", "short": "Palo Alto", "aliases": ["palo alto", "panw"]},
    "DDOG": {"name": "Datadog Inc.", "short": "Datadog", "aliases": ["datadog", "ddog"]},
    "CRWD": {"name": "CrowdStrike Holdings Inc.", "short": "CrowdStrike", "aliases": ["crowdstrike", "crwd"]},
    "NET": {"name": "Cloudflare Inc.", "short": "Cloudflare", "aliases": ["cloudflare", "net"]},
    "MDB": {"name": "MongoDB Inc.", "short": "MongoDB", "aliases": ["mongodb", "mdb"]},
    "SNAP": {"name": "Snap Inc.", "short": "Snap", "aliases": ["snap", "snapchat"]},
    "PINS": {"name": "Pinterest Inc.", "short": "Pinterest", "aliases": ["pinterest", "pins"]},
    "RIVN": {"name": "Rivian Automotive Inc.", "short": "Rivian", "aliases": ["rivian", "rivn"]},
    "LCID": {"name": "Lucid Group Inc.", "short": "Lucid", "aliases": ["lucid", "lcid"]},
    "SOFI": {"name": "SoFi Technologies Inc.", "short": "SoFi", "aliases": ["sofi"]},
    "HOOD": {"name": "Robinhood Markets Inc.", "short": "Robinhood", "aliases": ["robinhood", "hood"]},
}


def resolve_company(ticker: str) -> CompanyIdentity:
    """
    Resolve a ticker to its company identity.
    Uses override database for speed and reliability.
    """
    ticker = ticker.upper().strip()

    # Check cache
    if ticker in _identity_cache:
        ts, identity = _identity_cache[ticker]
        if time.time() - ts < _IDENTITY_CACHE_TTL:
            return identity

    # Check override database first (fast, reliable)
    if ticker in _COMPANY_DB:
        entry = _COMPANY_DB[ticker]
        identity = CompanyIdentity(
            ticker=ticker,
            canonical_name=entry["name"],
            short_name=entry.get("short", ""),
            aliases=entry.get("aliases", []),
        )
        _identity_cache[ticker] = (time.time(), identity)
        logger.info(f"[RESOLVER] {ticker} → {identity.canonical_name} (from DB)")
        return identity

    # Fallback: try YahooQuery
    try:
        from yahooquery import Ticker
        yq_ticker = Ticker(ticker, asynchronous=False, max_workers=1)
        summary = yq_ticker.summary_detail
        if summary and ticker in summary:
            meta = summary[ticker]
            canonical_name = meta.get("shortName") or meta.get("longName") or ticker
            short_name = meta.get("shortName", "")
            if canonical_name and canonical_name != ticker:
                aliases = [canonical_name.split()[0].lower()] if canonical_name else []
                identity = CompanyIdentity(
                    ticker=ticker,
                    canonical_name=canonical_name,
                    short_name=short_name,
                    aliases=aliases,
                )
                _identity_cache[ticker] = (time.time(), identity)
                return identity
    except Exception as e:
        logger.debug(f"[RESOLVER] YahooQuery failed for {ticker}: {e}")

    # Final fallback: use ticker as name
    identity = CompanyIdentity(
        ticker=ticker,
        canonical_name=ticker,
        short_name=ticker,
        aliases=[ticker.lower()],
    )
    _identity_cache[ticker] = (time.time(), identity)
    return identity


def get_search_queries(identity: CompanyIdentity) -> List[str]:
    """Generate optimized search queries for news providers."""
    queries = []
    queries.append(identity.canonical_name)
    if identity.short_name and identity.short_name != identity.canonical_name:
        queries.append(identity.short_name)
    for alias in identity.aliases[:2]:
        queries.append(alias)
    return queries
