# # api.py
# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# import pandas as pd
# import numpy as np

# # Import your core logic
# from utils import load_data
# from indicators import calculate_indicators
# from forecast import load_forecast_model, forecast_stock, SimpleAttention

# # --- 1. GLOBAL MODEL LOADING (Runs ONLY ONCE at startup) ---
# # This is the most crucial step for performance!
# try:
#     GLOBAL_MODEL, GLOBAL_SCALERS = load_forecast_model()
#     print("✅ Successfully loaded LSTM Attention Model and Scalers.")
# except FileNotFoundError as e:
#     print(f" CRITICAL ERROR: {e}")
#     # In a real app, you might stop here or set a flag to disable forecast endpoint
#     GLOBAL_MODEL = None
#     GLOBAL_SCALERS = None
# except Exception as e:
#     print(f" CRITICAL ERROR during model loading: {e}")
#     GLOBAL_MODEL = None
#     GLOBAL_SCALERS = None


# # --- 2. INSTANTIATE APP & CONFIGURATION ---
# app = FastAPI(title="Stock Market Predictor API")

# # Define allowed origins for CORS (Next.js runs on 3000)
# origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# # --- 3. INPUT SCHEMAS ---
# class TickerRequest(BaseModel):
#     ticker: str
#     period: str = "1y" # Default period for loading data

# class ForecastRequest(BaseModel):
#     ticker: str
#     forecast_days: int = 7
#     period: str = "1y" # Period of historical data to pull


# # --- 4. ENDPOINTS ---

# @app.post("/indicators")
# async def get_stock_data_and_indicators(request: TickerRequest):
#     """Loads historical data and calculates technical indicators."""
#     try:
#         # 1. Load data
#         df = load_data(request.ticker, request.period)
        
#         # 2. Calculate indicators
#         df_indicators = calculate_indicators(df)
        
#         # The function already converts the DataFrame to a list of dicts (JSON)
#         return {
#             "ticker": request.ticker,
#             "data": df_indicators
#         }
#     except (ValueError, RuntimeError) as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Server error: {e}")


# @app.post("/api/data/forecast")
# async def get_stock_forecast(request: ForecastRequest):
#     """Generates a stock price forecast using the LSTM Attention model."""
#     if GLOBAL_MODEL is None or GLOBAL_SCALERS is None:
#         raise HTTPException(status_code=503, detail="Forecasting service is temporarily unavailable (Model not loaded).")
    
#     try:
#         # 1. Load historical data
#         df = load_data(request.ticker, request.period)[["Close"]].dropna()

#         # 2. Check if a scaler exists for the ticker (a limitation to address later)
#         if request.ticker not in GLOBAL_SCALERS:
#              # Default to a generic scaler if not found, but this is a model limitation
#              # For now, we'll raise an error if the specific scaler is missing
#              raise ValueError(f"Scaler for ticker '{request.ticker}' not found in model set.")
        
#         # 3. Generate forecast
#         scaler = GLOBAL_SCALERS[request.ticker] # Assuming scalers are stored by ticker
        
#         actual, predicted, forecast, dates = forecast_stock(
#             df, GLOBAL_MODEL, scaler, forecast_days=request.forecast_days
#         )

#         # 4. Format output as JSON (dates need to be converted to strings)
#         forecast_data = {
#             "actual_prices": actual.tolist(),
#             "predicted_historical_prices": predicted.tolist(),
#             "forecast_prices": forecast.tolist(),
#             "forecast_dates": [str(d.date()) for d in dates]
#         }
        
#         return {
#             "ticker": request.ticker,
#             "forecast_days": request.forecast_days,
#             "results": forecast_data
#         }

#     except (ValueError, RuntimeError) as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Server error: {e}")


# # --- 5. RUN SERVER (Execute from command line) ---
# # Command: uvicorn api:app --reload --port 8000

# api.py

from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {
        "status": "running",
        "message": "Stock Prediction API is live 🚀"
    }
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import traceback

# Import your core logic (all files in same folder)
from utils import load_data, get_latest_price, get_top_performing_stocks
from indicators import calculate_indicators
from forecast import load_forecast_model, forecast_stock
from sentiment import analyze_sentiment

import threading

import math

import time

_LAST_GOOD_FORECAST = {}

def _forecast_cache_key(ticker: str, period: str, forecast_days: int) -> str:
    return f"{ticker.upper()}|{period}|{int(forecast_days)}"

def safe_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default

# Global variables for model
GLOBAL_MODEL = None
GLOBAL_SCALERS = None
MODEL_LOADING = False

def _load_stock_model():
    """Lazy loader for stock model to save RAM."""
    global GLOBAL_MODEL, GLOBAL_SCALERS, MODEL_LOADING
    if GLOBAL_MODEL is not None:
        return True
    if MODEL_LOADING:
        return False
    
    print("⏳ Loading Stock forecast model (requested)...")
    MODEL_LOADING = True
    try:
        GLOBAL_MODEL, GLOBAL_SCALERS = load_forecast_model()
        print("✅ Stock model loaded successfully.")
        return True
    except Exception as e:
        print(f"🛑 Stock model load failed: {e}")
        return False
    finally:
        MODEL_LOADING = False

# Remove global background loading to save RAM
# loading_thread = threading.Thread(target=load_model_background, daemon=True)
# loading_thread.start()

# --- 2. FASTAPI APP & CORS ---
app = FastAPI(title="Stock Market API")

# CORS middleware MUST be added first, before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. SCHEMAS ---
class TickerRequest(BaseModel):
    ticker: str
    period: str = "1y"

class ForecastRequest(BaseModel):
    ticker: str
    forecast_days: int = 7
    period: str = "1y"

class SentimentRequest(BaseModel):
    ticker: str

# --- 4. ENDPOINTS ---

# OPTIONS handlers for CORS preflight requests
@app.options("/api/data/indicators")
async def options_indicators():
    return {}

@app.options("/api/data/forecast")
async def options_forecast():
    return {}

@app.options("/api/data/sentiment")
async def options_sentiment():
    return {}

@app.post("/api/data/indicators")
def get_stock_data_and_indicators(request: TickerRequest):
    """Return stock indicators and overview data"""
    try:
        df = load_data(request.ticker, request.period)
        df_indicators = calculate_indicators(df)

        # Safety: ensure Close/Volume are Series (not MultiIndex DataFrames)
        close_vals = df['Close']
        if isinstance(close_vals, pd.DataFrame):
            close_vals = close_vals.iloc[:, 0]
        volume_vals = df['Volume']
        if isinstance(volume_vals, pd.DataFrame):
            volume_vals = volume_vals.iloc[:, 0]

        # Example calculations for dashboard
        total_market_cap = round(close_vals.sum() * 1_000_000, 2)
        trading_volume = int(volume_vals.sum())
        # Fix: 'active_stocks' logic was flawed checking unique prices. 
        # Since we load one ticker, it is 1.
        active_stocks = 1

        # Top stocks (using new helper)
        top_stocks_list = get_top_performing_stocks()
        if not top_stocks_list:
             # Fallback to current ticker if fetch fails
             current_price = get_latest_price(request.ticker) or float(close_vals.iloc[-1])
             previous_close = float(close_vals.iloc[-2]) if len(close_vals) > 1 else current_price
             
             top_stocks_list = [{
                "symbol": request.ticker,
                "name": request.ticker,
                "price": current_price,
                "change": current_price - previous_close,
                "changePercent": ((current_price - previous_close) / previous_close * 100) if previous_close != 0 else 0
            }]

        
        # Current ticker info
        current_price = get_latest_price(request.ticker) or float(close_vals.iloc[-1])
        previous_close = float(close_vals.iloc[-2]) if len(close_vals) > 1 else current_price
        change_val = current_price - previous_close
        change_pct = ((change_val) / previous_close * 100) if previous_close != 0 else 0

        return {
            "status": "success",
            "ticker": request.ticker,
            "data": df_indicators, # Already converted to dict list in indicators.py
            "totalMarketCap": safe_float(total_market_cap),
            "tradingVolume": int(trading_volume),
            "activeStocks": active_stocks,
            "topStocks": top_stocks_list,
            "currentPrice": safe_float(current_price),
            "change": safe_float(change_val),
            "changePercent": safe_float(change_pct)
        }

    except ValueError as e:
        # User-facing errors (invalid ticker, no data, etc.)
        msg = str(e)
        if "No data found" in msg or "No historical data" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found. Please check the symbol and try again.")
        raise HTTPException(status_code=400, detail=msg)
    except RuntimeError as e:
        msg = str(e)
        if "No data found" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found. Please check the symbol and try again.")
        raise HTTPException(status_code=500, detail=msg)
    except Exception as e:
        print(f"❌ Indicators Error for {request.ticker}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

@app.post("/api/data/forecast")
def get_stock_forecast(request: ForecastRequest):
    """Return stock forecast using LSTM Attention"""
    if not _load_stock_model():
         if MODEL_LOADING:
              raise HTTPException(status_code=503, detail="Model is still loading. Please wait.")
         raise HTTPException(status_code=503, detail="Forecast model not available.")

    try:
        raw_df = load_data(request.ticker, request.period)
        # Ensure 'Close' is a Series, not a single-column DataFrame
        close_col = raw_df['Close']
        if isinstance(close_col, pd.DataFrame):
            close_col = close_col.iloc[:, 0]
        df = pd.DataFrame({"Close": close_col}).dropna()
        if df is None or len(df) == 0:
            raise ValueError("No historical data returned for this ticker/timeframe.")
        if len(df) < 61:
            raise ValueError("Not enough data to generate forecast (need at least 61 rows).")
        
        # For ANY stock, create a MinMaxScaler from its own data
        # This normalizes the stock's prices to [0,1] range just like training data was normalized
        from sklearn.preprocessing import MinMaxScaler
        scaler = MinMaxScaler(feature_range=(0, 1))
        close_prices = df[["Close"]].values
        scaler.fit(close_prices)  # Fit scaler to THIS stock's data range

        actual, predicted, forecast, dates = forecast_stock(
            df, GLOBAL_MODEL, scaler, forecast_days=request.forecast_days
        )

        forecast_data = {
            "actual_prices": actual.tolist(),
            "predicted_historical_prices": predicted.tolist(),
            "forecast_prices": forecast.tolist(),
            "forecast_dates": [str(d.date()) for d in dates]
        }

        # Validate payload (avoid UI showing $0.00 with empty arrays)
        if not forecast_data["actual_prices"] or not forecast_data["predicted_historical_prices"]:
            raise RuntimeError("Forecast produced empty historical series.")
        if not forecast_data["forecast_prices"] or not forecast_data["forecast_dates"]:
            raise RuntimeError("Forecast produced empty forward series.")

        # Store last known good forecast (per ticker/period/days)
        cache_key = _forecast_cache_key(request.ticker, request.period, request.forecast_days)
        _LAST_GOOD_FORECAST[cache_key] = {
            "status": "success",
            "ticker": request.ticker,
            "forecast_days": request.forecast_days,
            "results": forecast_data,
            "_meta": {"cached_at": time.time(), "stale": False},
        }

        return {
            "status": "success",
            "ticker": request.ticker,
            "forecast_days": request.forecast_days,
            "results": forecast_data
        }

    except ValueError as e:
        # User-facing errors (invalid ticker, no data, not enough data)
        msg = str(e)
        if "No data found" in msg or "No historical data" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found. Please check the symbol and try again.")
        if "Not enough data" in msg:
            raise HTTPException(status_code=400, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except RuntimeError as e:
        msg = str(e)
        if "No data found" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found. Please check the symbol and try again.")
        raise HTTPException(status_code=500, detail=msg)
    except Exception as e:
        print(f"❌ Forecast Error for {request.ticker}: {e}")
        traceback.print_exc()
        # Fallback to last-known-good forecast to avoid blank UI during transient failures
        cache_key = _forecast_cache_key(request.ticker, request.period, request.forecast_days)
        cached = _LAST_GOOD_FORECAST.get(cache_key)
        if cached:
            cached_copy = dict(cached)
            meta = dict(cached_copy.get("_meta") or {})
            meta["stale"] = True
            meta["error"] = str(e)
            cached_copy["_meta"] = meta
            return cached_copy

        raise HTTPException(status_code=500, detail=str(e))

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
        print(f"❌ Sentiment Error for {request.ticker}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
