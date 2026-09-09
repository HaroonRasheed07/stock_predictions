import math
import time
import threading
import traceback
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


# ─── Background Precomputation ─────────────────────────────────────────────
# Precomputed market-wide data that many endpoints share.
# Refreshed in background every 2 minutes to avoid request-time latency.
_precomputed = {
    "top_stocks": [],
    "top_stocks_ts": 0.0,
    "market_overview_cache": {},  # ticker -> (ts, result)
}
_precomputed_lock = threading.Lock()
_TOP_STOCKS_PRECOMP_TTL = 120  # 2 minutes


def _precompute_top_stocks():
    """Background: refresh top performing stocks every 2 minutes."""
    while True:
        try:
            result = get_top_performing_stocks(limit=10)
            with _precomputed_lock:
                _precomputed["top_stocks"] = result
                _precomputed["top_stocks_ts"] = time.time()
        except Exception as e:
            logger.debug(f"Precompute top stocks failed: {e}")
        time.sleep(_TOP_STOCKS_PRECOMP_TTL)


def _get_precomputed_top_stocks():
    """Get precomputed top stocks. Returns cached if fresh, else empty list."""
    with _precomputed_lock:
        ts = _precomputed.get("top_stocks_ts", 0)
        if time.time() - ts < _TOP_STOCKS_PRECOMP_TTL and _precomputed["top_stocks"]:
            return _precomputed["top_stocks"]
    return []

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

    # Start background precomputation for market-wide rankings
    threading.Thread(target=_precompute_top_stocks, daemon=True).start()
    print("Background precomputation started.")

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

@app.post("/api/data/indicators")
def get_stock_data_and_indicators(req: IndicatorRequest):
    """
    Return stock indicators, overview data, current price, and top performers.
    Frontend expects: ticker, data, topStocks, currentPrice, change, changePercent
    """
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found for ticker")

    indicators = calculate_indicators(df)

    # Get current price from live data or last close
    current_price = 0.0
    price_change = 0.0
    price_change_pct = 0.0
    try:
        live = get_latest_price(req.ticker)
        if live is not None and live > 0:
            current_price = live
            # Calculate change from previous close using history
            if len(df) >= 2:
                prev_close = float(df["Close"].iloc[-2]) if not isinstance(df["Close"].iloc[-2], pd.DataFrame) else float(df["Close"].iloc[-2].iloc[0])
                if prev_close > 0:
                    price_change = current_price - prev_close
                    price_change_pct = (price_change / prev_close) * 100
        elif len(df) > 0:
            # Fallback: use last close from history
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

    # Get top performing stocks (cached, fast)
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


@app.post("/api/market/overview")
def get_market_overview(req: IndicatorRequest):
    """
    COMBINED endpoint: returns ALL data needed for the market overview page
    in a single API call. Independent operations run in parallel for speed.
    Includes timing instrumentation and in-memory TTL caching for performance.
    """
    ticker = req.ticker
    period = req.period
    cache_key = f"overview_{ticker}_{period}"
    
    cached = _get_cached_endpoint(cache_key, ttl_seconds=60.0)
    if cached is not None:
        return cached

    result = {"ticker": ticker}

    with _Timer(f"market_overview({ticker},{period})") as total:
        # 1. Load data first (everything else depends on this)
        with _Timer("load_data") as t_load:
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

        # 2. Compute indicators ONCE (shared by multiple sub-calculations)
        with _Timer("calculate_indicators") as t_ind:
            try:
                indicators = calculate_indicators(df)
                result["data"] = indicators
                df_ind = pd.DataFrame(indicators)
            except Exception:
                indicators = []
                df_ind = pd.DataFrame()

        # 3. Current price
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

        # 4. Run independent operations IN PARALLEL
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

        # Run all independent computations in parallel
        with _Timer("parallel_computations") as t_parallel:
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

        # 5. Trade confirmation (depends on volatility + risk + trend + sentiment)
        with _Timer("trade_confirmation") as t_tc:
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

        # 6. Watchlist defaults
        try:
            result["watchlist"] = get_default_watchlist()
        except Exception:
            result["watchlist"] = []

        # 7. Market status
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

    _set_cached_endpoint(cache_key, result)
    return result


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
    """Scan a list of tickers and rank them by opportunity score"""
    if not req.tickers:
        req.tickers = get_default_watchlist()

    tickers_to_scan = req.tickers[:20]
    cache_key = f"opp_scan_{','.join(sorted(tickers_to_scan))}_{req.period}"
    cached = _get_cached_endpoint(cache_key, ttl_seconds=60.0)
    if cached is not None:
        return cached

    results = scan_watchlist(tickers_to_scan, req.period)
    res_payload = {"scan_results": results}
    _set_cached_endpoint(cache_key, res_payload)
    return res_payload

@app.post("/api/volatility/summary")
def volatility_summary(req: SingleAssetRequest):
    """Get comprehensive volatility metrics for a ticker"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    asset_info = get_asset_info(req.ticker)
    has_volume = asset_info["has_volume"]

    return get_volatility_summary(df, has_volume, req.ticker, req.period)

@app.post("/api/volatility/monitor")
def volatility_monitor(req: WatchlistScanRequest):
    """Get volatility metrics for multiple assets for the monitor table"""
    if not req.tickers:
        req.tickers = get_default_watchlist()

    tickers_to_scan = req.tickers[:20]
    cache_key = f"vol_mon_{','.join(sorted(tickers_to_scan))}_{req.period}"
    cached = _get_cached_endpoint(cache_key, ttl_seconds=60.0)
    if cached is not None:
        return cached

    def _compute_single(ticker):
        try:
            df = load_data(ticker, req.period)
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

    # Run all tickers in parallel
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_compute_single, t): t for t in tickers_to_scan}
        for future in as_completed(futures):
            r = future.result()
            if r:
                results.append(r)

    # Sort by daily volatility descending
    results.sort(key=lambda x: x["daily_volatility"], reverse=True)
    res_payload = {"volatility_monitor": results}
    _set_cached_endpoint(cache_key, res_payload)
    return res_payload

@app.post("/api/risk/assess")
def risk_assessment(req: SingleAssetRequest):
    """Get comprehensive risk assessment for an asset"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    # We need indicators for trend strength
    df_ind_records = calculate_indicators(df)
    df_ind = pd.DataFrame(df_ind_records)

    return assess_risk(df_ind, req.ticker)

@app.post("/api/data/trend-strength")
def trend_strength(req: SingleAssetRequest):
    """Get trend strength score for a ticker"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    df_ind_records = calculate_indicators(df)
    df_ind = pd.DataFrame(df_ind_records)

    score = calculate_trend_strength(df_ind)
    label = "Bullish" if score > 60 else "Bearish" if score < 40 else "Neutral"

    return {
        "ticker": req.ticker,
        "trend_score": round(score, 1),
        "trend_label": label
    }

@app.post("/api/data/relative-volume")
def relative_volume(req: SingleAssetRequest):
    """Get relative volume analysis"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    asset_info = get_asset_info(req.ticker)
    if not asset_info["has_volume"]:
        return {
            "available": False,
            "message": "Asset class does not support volume data"
        }

    return calculate_relative_volume(df)

@app.post("/api/data/expected-range")
def expected_range(req: SingleAssetRequest):
    """Get expected daily trading range based on ATR"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    return calculate_expected_range(df)

@app.post("/api/data/trade-confirmation")
def trade_confirmation(req: SingleAssetRequest):
    """Get a consolidated trade confirmation summary"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    # Gather all necessary data
    df_ind_records = calculate_indicators(df)
    df_ind = pd.DataFrame(df_ind_records)

    trend_score = calculate_trend_strength(df_ind)
    risk_data = assess_risk(df_ind, req.ticker)

    asset_info = get_asset_info(req.ticker)
    vol_summary = get_volatility_summary(df, asset_info["has_volume"])

    # Get latest technicals
    latest = df_ind.iloc[-1]

    # Try quick sentiment
    sentiment_data = None
    try:
        sent_res = analyze_sentiment(req.ticker)
        sentiment_data = {"score": sent_res["score"], "label": sent_res["label"]}
    except Exception:
        sentiment_data = {"score": 0.0, "label": "Neutral"}

    # Opportunity score runs it all together nicely
    opp_data = calculate_opportunity_score(req.ticker, req.period)

    return {
        "ticker": req.ticker,
        "name": asset_info["name"],
        "opportunity_score": opp_data["score"] if opp_data else 50.0,
        "trend": {
            "score": round(trend_score, 1),
            "label": "Bullish" if trend_score > 60 else "Bearish" if trend_score < 40 else "Neutral"
        },
        "technicals": {
            "rsi": round(latest["RSI"], 1),
            "macd_signal": "Bullish" if latest["MACD"] > latest["Signal"] else "Bearish"
        },
        "risk": {
            "level": risk_data["risk_level"],
            "score": risk_data["risk_score"]
        },
        "volatility": {
            "level": "High" if vol_summary["daily_volatility"] > 35 else "Low" if vol_summary["daily_volatility"] < 15 else "Medium",
            "daily": round(vol_summary["daily_volatility"], 1)
        },
        "sentiment": sentiment_data,
        "relative_volume": vol_summary["relative_volume"] if asset_info["has_volume"] else {"available": False}
    }


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
    """Return market sentiment for a stock — all fields for frontend components."""
    try:
        result = analyze_sentiment(request.ticker)
        return {
            "ticker": request.ticker,
            # Fields used by sentiment page & chart
            "sentiment_score": result["score"],
            "sentiment_label": result["label"],
            "positive_count": result.get("positive_count", 0),
            "negative_count": result.get("negative_count", 0),
            "news": result["news"],
            # Fields used by SentimentTrend component (expects 'score', not 'sentiment_score')
            "score": result["score"],
            "label": result["label"],
            "sentiment_trend_7d": result.get("sentiment_trend_7d", []),
            "news_impact_summary": result.get("news_impact_summary", ""),
            "market_mood": result.get("market_mood", "Unknown"),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
