from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
from datetime import datetime, timedelta

app = FastAPI()

# CORS middleware MUST be added first, before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TickerRequest(BaseModel):
    ticker: str
    period: str = "1y"

class ForecastRequest(BaseModel):
    ticker: str
    forecast_days: int = 7
    period: str = "1y"

class SentimentRequest(BaseModel):
    ticker: str

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
async def get_indicators(request: TickerRequest):
    # Mock data generation
    data = []
    base_price = 150.0
    for i in range(30):
        base_price += random.uniform(-2, 2)
        data.append({
            "Date": (datetime.now() - timedelta(days=30-i)).strftime("%Y-%m-%d"),
            "Open": base_price,
            "High": base_price + 2,
            "Low": base_price - 2,
            "Close": base_price + random.uniform(-1, 1),
            "Volume": int(random.uniform(500000, 1000000)),
            "RSI": random.uniform(30, 70),
            "MACD": random.uniform(-1, 1),
            "Signal_Line": random.uniform(-1, 1),
            "SMA_20": base_price - 1,
            "EMA_20": base_price + 0.5
        })
    
    return {
        "ticker": request.ticker,
        "data": data,
        "totalMarketCap": 2500000000000.0,
        "tradingVolume": 50000000,
        "activeStocks": 1,
        "topStocks": [{
            "symbol": request.ticker,
            "name": request.ticker,
            "price": base_price,
            "change": 1.5,
            "changePercent": 1.2
        }]
    }

@app.post("/api/data/forecast")
async def get_forecast(request: ForecastRequest):
    actual = [150 + i + random.uniform(-2, 2) for i in range(30)]
    forecast = [actual[-1] + i + random.uniform(-1, 1) for i in range(7)]
    dates = [(datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    
    return {
        "ticker": request.ticker,
        "forecast_days": 7,
        "results": {
            "actual_prices": actual,
            "predicted_historical_prices": actual, # Mock same as actual
            "forecast_prices": forecast,
            "forecast_dates": dates
        }
    }

@app.post("/api/data/sentiment")
async def get_sentiment(request: SentimentRequest):
    return {
        "ticker": request.ticker,
        "sentiment_score": 0.75,
        "sentiment_label": "Bullish",
        "news": [
            {
                "title": f"Positive outlook for {request.ticker}",
                "source": "MarketNews",
                "url": "#",
                "published_at": datetime.now().isoformat()
            }
        ]
    }
