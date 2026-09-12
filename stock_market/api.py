import math
import time
import threading
import traceback
import os
from dotenv import load_dotenv

# Load .env from stock_market directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import core logic
from utils import get_top_performing_stocks, get_latest_price, load_data, STOCK_NAMES, get_cached_forecast, set_cached_forecast
from indicators import calculate_indicators
from sentiment import analyze_sentiment
from forecast_onnx import load_forecast_model, forecast_stock

# Import new modules
from multi_asset import get_asset_info, search_assets, get_default_watchlist, get_watchlist_by_category
from opportunity import scan_watchlist, calculate_opportunity_score
from volatility import get_volatility_summary, calculate_relative_volume, calculate_expected_range
from risk import assess_risk, calculate_trend_strength
from watchlist_monitor import scan_watchlist_intelligent

# Import cache manager and persistent dual-layer SWR engine
from cache_manager import cache_manager

# Import news provider aggregator for status endpoint
from news_providers import news_aggregator

# 2. MODEL + SCALER GLOBAL SINGLETON LOADING
MODEL = None
SCALERS = None

def safe_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


# ─── Performance Instrumentation ────────────────────────────────────────────
import logging
logger = logging.getLogger(__name__)

class _Timer:
    """Context manager that logs elapsed time on exit."""
    def __init__(self, label: str):
        self.label = label
        self.start = 0.0
        self.elapsed = 0.0

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed = (time.perf_counter() - self.start) * 1000  # ms
        logger.info(f"[PERF] {self.label}: {self.elapsed:.0f}ms")


# ─── Background Market Precomputation Daemon ─────────────────────────────
_PRECOMPUTE_INTERVAL = 180  # 3 minutes

def _precompute_top_stocks():
    """Background thread to refresh top performers."""
    try:
        get_top_performing_stocks(limit=10)
    except Exception as e:
        logger.debug(f"Precompute top stocks failed: {e}")

def _get_precomputed_top_stocks():
    """Returns top performing stocks from persistent SWR cache."""
    return get_top_performing_stocks(limit=6)

def _background_precompute_daemon():
    """Periodically precomputes market-wide analytics out of the hot user request path."""
    time.sleep(5)  # Wait for startup to complete
    while True:
        try:
            logger.info("[PERF] Daemon: precomputing market-wide snapshots...")
            # 1. Top performers
            get_top_performing_stocks(limit=10)
            # 2. Overview snapshot for default stock (AAPL)
            try:
                _compute_market_overview_raw("AAPL", "1y")
            except Exception:
                pass
            # 3. Opportunity scan for default watchlist
            try:
                wl = get_default_watchlist()[:15]
                scan_watchlist(wl, "1y")
            except Exception:
                pass
            logger.info("[PERF] Daemon: market-wide precomputation finished successfully.")
        except Exception as e:
            logger.warning(f"Daemon precomputation error: {e}")
        time.sleep(_PRECOMPUTE_INTERVAL)

app = FastAPI(title="AI Driven Market Analysis API")

# 2. LOAD ONCE AT STARTUP
@app.on_event("startup")
def load_models_at_startup():
    global MODEL, SCALERS
    print("Loading ONNX Stock forecast model at startup...")
    try:
        MODEL, SCALERS = load_forecast_model()
        print("ONNX Stock model loaded successfully.")
    except Exception as e:
        print(f"ONNX Stock model load failed: {e}")
        MODEL = None
        SCALERS = None

    # Pre-warm yahooquery session in background so first request is fast
    def _warm_session():
        try:
            from yahooquery_adapter import _get_shared_session
            print("Pre-warming yahooquery session...")
            _get_shared_session()
            print("Yahooquery session ready.")
        except Exception as e:
            print(f"Yahooquery session warm-up failed (non-fatal): {e}")

    threading.Thread(target=_warm_session, daemon=True).start()

    # Start background market precomputation daemon
    threading.Thread(target=_background_precompute_daemon, daemon=True).start()
    print("Background market-wide precomputation daemon started.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. LIMIT YFINANCE DATA SIZE
class IndicatorRequest(BaseModel):
    ticker: str
    period: str = "1y"

class ForecastRequest(BaseModel):
    ticker: str
    forecast_days: int = 10
    period: str = "1y"

class WatchlistScanRequest(BaseModel):
    tickers: List[str]
    period: str = "1y"

class SingleAssetRequest(BaseModel):
    ticker: str
    period: str = "1y"

class SentimentRequest(BaseModel):
    ticker: str

# 9. ADD STARTUP HEALTH GUARANTEE
@app.get("/")
def home():
    return {"status": "running", "service": "stock-api"}

@app.get("/healthz")
def health_check():
    return {"status": "healthy"}

@app.get("/api/news/providers")
def get_news_providers_status():
    """Return health status and circuit breaker state of all news providers."""
    return news_aggregator.get_provider_status()


@app.post("/api/data/catalysts")
def get_catalysts(req: SentimentRequest):
    """
    Detect market-moving catalysts from recent news for a ticker.
    Returns categorized events with impact direction and confidence.
    """
    from catalyst import detect_catalysts, get_catalyst_summary

    cache_key = f"catalysts:{req.ticker}"

    def _compute_catalysts_raw():
        articles = news_aggregator.fetch_news(req.ticker, max_results=15)
        article_dicts = [a.__dict__ for a in articles]
        catalysts = detect_catalysts(article_dicts)
        summary = get_catalyst_summary(catalysts)
        return {
            "ticker": req.ticker,
            "catalysts": catalysts,
            "summary": summary,
        }

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_catalysts_raw,
        fresh_ttl_seconds=300.0,   # 5 min fresh
        stale_ttl_seconds=86400.0, # 24h stale
        category="catalysts",
        ticker=req.ticker,
    )

    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    result = _compute_catalysts_raw()
    cache_manager.set(
        key=cache_key,
        payload=result,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="catalysts",
        ticker=req.ticker,
    )
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


@app.post("/api/data/timeframe")
def get_timeframe_decision(req: IndicatorRequest):
    """
    Compute timeframe-based trading decisions (Short-Term, Swing, Position).
    Returns signal, confidence, component breakdown for each timeframe.
    """
    from timeframe_engine import compute_all_timeframes

    cache_key = f"timeframe:{req.ticker}:{req.period}"

    def _compute_timeframe_raw():
        df = load_data(req.ticker, req.period)
        if df is None or df.empty:
            return {"ticker": req.ticker, "error": "No data available"}

        df_ind_records = calculate_indicators(df)
        df_ind = pd.DataFrame(df_ind_records)

        result = compute_all_timeframes(df_ind)
        result["ticker"] = req.ticker
        return result

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_timeframe_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="timeframe",
        ticker=req.ticker,
        period=req.period,
    )

    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    result = _compute_timeframe_raw()
    cache_manager.set(
        key=cache_key,
        payload=result,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="timeframe",
        ticker=req.ticker,
        period=req.period,
    )
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


@app.post("/api/data/signal-evidence")
def get_signal_evidence(req: IndicatorRequest):
    """
    Backtest historical signal accuracy for a ticker.
    Returns accuracy metrics and recent signal history for RSI, MACD, trend, Bollinger.
    """
    from signal_history import compute_signal_evidence

    cache_key = f"signal_evidence:{req.ticker}:{req.period}"

    def _compute_evidence_raw():
        df = load_data(req.ticker, req.period)
        if df is None or df.empty:
            return {"ticker": req.ticker, "error": "No data available"}

        df_ind_records = calculate_indicators(df)
        df_ind = pd.DataFrame(df_ind_records)

        result = compute_signal_evidence(df_ind)
        result["ticker"] = req.ticker
        return result

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_evidence_raw,
        fresh_ttl_seconds=600.0,
        stale_ttl_seconds=86400.0,
        category="signal_evidence",
        ticker=req.ticker,
        period=req.period,
    )

    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    result = _compute_evidence_raw()
    cache_manager.set(
        key=cache_key,
        payload=result,
        fresh_ttl_seconds=600.0,
        stale_ttl_seconds=86400.0,
        category="signal_evidence",
        ticker=req.ticker,
        period=req.period,
    )
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


@app.post("/api/watchlist/monitor")
def watchlist_monitor(req: WatchlistScanRequest):
    """
    Intelligent watchlist monitoring: detects meaningful price moves,
    volume spikes, RSI extremes, and trend changes across watchlist tickers.
    """
    from watchlist_monitor import scan_watchlist_intelligent

    if not req.tickers:
        req.tickers = get_default_watchlist()

    tickers_to_scan = req.tickers[:20]
    cache_key = f"watchlist_monitor:{req.period}:{','.join(sorted(tickers_to_scan))}"

    def _compute_monitor():
        return scan_watchlist_intelligent(tickers_to_scan, req.period)

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_monitor,
        fresh_ttl_seconds=120.0,   # 2 min fresh
        stale_ttl_seconds=86400.0,
        category="watchlist_monitor",
    )

    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    result = _compute_monitor()
    cache_manager.set(
        key=cache_key,
        payload=result,
        fresh_ttl_seconds=120.0,
        stale_ttl_seconds=86400.0,
        category="watchlist_monitor",
    )
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


@app.post("/api/data/indicators")
def get_stock_data_and_indicators(req: IndicatorRequest):
    """
    Return stock indicators, overview data, current price, and top performers.
    Uses Dual-Layer Persistent SWR cache.
    """
    start_t = time.perf_counter()
    cache_key = f"indicators:{req.ticker}:{req.period}"

    def _compute_indicators_raw():
        df = load_data(req.ticker, req.period)
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="Data not found for ticker")

        indicators = calculate_indicators(df)
        current_price = 0.0
        price_change = 0.0
        price_change_pct = 0.0
        try:
            live = get_latest_price(req.ticker)
            if live is not None and live > 0:
                current_price = live
                if len(df) >= 2:
                    prev_close = float(df["Close"].iloc[-2]) if not isinstance(df["Close"].iloc[-2], pd.DataFrame) else float(df["Close"].iloc[-2].iloc[0])
                    if prev_close > 0:
                        price_change = current_price - prev_close
                        price_change_pct = (price_change / prev_close) * 100
            elif len(df) > 0:
                last_close = df["Close"].iloc[-1]
                if isinstance(last_close, pd.DataFrame):
                    last_close = last_close.iloc[:, 0]
                current_price = float(last_close)
                if len(df) >= 2:
                    prev_close = df["Close"].iloc[-2]
                    if isinstance(prev_close, pd.DataFrame):
                        prev_close = prev_close.iloc[:, 0]
                    prev_close = float(prev_close)
                    if prev_close > 0:
                        price_change = current_price - prev_close
                        price_change_pct = (price_change / prev_close) * 100
        except Exception:
            pass

        top_stocks = []
        try:
            top_stocks = get_top_performing_stocks(limit=6)
        except Exception:
            pass

        return {
            "ticker": req.ticker,
            "data": indicators,
            "currentPrice": current_price,
            "change": price_change,
            "changePercent": price_change_pct,
            "topStocks": top_stocks,
        }

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_indicators_raw,
        fresh_ttl_seconds=120.0,
        stale_ttl_seconds=86400.0,
        category="indicators",
        ticker=req.ticker,
        period=req.period
    )

    if payload is not None:
        elapsed = (time.perf_counter() - start_t) * 1000
        logger.info(f"[PERF] endpoint=/api/data/indicators ticker={req.ticker} status={meta['status']} latency={elapsed:.1f}ms")
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    res_raw = _compute_indicators_raw()
    cache_manager.set(
        key=cache_key,
        payload=res_raw,
        fresh_ttl_seconds=120.0,
        stale_ttl_seconds=86400.0,
        category="indicators",
        ticker=req.ticker,
        period=req.period
    )
    elapsed = (time.perf_counter() - start_t) * 1000
    logger.info(f"[PERF] endpoint=/api/data/indicators ticker={req.ticker} status=MISS latency={elapsed:.1f}ms")
    meta["status"] = "MISS"
    res = dict(res_raw)
    res["_cache_meta"] = meta
    return res


# ─── Endpoint In-Memory Caching ──────────────────────────────────────────────
_endpoint_cache: Dict[str, tuple[float, Any]] = {}
_endpoint_cache_lock = threading.Lock()

def _get_cached_endpoint(key: str, ttl_seconds: float = 60.0) -> Optional[Any]:
    with _endpoint_cache_lock:
        if key in _endpoint_cache:
            ts, val = _endpoint_cache[key]
            if time.time() - ts < ttl_seconds:
                return val
    return None

def _set_cached_endpoint(key: str, val: Any) -> None:
    with _endpoint_cache_lock:
        _endpoint_cache[key] = (time.time(), val)


def _compute_market_overview_raw(ticker: str, period: str) -> Dict[str, Any]:
    """Raw computation for market overview payload."""
    result = {"ticker": ticker}

    with _Timer(f"market_overview_calc({ticker},{period})"):
        try:
            df = load_data(ticker, period)
        except Exception:
            df = None

        if df is None or df.empty:
            result.update({
                "data": [], "currentPrice": 0, "change": 0, "changePercent": 0,
                "volatility": None, "risk": None, "trendStrength": None,
                "tradeConfirmation": None, "sentiment": None,
                "topStocks": _get_precomputed_top_stocks(),
                "watchlist": [], "marketStatus": "Unknown"
            })
            return result

        try:
            indicators = calculate_indicators(df)
            result["data"] = indicators
            df_ind = pd.DataFrame(indicators)
        except Exception:
            indicators = []
            df_ind = pd.DataFrame()

        current_price = 0.0
        price_change = 0.0
        price_change_pct = 0.0
        try:
            live = get_latest_price(ticker)
            if live and live > 0:
                current_price = live
                if len(df) >= 2:
                    prev = float(df["Close"].iloc[-2])
                    if prev > 0:
                        price_change = current_price - prev
                        price_change_pct = (price_change / prev) * 100
            elif len(df) > 0:
                last_c = df["Close"].iloc[-1]
                if isinstance(last_c, pd.DataFrame):
                    last_c = last_c.iloc[:, 0]
                current_price = float(last_c)
                if len(df) >= 2:
                    prev = df["Close"].iloc[-2]
                    if isinstance(prev, pd.DataFrame):
                        prev = prev.iloc[:, 0]
                    prev = float(prev)
                    if prev > 0:
                        price_change = current_price - prev
                        price_change_pct = (price_change / prev) * 100
        except Exception:
            pass

        result["currentPrice"] = current_price
        result["change"] = price_change
        result["changePercent"] = price_change_pct

        asset_info = get_asset_info(ticker)
        has_volume = asset_info["has_volume"]

        def _compute_volatility():
            try:
                return ("volatility", get_volatility_summary(df, has_volume))
            except Exception:
                return ("volatility", None)

        def _compute_risk():
            try:
                if not df_ind.empty:
                    return ("risk", assess_risk(df_ind, ticker))
            except Exception:
                pass
            return ("risk", None)

        def _compute_trend():
            try:
                if not df_ind.empty:
                    score = calculate_trend_strength(df_ind)
                    return ("trendStrength", {
                        "ticker": ticker,
                        "trend_score": round(score, 1),
                        "trend_label": "Bullish" if score > 60 else "Bearish" if score < 40 else "Neutral"
                    })
            except Exception:
                pass
            return ("trendStrength", None)

        def _compute_sentiment():
            try:
                sent_full = analyze_sentiment(ticker)
                return ("sentiment", {
                    "ticker": ticker,
                    "sentiment_score": sent_full["score"],
                    "sentiment_label": sent_full["label"],
                    "positive_count": sent_full.get("positive_count", 0),
                    "negative_count": sent_full.get("negative_count", 0),
                    "news": sent_full["news"],
                    "score": sent_full["score"],
                    "label": sent_full["label"],
                    "sentiment_trend_7d": sent_full.get("sentiment_trend_7d", []),
                    "news_impact_summary": sent_full.get("news_impact_summary", ""),
                    "market_mood": sent_full.get("market_mood", "Unknown"),
                })
            except Exception:
                return ("sentiment", None)

        def _compute_top_stocks():
            try:
                precomputed = _get_precomputed_top_stocks()
                if precomputed:
                    return ("topStocks", precomputed[:6])
                return ("topStocks", get_top_performing_stocks(limit=6))
            except Exception:
                return ("topStocks", [])

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(_compute_volatility): "volatility",
                executor.submit(_compute_risk): "risk",
                executor.submit(_compute_trend): "trendStrength",
                executor.submit(_compute_sentiment): "sentiment",
                executor.submit(_compute_top_stocks): "topStocks",
            }
            for future in as_completed(futures):
                try:
                    key, value = future.result()
                    result[key] = value
                except Exception:
                    pass

        try:
            if not df_ind.empty:
                latest = df_ind.iloc[-1]
                sent_data = {"score": 0.0, "label": "Neutral"}
                if result.get("sentiment"):
                    sent_data = {"score": result["sentiment"]["score"], "label": result["sentiment"]["label"]}

                opp = calculate_opportunity_score(ticker, period, skip_sentiment=True)
                vol_s = result.get("volatility") or {}
                risk_d = result.get("risk") or {}

                result["tradeConfirmation"] = {
                    "ticker": ticker,
                    "name": asset_info["name"],
                    "opportunity_score": opp["score"] if opp else 50.0,
                    "trend": result.get("trendStrength") or {},
                    "technicals": {
                        "rsi": round(float(latest.get("RSI", 50)), 1),
                        "macd_signal": "Bullish" if float(latest.get("MACD", 0)) > float(latest.get("Signal", 0)) else "Bearish"
                    },
                    "risk": {
                        "level": risk_d.get("risk_level", "Unknown"),
                        "score": risk_d.get("risk_score", 50)
                    },
                    "volatility": {
                        "level": "High" if vol_s.get("daily_volatility", 0) > 35 else "Low" if vol_s.get("daily_volatility", 0) < 15 else "Medium",
                        "daily": round(vol_s.get("daily_volatility", 0), 1)
                    },
                    "sentiment": sent_data,
                    "relative_volume": vol_s.get("relative_volume", {"available": False})
                }
            else:
                result["tradeConfirmation"] = None
        except Exception:
            result["tradeConfirmation"] = None

        try:
            result["watchlist"] = get_default_watchlist()
        except Exception:
            result["watchlist"] = []

        try:
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            et = now - timedelta(hours=4)
            hour, minute = et.hour, et.minute
            weekday = et.weekday()
            market_time = hour * 60 + minute
            market_open = 9 * 60 + 30
            market_close = 16 * 60
            is_weekday = weekday < 5
            is_open = is_weekday and market_open <= market_time < market_close
            result["marketStatus"] = "Open" if is_open else "Closed"
        except Exception:
            result["marketStatus"] = "Unknown"

    return result


@app.post("/api/market/overview")
def get_market_overview(req: IndicatorRequest):
    """
    COMBINED endpoint: returns ALL data needed for the market overview page.
    Uses Dual-Layer Persistent SWR cache with single-flight request coalescing.
    """
    start_t = time.perf_counter()
    ticker = req.ticker
    period = req.period
    cache_key = f"overview:{ticker}:{period}"

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=lambda: _compute_market_overview_raw(ticker, period),
        fresh_ttl_seconds=120.0,
        stale_ttl_seconds=86400.0,
        category="overview",
        ticker=ticker,
        period=period
    )

    if payload is not None:
        elapsed = (time.perf_counter() - start_t) * 1000
        logger.info(f"[PERF] endpoint=/api/market/overview ticker={ticker} status={meta['status']} latency={elapsed:.1f}ms")
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    # Cache MISS: calculate synchronously under single-flight lock
    result = _compute_market_overview_raw(ticker, period)
    cache_manager.set(
        key=cache_key,
        payload=result,
        fresh_ttl_seconds=120.0,
        stale_ttl_seconds=86400.0,
        category="overview",
        ticker=ticker,
        period=period
    )
    elapsed = (time.perf_counter() - start_t) * 1000
    logger.info(f"[PERF] endpoint=/api/market/overview ticker={ticker} status=MISS latency={elapsed:.1f}ms")
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


class DiscoverScanRequest(BaseModel):
    tickers: List[str]
    period: str = "1y"


@app.get("/api/home/intelligence")
def get_home_intelligence():
    """
    Fast aggregated endpoint for the Home intelligence center.
    Returns: market snapshot, top opportunities, selected stock brief, watchlist alerts.
    All data is precomputed or SWR-cached — never blocks on fresh computation.
    """
    cache_key = "home_intelligence"

    def _compute_raw():
        result = {}

        # 1. Market status
        try:
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            et = now - timedelta(hours=4)
            hour, minute = et.hour, et.minute
            weekday = et.weekday()
            market_time = hour * 60 + minute
            market_open = 9 * 60 + 30
            market_close = 16 * 60
            is_weekday = weekday < 5
            is_open = is_weekday and market_open <= market_time < market_close
            result["marketStatus"] = "Open" if is_open else "Closed"
        except Exception:
            result["marketStatus"] = "Unknown"

        # 2. Top performing stocks (precomputed by daemon)
        try:
            top = get_top_performing_stocks(limit=8)
            result["topStocks"] = top
        except Exception:
            result["topStocks"] = []

        # 3. Selected stock brief (use AAPL default or first top stock)
        try:
            default_ticker = "AAPL"
            if result["topStocks"]:
                default_ticker = result["topStocks"][0].get("symbol", "AAPL")

            brief_key = f"overview:{default_ticker}:1y"
            brief_payload, _ = cache_manager.get_swr(
                key=brief_key,
                refresh_func=lambda: _compute_market_overview_raw(default_ticker, "1y"),
                fresh_ttl_seconds=120.0,
                stale_ttl_seconds=86400.0,
                category="overview",
                ticker=default_ticker,
                period="1y",
            )
            if brief_payload:
                result["selectedStock"] = {
                    "ticker": brief_payload.get("ticker", default_ticker),
                    "price": brief_payload.get("currentPrice", 0),
                    "change": brief_payload.get("change", 0),
                    "changePercent": brief_payload.get("changePercent", 0),
                    "signal": (brief_payload.get("tradeConfirmation") or {}).get("signal", "Hold"),
                    "score": (brief_payload.get("tradeConfirmation") or {}).get("opportunity_score", 50),
                    "risk": (brief_payload.get("risk") or {}).get("risk_level", "Unknown"),
                    "sentiment": (brief_payload.get("sentiment") or {}).get("sentiment_label", "Neutral"),
                    "market_mood": (brief_payload.get("sentiment") or {}).get("market_mood", "Unknown"),
                    "volatility": (brief_payload.get("volatility") or {}).get("daily_volatility", 0),
                    "marketStatus": brief_payload.get("marketStatus", "Unknown"),
                }
            else:
                result["selectedStock"] = None
        except Exception:
            result["selectedStock"] = None

        # 4. Discover scan (top 6 watchlist stocks — fast)
        try:
            default_tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA']
            discover_key = f"discover:1y:{','.join(sorted(default_tickers))}"
            discover_payload, _ = cache_manager.get_swr(
                key=discover_key,
                refresh_func=lambda: _discover_scan_raw(default_tickers, "1y"),
                fresh_ttl_seconds=120.0,
                stale_ttl_seconds=86400.0,
                category="discover",
            )
            if discover_payload:
                result["discover"] = list((discover_payload.get("stocks") or {}).values())[:6]
            else:
                result["discover"] = []
        except Exception:
            result["discover"] = []

        # 5. Watchlist alerts
        try:
            wl = get_default_watchlist()[:8]
            monitor_key = f"watchlist_monitor:1y:{','.join(sorted(wl))}"
            monitor_payload, _ = cache_manager.get_swr(
                key=monitor_key,
                refresh_func=lambda: scan_watchlist_intelligent(wl, "1y"),
                fresh_ttl_seconds=120.0,
                stale_ttl_seconds=86400.0,
                category="watchlist_monitor",
            )
            if monitor_payload:
                result["alerts"] = (monitor_payload.get("alerts") or [])[:5]
                result["alertSummary"] = {
                    "total": monitor_payload.get("total_alerts", 0),
                    "high": monitor_payload.get("high_severity", 0),
                    "medium": monitor_payload.get("medium_severity", 0),
                    "text": monitor_payload.get("summary_text", ""),
                }
            else:
                result["alerts"] = []
                result["alertSummary"] = None
        except Exception:
            result["alerts"] = []
            result["alertSummary"] = None

        return result

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=60.0,   # 1 min fresh
        stale_ttl_seconds=86400.0,
        category="home_intelligence",
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=60.0, stale_ttl_seconds=86400.0, category="home_intelligence")
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


def _discover_scan_raw(tickers: List[str], period: str) -> Dict[str, Any]:
    """Lightweight scan for discover section."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results: Dict[str, Any] = {}

    def _scan_single(ticker: str):
        try:
            df = load_data(ticker, period)
            if df is None or df.empty:
                return (ticker, None)
            asset_info = get_asset_info(ticker)
            current_price = 0.0
            price_change_pct = 0.0
            try:
                live = get_latest_price(ticker)
                if live and live > 0:
                    current_price = live
                    if len(df) >= 2:
                        prev = float(df["Close"].iloc[-2])
                        if prev > 0:
                            price_change_pct = ((current_price - prev) / prev) * 100
                elif len(df) > 0:
                    last_c = df["Close"].iloc[-1]
                    if isinstance(last_c, pd.DataFrame):
                        last_c = last_c.iloc[:, 0]
                    current_price = float(last_c)
            except Exception:
                pass

            signal = "Hold"
            opp_score = 50.0
            risk_level = "Unknown"
            try:
                indicators = calculate_indicators(df)
                df_ind = pd.DataFrame(indicators)
                if not df_ind.empty:
                    ts = calculate_trend_strength(df_ind)
                    latest = df_ind.iloc[-1]
                    rsi_val = float(latest.get("RSI", 50))
                    macd_val = float(latest.get("MACD", 0))
                    sig_val = float(latest.get("Signal", 0))
                    buy_s = sum([ts > 60, rsi_val < 30, macd_val > sig_val])
                    sell_s = sum([ts < 40, rsi_val > 70, macd_val <= sig_val])
                    if buy_s >= 2: signal = "Buy"
                    elif sell_s >= 2: signal = "Sell"
                    rd = assess_risk(df_ind, ticker)
                    risk_level = rd.get("risk_level", "Unknown")
                    opp = calculate_opportunity_score(ticker, period, skip_sentiment=True)
                    opp_score = opp["score"] if opp else 50.0
            except Exception:
                pass

            return (ticker, {
                "ticker": ticker,
                "name": asset_info.get("name", ticker),
                "price": round(current_price, 2),
                "changePercent": round(price_change_pct, 2),
                "signal": signal,
                "risk": risk_level,
                "score": round(opp_score, 0),
            })
        except Exception:
            return (ticker, None)

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(_scan_single, t): t for t in tickers[:6]}
        for future in as_completed(futures):
            ticker, data = future.result()
            if data:
                results[ticker] = data

    return {"stocks": results, "count": len(results)}

@app.post("/api/discover/scan")
def discover_scan(req: DiscoverScanRequest):
    """
    Lightweight bulk scan for Discover page.
    Returns price, change, signal, risk, sentiment, score for each ticker.
    Much faster than calling /api/market/overview N times.
    """
    cache_key = f"discover:{req.period}:{','.join(sorted(req.tickers[:10]))}"

    def _compute_raw():
        from concurrent.futures import ThreadPoolExecutor, as_completed
        results: Dict[str, Any] = {}

        def _scan_single(ticker: str):
            try:
                df = load_data(ticker, req.period)
                if df is None or df.empty:
                    return (ticker, None)

                asset_info = get_asset_info(ticker)
                has_volume = asset_info["has_volume"]

                # Price
                current_price = 0.0
                price_change = 0.0
                price_change_pct = 0.0
                try:
                    live = get_latest_price(ticker)
                    if live and live > 0:
                        current_price = live
                        if len(df) >= 2:
                            prev = float(df["Close"].iloc[-2])
                            if prev > 0:
                                price_change = current_price - prev
                                price_change_pct = (price_change / prev) * 100
                    elif len(df) > 0:
                        last_c = df["Close"].iloc[-1]
                        if isinstance(last_c, pd.DataFrame):
                            last_c = last_c.iloc[:, 0]
                        current_price = float(last_c)
                        if len(df) >= 2:
                            prev = df["Close"].iloc[-2]
                            if isinstance(prev, pd.DataFrame):
                                prev = prev.iloc[:, 0]
                            prev = float(prev)
                            if prev > 0:
                                price_change = current_price - prev
                                price_change_pct = (price_change / prev) * 100
                except Exception:
                    pass

                # Indicators
                try:
                    indicators = calculate_indicators(df)
                    df_ind = pd.DataFrame(indicators)
                except Exception:
                    df_ind = pd.DataFrame()

                # Risk
                risk_level = "Unknown"
                risk_score = 50.0
                try:
                    if not df_ind.empty:
                        rd = assess_risk(df_ind, ticker)
                        risk_level = rd.get("risk_level", "Unknown")
                        risk_score = rd.get("risk_score", 50.0)
                except Exception:
                    pass

                # Trend + Signal
                signal = "Hold"
                opp_score = 50.0
                try:
                    if not df_ind.empty:
                        ts = calculate_trend_strength(df_ind)
                        trend_label = "Bullish" if ts > 60 else "Bearish" if ts < 40 else "Neutral"
                        latest = df_ind.iloc[-1]
                        rsi_val = float(latest.get("RSI", 50))
                        macd_val = float(latest.get("MACD", 0))
                        sig_val = float(latest.get("Signal", 0))

                        # Simple signal heuristic
                        buy_signals = 0
                        sell_signals = 0
                        if ts > 60: buy_signals += 1
                        elif ts < 40: sell_signals += 1
                        if rsi_val < 30: buy_signals += 1
                        elif rsi_val > 70: sell_signals += 1
                        if macd_val > sig_val: buy_signals += 1
                        else: sell_signals += 1

                        if buy_signals >= 2: signal = "Buy"
                        elif sell_signals >= 2: signal = "Sell"
                        else: signal = "Hold"

                        opp = calculate_opportunity_score(ticker, req.period, skip_sentiment=True)
                        opp_score = opp["score"] if opp else 50.0
                except Exception:
                    pass

                # Sentiment (use cached, never block)
                sentiment_label = "Neutral"
                try:
                    sent_key = f"sentiment:{ticker}"
                    sent_payload, _ = cache_manager.get_swr(
                        key=sent_key,
                        refresh_func=lambda t=ticker: analyze_sentiment(t),
                        fresh_ttl_seconds=600.0,
                        stale_ttl_seconds=86400.0,
                        category="sentiment",
                        ticker=ticker,
                    )
                    if sent_payload:
                        sentiment_label = sent_payload.get("label", "Neutral")
                except Exception:
                    pass

                return (ticker, {
                    "ticker": ticker,
                    "name": asset_info.get("name", ticker),
                    "price": round(current_price, 2),
                    "change": round(price_change, 2),
                    "changePercent": round(price_change_pct, 2),
                    "signal": signal,
                    "risk": risk_level,
                    "sentiment": sentiment_label,
                    "score": round(opp_score, 0),
                })
            except Exception as e:
                return (ticker, None)

        tickers_to_scan = req.tickers[:10]
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(_scan_single, t): t for t in tickers_to_scan}
            for future in as_completed(futures):
                ticker, data = future.result()
                if data:
                    results[ticker] = data

        return {"stocks": results, "count": len(results)}

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=120.0,  # 2 min fresh
        stale_ttl_seconds=86400.0,
        category="discover",
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=120.0, stale_ttl_seconds=86400.0, category="discover")
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


# ─── New Multi-Asset Endpoints ──────────────────────────────────────────────

@app.get("/api/multi-asset/info/{ticker}")
def get_multi_asset_info(ticker: str):
    """Get metadata for a specific ticker (asset class, currency, etc.)"""
    return get_asset_info(ticker)

@app.get("/api/multi-asset/search")
def search_multi_assets(q: str, live: bool = True):
    """
    Search for assets by ticker or name.
    When live=true (default), includes Yahoo Finance autocomplete suggestions.
    """
    if not q:
        return []
    return search_assets(q, live=live)

@app.get("/api/multi-asset/watchlist")
def get_watchlist_defaults(category: Optional[str] = None):
    """Get default watchlist, optionally filtered by category"""
    if category:
        return get_watchlist_by_category(category)
    return {"default": get_default_watchlist(), "categories": get_watchlist_by_category()}

@app.post("/api/opportunities/scan")
def scan_opportunities(req: WatchlistScanRequest):
    """Scan a list of tickers and rank them by opportunity score using SWR cache."""
    start_t = time.perf_counter()
    if not req.tickers:
        req.tickers = get_default_watchlist()

    tickers_to_scan = req.tickers[:20]
    cache_key = f"opportunities:{req.period}:{','.join(sorted(tickers_to_scan))}"

    def _compute_scan():
        results = scan_watchlist(tickers_to_scan, req.period)
        return {"scan_results": results}

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_scan,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="opportunity_scan"
    )

    if payload is not None:
        elapsed = (time.perf_counter() - start_t) * 1000
        logger.info(f"[PERF] endpoint=/api/opportunities/scan status={meta['status']} latency={elapsed:.1f}ms")
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    # MISS
    res_payload = _compute_scan()
    cache_manager.set(
        key=cache_key,
        payload=res_payload,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="opportunity_scan"
    )
    elapsed = (time.perf_counter() - start_t) * 1000
    logger.info(f"[PERF] endpoint=/api/opportunities/scan status=MISS latency={elapsed:.1f}ms")
    meta["status"] = "MISS"
    res = dict(res_payload)
    res["_cache_meta"] = meta
    return res


@app.post("/api/volatility/summary")
def volatility_summary(req: SingleAssetRequest):
    """Get comprehensive volatility metrics for a ticker — cached via SWR."""
    cache_key = f"vol_summary:{req.ticker}:{req.period}"

    def _compute_raw():
        df = load_data(req.ticker, req.period)
        if df is None:
            return {"error": "Data not found"}
        asset_info = get_asset_info(req.ticker)
        has_volume = asset_info["has_volume"]
        return get_volatility_summary(df, has_volume, req.ticker, req.period)

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="volatility_summary",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="volatility_summary", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


def _compute_volatility_monitor_raw(tickers_to_scan, period):
    def _compute_single(ticker):
        try:
            df = load_data(ticker, period)
            if df is not None:
                asset_info = get_asset_info(ticker)
                summary = get_volatility_summary(df, asset_info["has_volume"])
                return {
                    "ticker": ticker,
                    "name": asset_info["name"],
                    "daily_volatility": summary["daily_volatility"],
                    "weekly_volatility": summary["weekly_volatility"],
                    "atr": summary["atr"]
                }
        except Exception:
            pass
        return None

    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_compute_single, t): t for t in tickers_to_scan}
        for future in as_completed(futures):
            r = future.result()
            if r:
                results.append(r)

    results.sort(key=lambda x: x["daily_volatility"], reverse=True)
    return {"volatility_monitor": results}


@app.post("/api/volatility/monitor")
def volatility_monitor(req: WatchlistScanRequest):
    """Get volatility metrics for multiple assets using SWR cache."""
    start_t = time.perf_counter()
    if not req.tickers:
        req.tickers = get_default_watchlist()

    tickers_to_scan = req.tickers[:20]
    cache_key = f"volatility_monitor:{req.period}:{','.join(sorted(tickers_to_scan))}"

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=lambda: _compute_volatility_monitor_raw(tickers_to_scan, req.period),
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="volatility_monitor"
    )

    if payload is not None:
        elapsed = (time.perf_counter() - start_t) * 1000
        logger.info(f"[PERF] endpoint=/api/volatility/monitor status={meta['status']} latency={elapsed:.1f}ms")
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    res_payload = _compute_volatility_monitor_raw(tickers_to_scan, req.period)
    cache_manager.set(
        key=cache_key,
        payload=res_payload,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="volatility_monitor"
    )
    elapsed = (time.perf_counter() - start_t) * 1000
    logger.info(f"[PERF] endpoint=/api/volatility/monitor status=MISS latency={elapsed:.1f}ms")
    meta["status"] = "MISS"
    res = dict(res_payload)
    res["_cache_meta"] = meta
    return res

@app.post("/api/risk/assess")
def risk_assessment(req: SingleAssetRequest):
    """Get comprehensive risk assessment for an asset — cached via SWR."""
    cache_key = f"risk:{req.ticker}:{req.period}"

    def _compute_raw():
        df = load_data(req.ticker, req.period)
        if df is None:
            return {"error": "Data not found"}
        df_ind_records = calculate_indicators(df)
        df_ind = pd.DataFrame(df_ind_records)
        return assess_risk(df_ind, req.ticker)

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="risk",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="risk", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res

@app.post("/api/data/trend-strength")
def trend_strength(req: SingleAssetRequest):
    """Get trend strength score for a ticker — cached via SWR."""
    cache_key = f"trend:{req.ticker}:{req.period}"

    def _compute_raw():
        df = load_data(req.ticker, req.period)
        if df is None:
            return {"error": "Data not found"}
        df_ind_records = calculate_indicators(df)
        df_ind = pd.DataFrame(df_ind_records)
        score = calculate_trend_strength(df_ind)
        label = "Bullish" if score > 60 else "Bearish" if score < 40 else "Neutral"
        return {"ticker": req.ticker, "trend_score": round(score, 1), "trend_label": label}

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="trend",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="trend", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res

@app.post("/api/data/relative-volume")
def relative_volume(req: SingleAssetRequest):
    """Get relative volume analysis — cached via SWR."""
    cache_key = f"rel_vol:{req.ticker}:{req.period}"

    def _compute_raw():
        df = load_data(req.ticker, req.period)
        if df is None:
            return {"error": "Data not found"}
        asset_info = get_asset_info(req.ticker)
        if not asset_info["has_volume"]:
            return {"available": False, "message": "Asset class does not support volume data"}
        return calculate_relative_volume(df)

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="relative_volume",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="relative_volume", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res

@app.post("/api/data/expected-range")
def expected_range(req: SingleAssetRequest):
    """Get expected daily trading range based on ATR — cached via SWR."""
    cache_key = f"exp_range:{req.ticker}:{req.period}"

    def _compute_raw():
        df = load_data(req.ticker, req.period)
        if df is None:
            return {"error": "Data not found"}
        return calculate_expected_range(df)

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_raw,
        fresh_ttl_seconds=300.0,
        stale_ttl_seconds=86400.0,
        category="expected_range",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_raw()
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="expected_range", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res

def _compute_trade_confirmation_raw(ticker: str, period: str) -> Dict[str, Any]:
    """Raw computation for trade confirmation."""
    df = load_data(ticker, period)
    if df is None or df.empty:
        return {"ticker": ticker, "error": "No data available"}

    df_ind_records = calculate_indicators(df)
    df_ind = pd.DataFrame(df_ind_records)

    trend_score = calculate_trend_strength(df_ind)
    risk_data = assess_risk(df_ind, ticker)
    asset_info = get_asset_info(ticker)
    vol_summary = get_volatility_summary(df, asset_info["has_volume"])
    latest = df_ind.iloc[-1]

    # Sentiment — use SWR-cached version, never block
    sentiment_data = {"score": 0.0, "label": "Neutral"}
    try:
        sent_cache_key = f"sentiment:{ticker}"
        sent_payload, _ = cache_manager.get_swr(
            key=sent_cache_key,
            refresh_func=lambda: analyze_sentiment(ticker),
            fresh_ttl_seconds=600.0,
            stale_ttl_seconds=86400.0,
            category="sentiment",
            ticker=ticker,
        )
        if sent_payload:
            sentiment_data = {"score": sent_payload.get("score", 0.0), "label": sent_payload.get("label", "Neutral")}
    except Exception:
        pass

    # Opportunity
    opp_data = calculate_opportunity_score(ticker, period, skip_sentiment=True)

    # --- Explainable Components ---
    components = []

    # 1. Trend (weight: 0.25)
    trend_label = "Bullish" if trend_score > 60 else "Bearish" if trend_score < 40 else "Neutral"
    trend_val = (trend_score - 50) / 50  # normalize to -1..+1
    components.append({
        "name": "Trend Strength",
        "score": round(trend_val, 3),
        "weight": 0.25,
        "contribution": round(trend_val * 0.25, 4),
        "signal": "buy" if trend_val > 0.1 else "sell" if trend_val < -0.1 else "neutral",
        "detail": f"{trend_label} ({trend_score:.1f}/100)",
        "rationale": (
            f"Price {'above' if float(latest.get('Close', 0)) > float(latest.get('SMA50', 0)) else 'below'} SMA50. "
            f"{'Golden' if float(latest.get('SMA20', 0)) > float(latest.get('SMA50', 0)) else 'Death'} cross."
        ),
    })

    # 2. RSI (weight: 0.15)
    rsi_val = float(latest.get("RSI", 50))
    if rsi_val < 30:
        rsi_signal, rsi_detail = "buy", f"Oversold at {rsi_val:.1f}"
    elif rsi_val > 70:
        rsi_signal, rsi_detail = "sell", f"Overbought at {rsi_val:.1f}"
    else:
        rsi_signal, rsi_detail = "neutral", f"Neutral at {rsi_val:.1f}"
    rsi_norm = (rsi_val - 50) / 50
    components.append({
        "name": "RSI",
        "score": round(-rsi_norm, 3),
        "weight": 0.15,
        "contribution": round({"buy": 0.15, "sell": -0.15, "neutral": 0.0}[rsi_signal] * min(abs(rsi_norm), 1.0), 4),
        "signal": rsi_signal,
        "detail": rsi_detail,
        "rationale": f"14-period RSI: {rsi_val:.1f}. {'Consider taking profits.' if rsi_val > 70 else 'Potential bounce opportunity.' if rsi_val < 30 else 'No extreme reading.'}",
    })

    # 3. MACD (weight: 0.15)
    macd_val = float(latest.get("MACD", 0))
    signal_val = float(latest.get("Signal", 0))
    macd_signal = "buy" if macd_val > signal_val else "sell"
    macd_diff = macd_val - signal_val
    macd_norm = macd_diff / (abs(macd_val) + 1e-10)
    components.append({
        "name": "MACD",
        "score": round(macd_norm, 3),
        "weight": 0.15,
        "contribution": round(macd_norm * 0.15, 4),
        "signal": macd_signal,
        "detail": f"MACD {'above' if macd_signal == 'buy' else 'below'} signal line",
        "rationale": f"MACD: {macd_val:.4f}, Signal: {signal_val:.4f}. {'Bullish momentum building.' if macd_signal == 'buy' else 'Bearish momentum building.'}",
    })

    # 4. Volatility (weight: 0.15)
    daily_vol = vol_summary.get("daily_volatility", 20)
    vol_level = "High" if daily_vol > 35 else "Low" if daily_vol < 15 else "Medium"
    vol_signal = "neutral"
    vol_detail = f"{vol_level} volatility ({daily_vol:.1f}%)"
    components.append({
        "name": "Volatility",
        "score": 0.0,
        "weight": 0.15,
        "contribution": 0.0,
        "signal": vol_signal,
        "detail": vol_detail,
        "rationale": f"Daily volatility: {daily_vol:.1f}%. {'Tight stops recommended.' if daily_vol > 35 else 'Normal position sizing appropriate.' if daily_vol > 15 else 'Low risk of large swings.'}",
    })

    # 5. Risk (weight: 0.15)
    risk_score = risk_data.get("risk_score", 50)
    risk_level = risk_data.get("risk_level", "Unknown")
    risk_norm = (risk_score - 50) / 50  # higher = riskier = negative for buy
    components.append({
        "name": "Risk Assessment",
        "score": round(-risk_norm, 3),
        "weight": 0.15,
        "contribution": round(-risk_norm * 0.15, 4),
        "signal": "sell" if risk_norm > 0.3 else "buy" if risk_norm < -0.3 else "neutral",
        "detail": f"{risk_level} risk ({risk_score:.1f}/100)",
        "rationale": risk_data.get("message", "Risk assessment complete."),
    })

    # 6. Sentiment (weight: 0.15)
    sent_score = sentiment_data.get("score", 0.0)
    sent_signal = "buy" if sent_score > 0.1 else "sell" if sent_score < -0.1 else "neutral"
    components.append({
        "name": "News Sentiment",
        "score": round(sent_score, 3),
        "weight": 0.15,
        "contribution": round(sent_score * 0.15, 4),
        "signal": sent_signal,
        "detail": f"{sentiment_data.get('label', 'Neutral')} ({sent_score:.2f})",
        "rationale": f"Sentiment score: {sent_score:.2f}. Market mood: {sentiment_data.get('label', 'Neutral')}.",
    })

    # 7. Opportunity (weight: 0.15)
    opp_score = (opp_data["score"] if opp_data else 50.0) / 100.0
    opp_norm = (opp_score - 0.5) * 2  # normalize to -1..+1
    components.append({
        "name": "Opportunity Score",
        "score": round(opp_norm, 3),
        "weight": 0.15,
        "contribution": round(opp_norm * 0.15, 4),
        "signal": "buy" if opp_norm > 0.2 else "sell" if opp_norm < -0.2 else "neutral",
        "detail": f"Score: {opp_data['score'] if opp_data else 50:.0f}/100",
        "rationale": f"Composite opportunity score: {opp_data['score'] if opp_data else 50:.0f}/100.",
    })

    # --- Aggregate ---
    total_score = sum(c["contribution"] for c in components)
    if total_score > 0.1:
        overall_signal = "Buy"
    elif total_score < -0.1:
        overall_signal = "Sell"
    else:
        overall_signal = "Hold"

    confidence = min(abs(total_score) / 0.4, 1.0)

    bullish = [c["name"] for c in components if c["signal"] == "buy"]
    bearish = [c["name"] for c in components if c["signal"] == "sell"]
    rationale_parts = []
    if bullish:
        rationale_parts.append(f"Bullish: {', '.join(bullish)}")
    if bearish:
        rationale_parts.append(f"Bearish: {', '.join(bearish)}")

    return {
        "ticker": ticker,
        "name": asset_info["name"],
        "signal": overall_signal,
        "score": round(total_score, 4),
        "confidence": round(confidence, 3),
        "components": components,
        "rationale": " | ".join(rationale_parts) if rationale_parts else "Mixed signals across indicators.",
        "opportunity_score": opp_data["score"] if opp_data else 50.0,
        "trend": {
            "score": round(trend_score, 1),
            "label": trend_label,
        },
        "technicals": {
            "rsi": round(rsi_val, 1),
            "macd_signal": "Bullish" if macd_signal == "buy" else "Bearish",
        },
        "risk": {
            "level": risk_level,
            "score": risk_score,
        },
        "volatility": {
            "level": vol_level,
            "daily": round(daily_vol, 1),
        },
        "sentiment": sentiment_data,
        "relative_volume": vol_summary.get("relative_volume", {"available": False}),
    }


@app.post("/api/data/trade-confirmation")
def trade_confirmation(req: SingleAssetRequest):
    """Explainable trade confirmation — cached via SWR."""
    cache_key = f"trade_conf:{req.ticker}:{req.period}"
    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=lambda: _compute_trade_confirmation_raw(req.ticker, req.period),
        fresh_ttl_seconds=300.0,  # 5 min fresh
        stale_ttl_seconds=86400.0,
        category="trade_confirmation",
        ticker=req.ticker,
        period=req.period,
    )
    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res
    result = _compute_trade_confirmation_raw(req.ticker, req.period)
    cache_manager.set(key=cache_key, payload=result, fresh_ttl_seconds=300.0, stale_ttl_seconds=86400.0, category="trade_confirmation", ticker=req.ticker, period=req.period)
    meta["status"] = "MISS"
    res = dict(result)
    res["_cache_meta"] = meta
    return res


# ─── Forecast Endpoint ────────────────────────────────────────────────────────

@app.post("/api/forecast/onnx")
def get_stock_forecast(request: ForecastRequest):
    """Return stock forecast using ONNX Runtime. Results cached for 15 minutes."""
    # 5. FIX FORECAST API FAILURE HANDLING
    if MODEL is None or SCALERS is None:
        return {
            "status": "error",
            "message": "Model not available on server",
            "forecast_prices": [],
            "forecast_dates": []
        }

    # Check forecast cache first
    forecast_cache_key = f"forecast_{request.ticker}_{request.forecast_days}_{request.period}"
    cached_forecast = get_cached_forecast(forecast_cache_key)
    if cached_forecast is not None:
        return cached_forecast

    with _Timer(f"forecast({request.ticker},{request.forecast_days}d)") as t_fc:
        try:
            raw_df = load_data(request.ticker, request.period)
            close_col = raw_df['Close']
            if isinstance(close_col, pd.DataFrame):
                close_col = close_col.iloc[:, 0]
            df = pd.DataFrame({"Close": close_col}).dropna()

            if df is None or len(df) < 61:
                return {
                    "status": "error",
                    "message": "Model not available on server",
                    "forecast_prices": [],
                    "forecast_dates": []
                }

            # Use the pre-fitted scaler for this ticker
            ticker = request.ticker
            if ticker in SCALERS:
                scaler = SCALERS[ticker]
            else:
                # Fallback if ticker was not in training set
                from sklearn.preprocessing import MinMaxScaler
                scaler = MinMaxScaler(feature_range=(0, 1))
                close_prices = df[["Close"]].values
                scaler.fit(close_prices)

            actual, predicted, forecast, dates = forecast_stock(
                df, MODEL, scaler, forecast_days=request.forecast_days
            )

            forecast_data = {
                "actual_prices": actual.tolist(),
                "predicted_historical_prices": predicted.tolist(),
                "forecast_prices": forecast.tolist(),
                "forecast_dates": [str(d.date()) for d in dates]
            }

            if not forecast_data["actual_prices"] or not forecast_data["forecast_prices"]:
                 return {
                     "status": "error",
                     "message": "Model not available on server",
                     "forecast_prices": [],
                     "forecast_dates": []
                 }

            response = {
                "status": "success",
                "ticker": request.ticker,
                "forecast_days": request.forecast_days,
                "results": forecast_data
            }

            # Cache the successful result
            set_cached_forecast(forecast_cache_key, response)

            return response

        except Exception as e:
            traceback.print_exc()
            return {
                "status": "error",
                "message": "Model not available on server",
                "forecast_prices": [],
                "forecast_dates": []
            }

@app.post("/api/data/sentiment")
def get_sentiment(request: SentimentRequest):
    """Return market sentiment for a stock — all fields for frontend components using SWR cache."""
    cache_key = f"sentiment:{request.ticker}"

    def _compute_sentiment_raw():
        result = analyze_sentiment(request.ticker)
        return {
            "ticker": request.ticker,
            "sentiment_score": result["score"],
            "sentiment_label": result["label"],
            "positive_count": result.get("positive_count", 0),
            "negative_count": result.get("negative_count", 0),
            "news": result["news"],
            "score": result["score"],
            "label": result["label"],
            "sentiment_trend_7d": result.get("sentiment_trend_7d", []),
            "news_impact_summary": result.get("news_impact_summary", ""),
            "market_mood": result.get("market_mood", "Unknown"),
        }

    payload, meta = cache_manager.get_swr(
        key=cache_key,
        refresh_func=_compute_sentiment_raw,
        fresh_ttl_seconds=600.0,  # 10 minutes fresh
        stale_ttl_seconds=86400.0,
        category="sentiment",
        ticker=request.ticker
    )

    if payload is not None:
        res = dict(payload)
        res["_cache_meta"] = meta
        return res

    try:
        raw_res = _compute_sentiment_raw()
        cache_manager.set(
            key=cache_key,
            payload=raw_res,
            fresh_ttl_seconds=600.0,
            stale_ttl_seconds=86400.0,
            category="sentiment",
            ticker=request.ticker
        )
        raw_res["_cache_meta"] = meta
        return raw_res
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
