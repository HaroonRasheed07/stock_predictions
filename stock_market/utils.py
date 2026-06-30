# import yfinance as yf
# import streamlit as st

# def load_data(ticker, period):
#     try:
#         df = yf.download(ticker, period=period)
#         if df.empty:
#             st.error("No data found.")
#             return None
#         return df
#     except Exception as e:
#         st.error(f"Data load error: {e}")
#         return None


# import yfinance as yf
# import streamlit as st

# @st.cache_data
# def load_data(ticker, period):
#     try:
#         data = yf.download(ticker, period=period, progress=False)
#         if data.empty:
#             st.error("No data found for this stock symbol.")
#             return None
#         return data
#     except Exception as e:
#         st.error(f"Error loading data: {str(e)}")
#         return None


# utils.py (Cleaned for API use)
import yfinance as yf
import pandas as pd
import time
# Removed: import streamlit as st

# --- Simple in-memory cache ---
_data_cache: dict = {}  # key -> (timestamp, dataframe)
_DATA_CACHE_TTL = 120  # seconds (2 minutes)

# --- Separate cache for scan operations (10-minute TTL) ---
_scan_cache: dict = {}  # key -> (timestamp, result)
_SCAN_CACHE_TTL = 600  # seconds (10 minutes)

def _get_cached_df(key: str):
    if key in _data_cache:
        ts, df = _data_cache[key]
        if time.time() - ts < _DATA_CACHE_TTL:
            return df
    return None

def _set_cached_df(key: str, df):
    _data_cache[key] = (time.time(), df)

def _get_cached_scan(key: str):
    if key in _scan_cache:
        ts, result = _scan_cache[key]
        if time.time() - ts < _SCAN_CACHE_TTL:
            return result
    return None

def _set_cached_scan(key: str, result):
    _scan_cache[key] = (time.time(), result)

def load_data(ticker, period="1y", interval=None): 
    try:
        # Auto-determine interval if not specified
        if interval is None:
            if period == "1d":
                interval = "5m"
            elif period == "5d":
                interval = "15m"
            elif period == "1mo":
                interval = "90m" # Or 1d, but 90m gives more detail for 1 month
            elif period in ["6mo", "1y", "2y", "5y", "10y", "ytd", "max"]:
                interval = "1d"
            else:
                interval = "1d"
                
        # Check cache first
        cache_key = f"{ticker}|{period}|{interval}"
        cached = _get_cached_df(cache_key)
        if cached is not None:
            return cached
        
        # Removed: progress=False and st.error/st.cache_data
        data = yf.download(ticker, period=period, interval=interval)
        
        # Flatten MultiIndex columns if present (Fix for new yfinance behavior)
        if hasattr(data.columns, 'nlevels') and data.columns.nlevels > 1:
            data.columns = data.columns.droplevel(1)
        # Extra safety: if still MultiIndex, flatten tuple column names
        if hasattr(data.columns, 'nlevels') and data.columns.nlevels > 1:
            data.columns = [col[0] if isinstance(col, tuple) else col for col in data.columns]
        # Handle missing volume data (common for forex and indices)
        if 'Volume' not in data.columns:
            data['Volume'] = 0.0
        else:
            # Check for all NaNs and fill
            if data['Volume'].isna().all():
                data['Volume'] = 0.0
            else:
                data['Volume'] = data['Volume'].fillna(0)
                
        # Squeeze: ensure OHLCV columns are Series, not single-column DataFrames
        for col in ['Close', 'High', 'Low', 'Open', 'Volume']:
            if col in data.columns:
                val = data[col]
                if isinstance(val, pd.DataFrame):
                    data[col] = val.iloc[:, 0]
            
        if data.empty:
            # Instead of a Streamlit error, raise a Python exception
            raise ValueError(f"No data found for the ticker: {ticker}")
        
        # Store in cache
        _set_cached_df(cache_key, data)
        return data
    except Exception as e:
        # Re-raise the exception to be caught by FastAPI
        raise RuntimeError(f"Error loading data for {ticker}: {str(e)}")

# NOTE: The load_data function is now robust and API-friendly.

def get_latest_price(ticker):
    """
    Fetches the latest available price for a ticker.
    Uses yfinance fast_info for better performance and 'live' accuracy.
    """
    try:
        stock = yf.Ticker(ticker)
        # fast_info provides 'last_price' which is often more current than history
        price = stock.fast_info.get('last_price')
        if price is None:
             # Fallback to info (slower)
             price = stock.info.get('currentPrice')
        
        if price is None:
            # Fallback to last close of history
            df = stock.history(period='1d')
            if not df.empty:
                price = df['Close'].iloc[-1]
                
        return price
    except Exception:
        return None

# --- NEW: Top Performers Helper ---
STOCK_NAMES = {
    'NVDA': 'NVIDIA Corp',
    'TSLA': 'Tesla Inc',
    'AAPL': 'Apple Inc',
    'MSFT': 'Microsoft Corp',
    'AMZN': 'Amazon.com',
    'GOOGL': 'Alphabet Inc',
    'META': 'Meta Platforms',
    'AMD': 'Adv. Micro Devices',
    'NFLX': 'Netflix Inc',
    'INTC': 'Intel Corp',
    'SPY': 'S&P 500 ETF',
    'QQQ': 'Invesco QQQ',
    'JPM': 'JPMorgan Chase',
    'V': 'Visa Inc',
    'WMT': 'Walmart Inc',
    'PG': 'Procter & Gamble',
    'XOM': 'Exxon Mobil',
    'JNJ': 'Johnson & Johnson',
    'HD': 'Home Depot',
    'BAC': 'Bank of America',
    # Multi-asset defaults
    'GC=F': 'Gold Futures',
    'SI=F': 'Silver Futures',
    'CL=F': 'Crude Oil',
    'EURUSD=X': 'EUR/USD',
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones'
}
TOP_WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'GC=F', 'EURUSD=X', '^GSPC']

def get_top_performing_stocks(limit=6):
    """
    Fetches a watchlist of popular stocks and returns the top performers
    based on the last day's change.
    Results are cached for 5 minutes.
    """
    try:
        # Check cache
        cached = _get_cached_df("__top_performers__")
        if cached is not None:
            return cached[:limit]
            
        # Download data for all watchlist stocks (last 5 days to be safe)
        df = yf.download(TOP_WATCHLIST, period="5d")
        
        if df.empty:
            return []
            
        # Handle MultiIndex columns (Price Type, Ticker)
        # We want 'Close' prices
        if 'Close' in df.columns:
            closes = df['Close']
        else:
            return []
            
        if len(closes) < 2:
            return []
            
        # Get last two rows for change calculation
        last_prices = closes.iloc[-1]
        prev_prices = closes.iloc[-2]
        
        results = []
        for ticker in TOP_WATCHLIST:
            try:
                # Check if ticker data exists in columns
                if ticker not in closes.columns:
                    continue
                    
                price = float(last_prices[ticker])
                prev = float(prev_prices[ticker])

                if pd.isna(price) or pd.isna(prev) or prev == 0:
                    continue
                    
                change = price - prev
                change_percent = (change / prev) * 100
                
                results.append({
                    "symbol": ticker,
                    "name": STOCK_NAMES.get(ticker, ticker),
                    "price": price,
                    "change": change,
                    "changePercent": change_percent
                })
                
            except Exception:
                continue
                
        # Sort by change percent descending (Top Gainers)
        results.sort(key=lambda x: x['changePercent'], reverse=True)
        
        # Cache for 5 minutes (separate TTL for top stocks)
        _data_cache["__top_performers__"] = (time.time(), results)
        
        return results[:limit]
    except Exception as e:
        print(f"Error fetching top performers: {e}")
        return []
