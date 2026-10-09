"""
news_engine/sec_edgar.py — SEC EDGAR company filings (free, no API key).

The SEC asks that automated clients send a descriptive User-Agent with contact
info and stay at/under 10 requests/second. We make at most 2 requests per
ticker per cache window (company_tickers.json once per process, submissions
JSON cached 1h per CIK).

Used by:
- GET /api/news/filings  (Company Filings section in the UI)
"""

import os
import time
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple

import requests

logger = logging.getLogger(__name__)

# SEC fair-access: identify yourself. Overridable for ops.
_SEC_UA = os.environ.get(
    "SEC_USER_AGENT",
    "StockVantex/1.0 (news aggregation; admin@stockvantex.com)",
)
_SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json"
_SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
_TIMEOUT = 12

# Filings worth showing in a "Company Filings" section.
# Insider forms (3, 4, 5, 144) and ownership (SC 13G) are excluded as noise.
MEANINGFUL_FORMS = {
    "8-K", "10-K", "10-Q", "10-K/A", "10-Q/A", "8-K/A",
    "DEF 14A", "DEFM14A", "DEFA14A",
    "S-1", "S-3", "424B3", "424B4", "424B5",
    "6-K", "20-F", "40-F", "11-K", "SC 13D",
}

_lock = threading.Lock()
_ticker_cik_cache: Dict[str, Optional[int]] = {}
_cik_filings_cache: Dict[int, Tuple[float, List[Dict[str, Any]]]] = {}
_CIK_CACHE_TTL = 3600.0


def _get_headers() -> Dict[str, str]:
    return {"User-Agent": _SEC_UA, "Accept-Encoding": "gzip, deflate"}


def _load_ticker_ciks() -> Dict[str, int]:
    """Load ticker→CIK map (one request per process)."""
    global _ticker_cik_map
    with _lock:
        cached = globals().get("_ticker_cik_map")
        if cached is not None:
            return cached
    try:
        resp = requests.get(_SEC_TICKER_URL, headers=_get_headers(), timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        mapping = {str(v.get("ticker", "")).upper(): int(v["cik_str"]) for v in data.values() if v.get("cik_str")}
        with _lock:
            globals()["_ticker_cik_map"] = mapping
        logger.info(f"[SEC] loaded {len(mapping)} ticker→CIK mappings")
        return mapping
    except Exception as e:
        logger.warning(f"[SEC] company_tickers.json load failed: {e}")
        with _lock:
            globals().setdefault("_ticker_cik_map", {})
        return globals().get("_ticker_cik_map", {})


def get_cik(ticker: str) -> Optional[int]:
    """Resolve a ticker to its SEC CIK (cached per process)."""
    ticker = (ticker or "").upper().strip()
    if not ticker:
        return None
    with _lock:
        if ticker in _ticker_cik_cache:
            return _ticker_cik_cache[ticker]
    cik = _load_ticker_ciks().get(ticker)
    with _lock:
        _ticker_cik_cache[ticker] = cik
    return cik


def fetch_filings(ticker: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Return recent meaningful SEC filings for a ticker (newest first).

    Each item: form, filing_date, accession, url, description, report_date.
    """
    from .provider_budget import budget_manager

    ticker = (ticker or "").upper().strip()
    cik = get_cik(ticker)
    if not cik:
        return []

    now = time.time()
    with _lock:
        cached = _cik_filings_cache.get(cik)
        if cached and now - cached[0] < _CIK_CACHE_TTL:
            filings = cached[1]
            return filings[:limit]

    start = time.perf_counter()
    try:
        resp = requests.get(_SEC_SUBMISSIONS_URL.format(cik=cik), headers=_get_headers(), timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        latency_ms = (time.perf_counter() - start) * 1000
        budget_manager.record_success(
            "sec_edgar", ticker=ticker, reason="submissions",
            http_status=200, articles_returned=0, duration_ms=latency_ms,
        )
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        budget_manager.record_failure("sec_edgar", str(e)[:200], ticker=ticker, reason="submissions")
        logger.debug(f"[SEC] submissions fetch failed for {ticker}: {e}")
        return []

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    docs = recent.get("primaryDocument", [])
    descs = recent.get("primaryDocDescription", [])
    reports = recent.get("reportDate", [])

    filings: List[Dict[str, Any]] = []
    for i in range(min(len(forms), 1000)):
        form = forms[i]
        if form not in MEANINGFUL_FORMS:
            continue
        accession = accessions[i] if i < len(accessions) else ""
        primary_doc = docs[i] if i < len(docs) else ""
        accession_path = accession.replace("-", "")
        url = ""
        if accession_path and primary_doc:
            url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_path}/{primary_doc}"
        filings.append({
            "form": form,
            "filing_date": dates[i] if i < len(dates) else "",
            "report_date": reports[i] if i < len(reports) else "",
            "accession": accession,
            "url": url,
            "description": (descs[i] if i < len(descs) else "") or "",
        })
        if len(filings) >= 60:
            break

    with _lock:
        _cik_filings_cache[cik] = (time.time(), filings)
    return filings[:limit]
