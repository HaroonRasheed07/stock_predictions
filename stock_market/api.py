import math
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import pandas as pd

# Import core logic
from utils import load_data, get_latest_price, get_top_performing_stocks
from indicators import calculate_indicators
from sentiment import analyze_sentiment
from forecast_onnx import load_forecast_model, forecast_stock

# ⚠️ 2. MODEL + SCALER GLOBAL SINGLETON LOADING
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

app = FastAPI(title="Stock Market API")

# ⚠️ 2. LOAD ONCE AT STARTUP
@app.on_event("startup")
def load_models_at_startup():
    global MODEL, SCALERS
    print("⏳ Loading ONNX Stock forecast model at startup...")
    try:
        MODEL, SCALERS = load_forecast_model()
        print("✅ ONNX Stock model loaded successfully.")
    except Exception as e:
        print(f"🛑 ONNX Stock model load failed: {e}")
        MODEL = None
        SCALERS = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ⚠️ 6. LIMIT YFINANCE DATA SIZE
class TickerRequest(BaseModel):
    ticker: str
    period: str = "1y"

    @field_validator('period')
    @classmethod
    def validate_period(cls, v):
        allowed_periods = ["1mo", "3mo", "6mo", "1y", "2y", "ytd"]
        if v not in allowed_periods:
            if v in ["5y", "10y", "max"]:
                return "2y"  # Force cap to 2y
            return "1y"
        return v

class ForecastRequest(BaseModel):
    ticker: str
    forecast_days: int = 7
    period: str = "1y"

    @field_validator('period')
    @classmethod
    def validate_period(cls, v):
        allowed_periods = ["1mo", "3mo", "6mo", "1y", "2y", "ytd"]
        if v not in allowed_periods:
            if v in ["5y", "10y", "max"]:
                return "2y"  # Force cap to 2y
            return "1y"
        return v

class SentimentRequest(BaseModel):
    ticker: str

# ⚠️ 9. ADD STARTUP HEALTH GUARANTEE
@app.get("/")
def home():
    return {"status": "running", "service": "stock-api"}

@app.get("/healthz")
def health_check():
    return {"status": "healthy"}

@app.options("/api/data/indicators")
async def options_indicators(): return {}

@app.options("/api/data/forecast")
async def options_forecast(): return {}

@app.options("/api/data/sentiment")
async def options_sentiment(): return {}

@app.post("/api/data/indicators")
def get_stock_data_and_indicators(request: TickerRequest):
    """Return stock indicators and overview data"""
    try:
        df = load_data(request.ticker, request.period)
        df_indicators = calculate_indicators(df)

        close_vals = df['Close']
        if isinstance(close_vals, pd.DataFrame):
            close_vals = close_vals.iloc[:, 0]
        volume_vals = df['Volume']
        if isinstance(volume_vals, pd.DataFrame):
            volume_vals = volume_vals.iloc[:, 0]

        total_market_cap = round(close_vals.sum() * 1_000_000, 2)
        trading_volume = int(volume_vals.sum())
        active_stocks = 1

        top_stocks_list = get_top_performing_stocks()
        if not top_stocks_list:
             current_price = get_latest_price(request.ticker) or float(close_vals.iloc[-1])
             previous_close = float(close_vals.iloc[-2]) if len(close_vals) > 1 else current_price
             top_stocks_list = [{
                "symbol": request.ticker,
                "name": request.ticker,
                "price": current_price,
                "change": current_price - previous_close,
                "changePercent": ((current_price - previous_close) / previous_close * 100) if previous_close != 0 else 0
            }]
        
        current_price = get_latest_price(request.ticker) or float(close_vals.iloc[-1])
        previous_close = float(close_vals.iloc[-2]) if len(close_vals) > 1 else current_price
        change_val = current_price - previous_close
        change_pct = ((change_val) / previous_close * 100) if previous_close != 0 else 0

        return {
            "status": "success",
            "ticker": request.ticker,
            "data": df_indicators,
            "totalMarketCap": safe_float(total_market_cap),
            "tradingVolume": int(trading_volume),
            "activeStocks": active_stocks,
            "topStocks": top_stocks_list,
            "currentPrice": safe_float(current_price),
            "change": safe_float(change_val),
            "changePercent": safe_float(change_pct)
        }

    except ValueError as e:
        msg = str(e)
        if "No data found" in msg or "No historical data" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found.")
        raise HTTPException(status_code=400, detail=msg)
    except RuntimeError as e:
        msg = str(e)
        if "No data found" in msg:
            raise HTTPException(status_code=404, detail=f"Ticker '{request.ticker}' not found.")
        raise HTTPException(status_code=500, detail=msg)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

@app.post("/api/data/forecast")
def get_stock_forecast(request: ForecastRequest):
    """Return stock forecast using ONNX Runtime"""
    # ⚠️ 5. FIX FORECAST API FAILURE HANDLING
    if MODEL is None or SCALERS is None:
        return {
            "detail": "Forecast model not found. ONNX model missing on server."
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
                "message": "forecast model unavailable",
                "data": []
            }
        
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
                 "message": "forecast model unavailable",
                 "data": []
             }

        return {
            "status": "success",
            "ticker": request.ticker,
            "forecast_days": request.forecast_days,
            "results": forecast_data
        }

    except Exception as e:
        traceback.print_exc()
        # ⚠️ 5. FIX FORECAST API FAILURE HANDLING (no hard crash)
        return {
            "detail": "Forecast model not found. ONNX model missing on server."
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
