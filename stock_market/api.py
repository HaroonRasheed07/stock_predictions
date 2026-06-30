import math
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import pandas as pd

# Import core logic
from utils import get_top_performing_stocks, load_data, STOCK_NAMES
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
    """Return stock indicators and overview data"""
    df = load_data(req.ticker, req.period)
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found for ticker")
    
    indicators = calculate_indicators(df)
    return {"ticker": req.ticker, "data": indicators}

# ─── New Multi-Asset Endpoints ──────────────────────────────────────────────

@app.get("/api/multi-asset/info/{ticker}")
def get_multi_asset_info(ticker: str):
    """Get metadata for a specific ticker (asset class, currency, etc.)"""
    return get_asset_info(ticker)

@app.get("/api/multi-asset/search")
def search_multi_assets(q: str):
    """Search for assets by ticker or name"""
    if not q:
        return []
    return search_assets(q)

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
    
    # Optional: limit to 20 to avoid timeouts on free tier
    tickers_to_scan = req.tickers[:20]
    results = scan_watchlist(tickers_to_scan, req.period)
    return {"scan_results": results}

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
        
    results = []
    for ticker in req.tickers[:20]:
        df = load_data(ticker, req.period)
        if df is not None:
            asset_info = get_asset_info(ticker)
            summary = get_volatility_summary(df, asset_info["has_volume"])
            results.append({
                "ticker": ticker,
                "name": asset_info["name"],
                "daily_volatility": summary["daily_volatility"],
                "weekly_volatility": summary["weekly_volatility"],
                "atr": summary["atr"]
            })
            
    # Sort by daily volatility descending
    results.sort(key=lambda x: x["daily_volatility"], reverse=True)
    return {"volatility_monitor": results}

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
    except:
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
    """Return stock forecast using ONNX Runtime"""
    # 5. FIX FORECAST API FAILURE HANDLING
    if MODEL is None or SCALERS is None:
        return {
            "status": "error",
            "message": "Model not available on server",
            "forecast_prices": [],
            "forecast_dates": []
        }

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

        return {
            "status": "success",
            "ticker": request.ticker,
            "forecast_days": request.forecast_days,
            "results": forecast_data
        }

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
    """Return market sentiment for a stock"""
    try:
        result = analyze_sentiment(request.ticker)
        return {
            "ticker": request.ticker,
            "sentiment_score": result["score"],
            "sentiment_label": result["label"],
            "positive_count": result.get("positive_count", 0),
            "negative_count": result.get("negative_count", 0),
            "news": result["news"]
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
