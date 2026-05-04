import os
import time
import sys

# Reduce TensorFlow memory footprint and logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1' # Force CPU to save GPU memory if shared

# Add parent directory to path for shared modules
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(BASE_DIR))
from shared_sentiment import analyze_news_sentiment, score_text_keywords

import re
import json
import threading
import gc
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
import math

import numpy as np
import pandas as pd
import requests as http_requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Heavy ML libs moved to local scope to save RAM
# import tensorflow as tf
# import torch
# from transformers import ...

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import cloudscraper
except ImportError:
    cloudscraper = None

# ============================================================
# GLOBALS (loaded once at startup)
# ============================================================
GLOBAL_MODEL = None
GLOBAL_SCALER = None
GLOBAL_FEATURE_COLS: List[str] = []
GLOBAL_SYMBOL_TO_ID: Dict[str, int] = {}
MODEL_LOADING = False

FINBERT_TOKENIZER = None
FINBERT_MODEL = None
FINBERT_BACKEND = "pt"
FINBERT_LOADING = False

# Cache for API responses: key -> (timestamp, data)
_response_cache: Dict[str, Tuple[float, any]] = {}
CACHE_TTL_SECONDS = 30

def _get_cached(key: str) -> Optional[any]:
    if key in _response_cache:
        ts, data = _response_cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
    return None

def _set_cached(key: str, data: any):
    _response_cache[key] = (time.time(), data)

# Paths (relative to this file — assumed cwd is crpto_market/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "cv360_investor_model.keras")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.json")
FEATURES_PATH = os.path.join(BASE_DIR, "cv360_features.csv")

# CryptoPanic token
CP_TOKEN = os.environ.get("CRYPTOPANIC_TOKEN", "4cd086bc8de6d4cb6d3fc10a1cf82c974b625896")

SEQ_LEN = 72
TARGET_COL = "target_ret_12h"

# ============================================================
# HELPER: CoinGecko symbol mapping
# ============================================================
_COINGECKO_MAP = {
    "BTC": "bitcoin", "ETH": "ethereum", "BNB": "binancecoin", "SOL": "solana",
    "XRP": "ripple", "ADA": "cardano", "DOGE": "dogecoin", "DOT": "polkadot",
    "AVAX": "avalanche-2", "LINK": "chainlink", "LTC": "litecoin", "MATIC": "matic-network",
    "ATOM": "cosmos", "BCH": "bitcoin-cash", "ETC": "ethereum-classic", "FIL": "filecoin",
    "HBAR": "hedera-hashgraph", "NEAR": "near", "TRX": "tron", "XLM": "stellar",
}


def _map_symbol_to_coingecko(symbol: str) -> Optional[str]:
    return _COINGECKO_MAP.get(symbol.upper())


def safe_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


# ============================================================
# HELPER: Prices
# ============================================
def fetch_coingecko_price(coin_id: str, vs: str = "usd") -> Dict:
    params = {"ids": coin_id, "vs_currencies": vs, "include_24hr_change": "true"}
    resp = http_requests.get("https://api.coingecko.com/api/v3/simple/price", params=params, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"CoinGecko HTTP {resp.status_code}")
    data = resp.json()
    if coin_id not in data:
        raise RuntimeError("CoinGecko: no data")
    row = data[coin_id]
    return {"price": float(row.get(vs, 0)), "change_24h": float(row.get(f"{vs}_24h_change", 0))}


def fetch_binance_price(symbol_pair: str) -> Dict:
    resp = http_requests.get("https://api.binance.com/api/v3/ticker/price", params={"symbol": symbol_pair}, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Binance HTTP {resp.status_code}")
    return {"price": float(resp.json().get("price", 0))}


def fetch_fear_greed_index() -> Dict:
    try:
        resp = http_requests.get("https://api.alternative.me/fng/?limit=1", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and len(data["data"]) > 0:
                return {
                    "value": int(data["data"][0]["value"]),
                    "classification": data["data"][0]["value_classification"],
                }
    except Exception:
        pass
    return {"value": 50, "classification": "Neutral"}


# ============================================================
# HELPER: Technical Indicators
# ============================================================
def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    g = df.copy()
    if "close" not in g.columns:
        return g
    close = g["close"].astype(float)
    g["sma20"] = close.rolling(20).mean()
    g["ema20"] = close.ewm(span=20, adjust=False).mean()

    mid = close.rolling(20).mean()
    sd = close.rolling(20).std()
    g["bb_mid"] = mid
    g["bb_up"] = mid + 2.0 * sd
    g["bb_dn"] = mid - 2.0 * sd

    delta = close.diff()
    up = delta.clip(lower=0.0)
    dn = (-delta).clip(lower=0.0)
    roll_up = up.ewm(alpha=1 / 14, adjust=False).mean()
    roll_dn = dn.ewm(alpha=1 / 14, adjust=False).mean()
    rs = roll_up / (roll_dn + 1e-12)
    g["rsi14"] = 100.0 - (100.0 / (1.0 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    g["macd"] = macd
    g["macd_signal"] = signal
    g["macd_hist"] = macd - signal
    return g


# ============================================================
# HELPER: News fetching (CryptoPanic + RSS)
# ============================================================
def _parse_cp_dt(s):
    if not s:
        return None
    try:
        return pd.to_datetime(s, utc=True)
    except Exception:
        return None


def fetch_cryptopanic_posts(token: str, coin: str, days_back: int = 30, max_pages: int = 3) -> pd.DataFrame:
    base = "https://cryptopanic.com/api/developer/v2/posts/"
    cutoff = pd.Timestamp.now(tz=timezone.utc) - pd.Timedelta(days=days_back)
    rows = []
    for page in range(1, max_pages + 1):
        params = {"auth_token": token, "currencies": coin, "public": "true", "page": page, "page_size": 50}
        try:
            resp = http_requests.get(base, params=params, timeout=30)
            if resp.status_code != 200:
                break
            data = resp.json()
            results = data.get("results") or data.get("data") or []
            if not results:
                break
            stop = False
            for it in results:
                published_at = _parse_cp_dt(it.get("published_at") or it.get("created_at"))
                if published_at and published_at < cutoff:
                    stop = True
                    continue
                domain = (it.get("source", {}) or {}).get("domain", "CryptoPanic") if isinstance(it.get("source"), dict) else "CryptoPanic"
                rows.append({
                    "published_at": published_at,
                    "title": it.get("title", ""),
                    "url": it.get("url") or f"https://cryptopanic.com/news/{it.get('id', '')}/click/",
                    "source": domain or "CryptoPanic",
                    "full_text": (it.get("title", "") + ". " + (it.get("description") or "")),
                })
            if stop:
                break
        except Exception:
            break
    df = pd.DataFrame(rows)
    if len(df) > 0:
        df["published_at"] = pd.to_datetime(df["published_at"], utc=True, errors="coerce")
        df = df.dropna(subset=["title"])
    return df


def _parse_rss_items(content, feed_name):
    """Parse RSS content with fallback parser if lxml is missing."""
    if not BeautifulSoup:
        return []
    # Suppress XMLParsedAsHTMLWarning when falling back to html.parser
    try:
        from bs4 import XMLParsedAsHTMLWarning
        import warnings
        warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
    except ImportError:
        pass
    # Try xml parser first (needs lxml), fall back to html.parser
    for parser in ["xml", "html.parser"]:
        try:
            soup = BeautifulSoup(content, parser)
            items = soup.find_all("item")
            if items:
                return items
        except Exception:
            continue
    return []


def fetch_rss_news(coin: str, limit: int = 30) -> pd.DataFrame:
    feeds = [
        {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss"},
        {"name": "Decrypt", "url": "https://decrypt.co/feed"},
        {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
        {"name": "NewsBTC", "url": "https://www.newsbtc.com/feed/"},
    ]
    coin_keywords = {
        "BTC": ["bitcoin", "btc"], "ETH": ["ethereum", "eth"], "BNB": ["binance", "bnb"],
        "SOL": ["solana", "sol"], "XRP": ["ripple", "xrp"], "ADA": ["cardano", "ada"],
        "DOGE": ["dogecoin", "doge"], "DOT": ["polkadot", "dot"], "MATIC": ["polygon", "matic"],
        "AVAX": ["avalanche", "avax"], "LINK": ["chainlink", "link"], "LTC": ["litecoin", "ltc"],
        "ATOM": ["cosmos", "atom"], "BCH": ["bitcoin cash", "bch"], "ETC": ["ethereum classic", "etc"],
        "FIL": ["filecoin", "fil"], "HBAR": ["hedera", "hbar"], "NEAR": ["near protocol", "near"],
        "TRX": ["tron", "trx"], "XLM": ["stellar", "xlm"],
    }
    keywords = coin_keywords.get(coin.upper(), [coin.lower()])
    scraper = None
    if cloudscraper:
        try:
            scraper = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows", "mobile": False})
        except Exception:
            pass
    if scraper is None:
        scraper = http_requests

    all_rows = []
    for feed in feeds:
        try:
            resp = scraper.get(feed["url"], timeout=10)
            if resp.status_code != 200:
                continue
            items = _parse_rss_items(resp.content, feed["name"])
            if not items:
                continue
            for it in items:
                title = it.title.text if it.title else ""
                link = it.link.text if it.link else ""
                pub_date = it.pubDate.text if it.pubDate else ""
                desc = it.description.text if it.description else ""
                text_to_check = (title + " " + desc).lower()
                if any(k in text_to_check for k in keywords):
                    all_rows.append({
                        "published_at": pd.to_datetime(pub_date, utc=True, errors="coerce"),
                        "title": title, "url": link, "source": feed["name"],
                        "full_text": title + ". " + desc,
                    })
        except Exception as e:
            print(f"RSS feed {feed['name']} error: {e}")
            continue

    # Fallback to general crypto news if nothing specific found
    if not all_rows:
        for feed in feeds:
            try:
                resp = scraper.get(feed["url"], timeout=10)
                if resp.status_code != 200:
                    continue
                items = _parse_rss_items(resp.content, feed["name"])
                if not items:
                    continue
                for it in items[:10]:
                    title = it.title.text if it.title else ""
                    link = it.link.text if it.link else ""
                    pub_date = it.pubDate.text if it.pubDate else ""
                    desc = it.description.text if it.description else ""
                    all_rows.append({
                        "published_at": pd.to_datetime(pub_date, utc=True, errors="coerce"),
                        "title": title, "url": link, "source": feed["name"],
                        "full_text": title + ". " + desc,
                    })
            except Exception:
                continue

    df = pd.DataFrame(all_rows)
    if len(df) > 0:
        df = df.dropna(subset=["published_at"])
        df = df.sort_values("published_at", ascending=False).head(limit)
    return df


# ============================================================
# HELPER: FinBERT Sentiment
# ============================================================
def _load_finbert():
    """Lazy loader for FinBERT to save RAM."""
    global FINBERT_TOKENIZER, FINBERT_MODEL, FINBERT_BACKEND, FINBERT_LOADING
    if FINBERT_MODEL is not None:
        return True
    if FINBERT_LOADING:
        return False

    print("⏳ Loading FinBERT sentiment model (requested)...")
    FINBERT_LOADING = True
    try:
        # Lazy import to save RAM
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch
        
        model_name = "ProsusAI/finbert"
        FINBERT_TOKENIZER = AutoTokenizer.from_pretrained(model_name)
        
        # Load in half-precision or check for safetensors if possible
        if torch is not None:
            # Check version for torch.load vulnerability
            v = torch.__version__.split('+')[0]
            parts = v.split('.')
            if int(parts[0]) >= 2 and int(parts[1]) >= 6:
                # Safe to load
                FINBERT_MODEL = AutoModelForSequenceClassification.from_pretrained(model_name)
            else:
                 print(f"🛑 FinBERT loading blocked: Torch {v} is below 2.6.0 safety threshold.")
                 FINBERT_LOADING = False
                 return False
        else:
            FINBERT_MODEL = AutoModelForSequenceClassification.from_pretrained(model_name)
            
        FINBERT_BACKEND = "pt"
        print("✅ FinBERT model loaded.")
        return True
    except Exception as e:
        print(f"🛑 FinBERT loading failed: {e}")
        return False
    finally:
        FINBERT_LOADING = False

# No longer loading in main thread at start
def init_sentiment_model():
    # Only useful if we want to background thread it, but for 8GB RAM we wait for request
    pass


def score_finbert(texts: List[str], batch_size: int = 16) -> List[float]:
    import tensorflow as tf
    if FINBERT_TOKENIZER is None or FINBERT_MODEL is None:
        return [0.0] * len(texts)
    scores = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        try:
            if FINBERT_BACKEND == "pt" and torch is not None:
                enc = FINBERT_TOKENIZER(batch, padding=True, truncation=True, max_length=128, return_tensors="pt")
                with torch.inference_mode():
                    out = FINBERT_MODEL(**enc)
                    probs = torch.softmax(out.logits, dim=-1).cpu().numpy()
            else:
                enc = FINBERT_TOKENIZER(batch, padding=True, truncation=True, max_length=128, return_tensors="tf")
                out = FINBERT_MODEL(enc)
                probs = tf.nn.softmax(out.logits, axis=-1).numpy()
            # FinBERT: [negative, neutral, positive]
            p_neg = probs[:, 0]
            p_pos = probs[:, 2]
            s = (p_pos - p_neg).astype(float)
            scores.extend(s.tolist())
        except Exception:
            scores.extend([0.0] * len(batch))
    return scores


# ============================================================
# HELPER: Model prediction functions
# ============================================================
def _get_csv_columns(path: str) -> List[str]:
    return list(pd.read_csv(path, nrows=0).columns)


def _resolve_feature_cols(scaler: Dict, expected_n: Optional[int]) -> List[str]:
    available = set(_get_csv_columns(FEATURES_PATH))
    base = list(scaler.get("feature_cols") or scaler.get("features") or [])
    drop = {"timestamp", "symbol", "imputed"}
    base = [c for c in base if c not in drop and not str(c).startswith("target_ret_")]
    cols = [c for c in base if c in available]
    if expected_n and len(cols) > expected_n:
        cols = cols[:expected_n]
    return cols


def _get_expected_n_features(model) -> Optional[int]:
    for t in list(getattr(model, "inputs", []) or []):
        tshape = getattr(t, "shape", None)
        if tshape and len(tshape) == 3 and tshape[-1] is not None:
            return int(tshape[-1])
    return None


def _apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict) -> pd.DataFrame:
    mu = pd.Series(scaler["mean"])
    sd = pd.Series(scaler["std"])
    out = df.copy()
    out[feature_cols] = (out[feature_cols] - mu[feature_cols].values) / sd[feature_cols].values
    return out


def _load_symbol_df(symbol: str, feature_cols: List[str], target_col: Optional[str], min_ts=None) -> pd.DataFrame:
    available = set(_get_csv_columns(FEATURES_PATH))
    price_cols = [c for c in ["open", "high", "low", "close", "volume"] if c in available]
    needed = ["timestamp", "symbol"] + price_cols + feature_cols
    if target_col:
        needed.append(target_col)
    usecols = [c for c in list(dict.fromkeys(needed)) if c in available]
    dtypes = {"symbol": "string"}
    for c in feature_cols:
        if c in available:
            dtypes[c] = "float32"
    for c in price_cols:
        dtypes[c] = "float32"
    if target_col and target_col in available:
        dtypes[target_col] = "float32"

    frames = []
    # Optimization: Use C engine for speed, smaller chunks, exact symbol filter
    symbol_upper = symbol.upper()
    for chunk in pd.read_csv(
        FEATURES_PATH,
        usecols=usecols,
        dtype=dtypes,
        chunksize=10_000,  # Smaller chunks for faster processing
        low_memory=True,
        engine="c",  # Faster C engine (requires no regex)
        on_bad_lines="skip",
    ):
        # Fast exact match filter (C engine compatible)
        chunk['symbol'] = chunk['symbol'].astype(str).str.upper()
        sub = chunk[chunk['symbol'] == symbol_upper].copy()
        if len(sub) > 0:
            sub["timestamp"] = pd.to_datetime(sub["timestamp"], errors="coerce")
            if min_ts is not None:
                sub = sub.loc[sub["timestamp"] > min_ts]
            if len(sub) > 0:
                frames.append(sub)
    if not frames:
        return pd.DataFrame(columns=usecols)
    return pd.concat(frames, ignore_index=True)


def _make_sequences(g: pd.DataFrame, feature_cols: List[str], target_col: Optional[str], seq_len: int, symbol_id: int):
    g = g.sort_values("timestamp", kind="mergesort")
    x = g[feature_cols].to_numpy(dtype=np.float32)
    t = g["timestamp"].to_numpy()
    c = g["close"].to_numpy(dtype=np.float32)
    y = g[target_col].to_numpy(dtype=np.float32) if target_col and target_col in g.columns else None

    if len(g) <= seq_len:
        empty_x = np.empty((0, seq_len, len(feature_cols)), dtype=np.float32)
        return empty_x, None, np.empty((0,), dtype=object), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

    xs, ys, ts_list, closes = [], [], [], []
    for i in range(seq_len - 1, len(g)):
        xw = x[i - seq_len + 1: i + 1]
        if np.isnan(xw).any():
            continue
        if y is not None:
            yw = float(y[i])
            if np.isnan(yw):
                continue
            ys.append(yw)
        xs.append(xw)
        ts_list.append(t[i])
        closes.append(float(c[i]))

    if not xs:
        empty_x = np.empty((0, seq_len, len(feature_cols)), dtype=np.float32)
        return empty_x, None, np.empty((0,), dtype=object), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

    X = np.stack(xs, axis=0)
    ts_arr = np.asarray(ts_list)
    sids = np.full((len(X),), np.int32(symbol_id), dtype=np.int32)
    close_now = np.asarray(closes, dtype=np.float32)
    y_arr = np.asarray(ys, dtype=np.float32) if y is not None else None
    gc.collect()
    return X, y_arr, ts_arr, sids, close_now


def _infer_predictions(model, X, sids, batch_size=512):
    import tensorflow as tf
    input_names = list(getattr(model, "input_names", []) or [])
    if not input_names:
        for t in list(getattr(model, "inputs", []) or []):
            name = getattr(t, "name", "")
            if name:
                input_names.append(name.split(":")[0])

    x_key = "x" if "x" in input_names else None
    sid_key = None
    if "symbol_id" in input_names:
        sid_key = "symbol_id"
    elif "sid" in input_names:
        sid_key = "sid"

    if x_key is None or sid_key is None:
        for t in list(getattr(model, "inputs", []) or []):
            tname = getattr(t, "name", "").split(":")[0]
            tshape = getattr(t, "shape", None)
            rank = len(tshape) if tshape is not None else None
            if rank == 3:
                x_key = tname
            elif rank in (0, 1) and sid_key is None:
                sid_key = tname

    if x_key is None or sid_key is None:
        raise ValueError("Could not determine model input keys")

    yraw = model.predict({x_key: X, sid_key: sids}, batch_size=batch_size, verbose=0)

    def _as_arr(v):
        if isinstance(v, tf.Tensor):
            v = v.numpy()
        return np.asarray(v)

    if isinstance(yraw, dict):
        out = {}
        if "ret" in yraw:
            out["ret"] = _as_arr(yraw["ret"]).reshape(-1).astype(np.float32)
        if "dir" in yraw:
            out["dir"] = _as_arr(yraw["dir"]).reshape(-1).astype(np.float32)
        if out:
            return out

    a = _as_arr(yraw).squeeze()
    if a.ndim == 0:
        return {"mu": np.full((len(X),), float(a), dtype=np.float32)}
    if a.ndim == 1:
        return {"mu": a.astype(np.float32)}
    if a.shape[1] == 3:
        return {"q10": a[:, 0], "q50": a[:, 1], "q90": a[:, 2]}
    if a.shape[1] == 2:
        return {"mu": a[:, 0], "sigma": np.exp(a[:, 1])}
    return {"mu": a[:, 0]}


# ============================================================
# HELPER: Trading Signal + Risk
# ============================================================
def generate_trading_signal(predicted_return, rsi=None, sentiment=None, volatility=None):
    score = 0
    reasons = []
    if predicted_return > 0.03:
        score += 40; reasons.append("Strong bullish prediction")
    elif predicted_return > 0.01:
        score += 25; reasons.append("Bullish prediction")
    elif predicted_return < -0.03:
        score -= 40; reasons.append("Strong bearish prediction")
    elif predicted_return < -0.01:
        score -= 25; reasons.append("Bearish prediction")
    if rsi is not None:
        if rsi < 30: score += 25; reasons.append("RSI oversold")
        elif rsi > 70: score -= 25; reasons.append("RSI overbought")
    if sentiment is not None:
        if sentiment > 0.3: score += 20; reasons.append("Positive sentiment")
        elif sentiment < -0.3: score -= 20; reasons.append("Negative sentiment")
    if volatility is not None and volatility > 0.05:
        score -= 15; reasons.append("High volatility risk")

    if score >= 50: sig, color = "STRONG BUY", "#00C853"
    elif score >= 20: sig, color = "BUY", "#4CAF50"
    elif score <= -50: sig, color = "STRONG SELL", "#D50000"
    elif score <= -20: sig, color = "SELL", "#F44336"
    else: sig, color = "HOLD", "#FFC107"
    return {"signal": sig, "score": score, "color": color, "reasons": reasons[:3], "confidence": min(abs(score), 100)}


def calculate_risk_score(volatility_24h=None, sentiment=None, rsi=None, prediction_sigma=None):
    risk = 50
    factors = []
    if volatility_24h is not None:
        vol_risk = min(volatility_24h * 500, 30); risk += vol_risk
        if vol_risk > 15: factors.append("High volatility")
    if sentiment is not None:
        sent_risk = max(-sentiment * 15, -10); risk += sent_risk
        if sentiment < -0.2: factors.append("Negative sentiment")
    if rsi is not None and (rsi > 75 or rsi < 25):
        risk += 15; factors.append("Extreme RSI")
    if prediction_sigma is not None:
        sigma_risk = min(prediction_sigma * 200, 20); risk += sigma_risk
        if sigma_risk > 10: factors.append("High uncertainty")
    risk = max(0, min(100, risk))
    level = "Low" if risk < 30 else "Medium" if risk < 60 else "High"
    color = "#4CAF50" if risk < 30 else "#FFC107" if risk < 60 else "#F44336"
    return {"score": int(risk), "level": level, "color": color, "factors": factors}


# ============================================================
# STARTUP: Background loading
# ============================================================
def _load_investor_model():
    """Lazy loader for investor model to save RAM."""
    global GLOBAL_MODEL, GLOBAL_SCALER, GLOBAL_FEATURE_COLS, GLOBAL_SYMBOL_TO_ID, MODEL_LOADING
    if GLOBAL_MODEL is not None:
        return True
    if MODEL_LOADING:
        return False
        
    print("⏳ Loading crypto model and scaler (requested)...")
    MODEL_LOADING = True
    try:
        import tensorflow as tf
        with open(SCALER_PATH, "r") as f:
            GLOBAL_SCALER = json.load(f)

        sym_map = GLOBAL_SCALER.get("symbol_to_id") or GLOBAL_SCALER.get("symbols") or {}
        GLOBAL_SYMBOL_TO_ID = {str(k): int(v) for k, v in sym_map.items()}

        GLOBAL_MODEL = tf.keras.models.load_model(MODEL_PATH, compile=False)
        
        # Optimized: Do NOT read full CSV. Use helper to get columns only.
        if os.path.exists(FEATURES_PATH):
            all_cols = _get_csv_columns(FEATURES_PATH)
            # Must exclude metadata columns like 'imputed' and other targets
            GLOBAL_FEATURE_COLS = [
                c for c in all_cols 
                if c not in ["timestamp", "symbol", TARGET_COL, "imputed"] 
                and not str(c).startswith("target_ret_")
            ]
            
            # We need symbols for ID mapping if not in scaler
            # But reading full CSV for symbols is too heavy. 
            # Trust the SCALER's symbol map first.
            if not GLOBAL_SYMBOL_TO_ID:
                # Fallback: Read only symbol column
                syms = pd.read_csv(FEATURES_PATH, usecols=["symbol"]).drop_duplicates()["symbol"].sort_values().tolist()
                GLOBAL_SYMBOL_TO_ID = {s: i for i, s in enumerate(syms)}

        print(f"✅ Crypto model loaded. {len(GLOBAL_SYMBOL_TO_ID)} symbols.")
        return True
    except Exception as e:
        print(f"🛑 Crypto model load error: {e}")
        GLOBAL_MODEL = None
        return False
    finally:
        MODEL_LOADING = False

# Background loading disabled for 8GB RAM stability
# threading.Thread(target=_load_model_background, daemon=True).start()
# threading.Thread(target=_load_finbert_background, daemon=True).start()


# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(title="CryptoVision 360 API")

@app.on_event("startup")
async def startup_event():
    """Pre-load AI model on startup to avoid first-request delay."""
    print("⏳ Pre-loading crypto model on startup...")
    threading.Thread(target=_load_investor_model, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---
class SymbolRequest(BaseModel):
    symbol: str = "BTC"


class TechnicalRequest(BaseModel):
    symbol: str = "BTC"
    days: int = 365


class ForecastRequest(BaseModel):
    symbol: str = "BTC"
    lookback_days: int = 30


# --- Endpoints ---

@app.get("/api/crypto/symbols")
async def get_symbols():
    """Return list of supported crypto symbols."""
    return {"symbols": sorted(GLOBAL_SYMBOL_TO_ID.keys()) if GLOBAL_SYMBOL_TO_ID else list(_COINGECKO_MAP.keys())}


@app.post("/api/crypto/overview")
async def get_crypto_overview(request: SymbolRequest):
    """Live price, Fear & Greed, top coins, and AI signal."""
    cache_key = f"overview_{request.symbol.upper()}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
        
    try:
        symbol = request.symbol.upper()
        
        # Pre-load model if not loaded
        if GLOBAL_MODEL is None:
            _load_investor_model()

        # 1. Live Price
        live_price = None
        change_24h = 0.0
        pair = f"{symbol}USDT"
        try:
            bp = fetch_binance_price(pair)
            live_price = bp["price"]
        except Exception:
            cg_id = _map_symbol_to_coingecko(symbol)
            if cg_id:
                try:
                    cg = fetch_coingecko_price(cg_id)
                    live_price = cg["price"]
                    change_24h = cg["change_24h"]
                except Exception:
                    pass

        # 2. Fear & Greed
        fng = fetch_fear_greed_index()

        # 3. Top coins quick prices (Limit to 5 for speed)
        top_symbols = ["BTC", "ETH", "SOL", "BNB", "XRP"]
        top_coins = []
        for s in top_symbols:
            try:
                p = fetch_binance_price(f"{s}USDT")
                top_coins.append({"symbol": s, "price": p["price"], "change": 0})
            except Exception:
                cg_id = _map_symbol_to_coingecko(s)
                if cg_id:
                    try:
                        cg = fetch_coingecko_price(cg_id)
                        top_coins.append({"symbol": s, "price": cg["price"], "change": cg["change_24h"]})
                    except Exception:
                        pass

        # 4 & 5. Consolidated Data Loading (Scan CSV once)
        signal_data = {"signal": "HOLD", "confidence": 0, "color": "#FFC107", "reasons": [], "score": 0}
        risk_data = {"score": 50, "level": "Medium", "color": "#FFC107", "factors": []}
        predicted_return = 0.0
        predicted_price = None
        sigma_val = None
        chart_data = []

        available = set(_get_csv_columns(FEATURES_PATH))
        tc = TARGET_COL if TARGET_COL in available else None
        
        # Load data ONCE for both AI model and Chart
        raw_full = _load_symbol_df(symbol, GLOBAL_FEATURE_COLS, tc)
        
        if len(raw_full) > 0 and "close" in raw_full.columns:
            # A. Model Prediction Logic
            if GLOBAL_MODEL is not None and GLOBAL_SCALER is not None and symbol in GLOBAL_SYMBOL_TO_ID:
                try:
                    sid = GLOBAL_SYMBOL_TO_ID[symbol]
                    raw = raw_full.copy()
                    raw["symbol_id"] = np.int32(sid)
                    raw = raw.dropna(subset=["close"] + GLOBAL_FEATURE_COLS + ([tc] if tc else [])).copy()
                    raw = raw.sort_values("timestamp", kind="mergesort")

                    max_ts_raw = pd.to_datetime(raw["timestamp"]).max()
                    min_ts_raw = max_ts_raw - pd.Timedelta(days=30)
                    raw_for_model = raw.loc[raw["timestamp"] >= (min_ts_raw - pd.Timedelta(hours=SEQ_LEN))].copy()

                    scaled = _apply_scaler(raw_for_model, GLOBAL_FEATURE_COLS, GLOBAL_SCALER)
                    X, y_true, ts, sids, close_now = _make_sequences(scaled, GLOBAL_FEATURE_COLS, tc, SEQ_LEN, sid)

                    if len(X) > 0:
                        preds = _infer_predictions(GLOBAL_MODEL, X, sids)
                        target_scale = float(GLOBAL_SCALER.get("target_scale", 1.0) or 1.0)
                        if "ret" in preds:
                            predicted_return = float(preds["ret"][-1]) / target_scale
                        elif "q50" in preds:
                            predicted_return = float(preds["q50"][-1])
                        else:
                            predicted_return = float(preds.get("mu", np.array([0]))[-1])

                        if "sigma" in preds:
                            sigma_val = float(preds["sigma"][-1])

                        tech_df = add_indicators(raw[["timestamp", "open", "high", "low", "close", "volume"]].copy())
                        latest_rsi = float(tech_df["rsi14"].iloc[-1]) if "rsi14" in tech_df.columns else None
                        latest_vol = float(raw_for_model["logret_1h"].std()) if "logret_1h" in raw_for_model.columns else None

                        signal_data = generate_trading_signal(predicted_return, latest_rsi, None, latest_vol)
                        risk_data = calculate_risk_score(latest_vol, None, latest_rsi, sigma_val)

                        if live_price and predicted_return:
                            predicted_price = live_price * (1 + predicted_return)
                except Exception as e:
                    print(f"Overview prediction error: {e}")

            # B. Chart Data Logic (Last 7 days)
            try:
                raw_chart = raw_full.sort_values("timestamp").tail(168)
                for _, row in raw_chart.iterrows():
                    chart_data.append({
                        "Date": str(row["timestamp"]),
                        "Close": safe_float(row["close"]),
                        "Open": safe_float(row.get("open", row["close"])),
                        "High": safe_float(row.get("high", row["close"])),
                        "Low": safe_float(row.get("low", row["close"])),
                        "Volume": safe_float(row.get("volume", 0)),
                    })
            except Exception as e:
                print(f"Chart data error: {e}")

        result = {
            "status": "success",
            "symbol": symbol,
            "livePrice": safe_float(live_price, None),
            "change24h": safe_float(change_24h),
            "predictedReturn": safe_float(predicted_return * 100),
            "predictedPrice": safe_float(predicted_price, None),
            "sigma": safe_float(sigma_val, None),
            "fearGreed": fng,
            "signal": signal_data,
            "risk": risk_data,
            "topCoins": top_coins,
            "chartData": chart_data,
            "supportedSymbols": sorted(GLOBAL_SYMBOL_TO_ID.keys()) if GLOBAL_SYMBOL_TO_ID else list(_COINGECKO_MAP.keys()),
        }
        _set_cached(cache_key, result)
        return result
    except Exception as e:
        print(f"Fatal Overview Error: {e}")
        # Return a partial success with empty data to avoid 500
        return {
            "status": "partial_error",
            "error": str(e),
            "symbol": request.symbol.upper(),
            "livePrice": None,
            "change24h": 0,
            "predictedReturn": 0,
            "predictedPrice": None,
            "sigma": None,
            "fearGreed": {"value": 50, "classification": "Neutral"},
            "signal": {"signal": "HOLD", "confidence": 0, "color": "#FFC107", "reasons": [], "score": 0},
            "risk": {"score": 50, "level": "Medium", "color": "#FFC107", "factors": []},
            "topCoins": [],
            "chartData": [],
            "supportedSymbols": list(_COINGECKO_MAP.keys()),
        }


@app.post("/api/crypto/technical")
async def get_crypto_technical(request: TechnicalRequest):
    """OHLCV + technical indicators for charting."""
    cache_key = f"technical_{request.symbol.upper()}_{request.days}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
        
    try:
        symbol = request.symbol.upper()
        days = min(request.days, 3650)

        if GLOBAL_SCALER is None or symbol not in GLOBAL_SYMBOL_TO_ID:
            # Fallback for symbols not in model
            raw = _load_symbol_df(symbol, [], None)
            if len(raw) == 0:
                 return {"status": "error", "detail": f"No data for {symbol}", "data": []}
        else:
            raw = _load_symbol_df(symbol, [], None)

        if len(raw) == 0:
            return {"status": "error", "detail": "No data found", "data": []}

        raw = raw.sort_values("timestamp", kind="mergesort")
        max_ts = pd.to_datetime(raw["timestamp"]).max()
        min_ts = max_ts - pd.Timedelta(days=days)
        raw = raw.loc[raw["timestamp"] >= min_ts].copy()

        tech = add_indicators(raw[["timestamp", "open", "high", "low", "close", "volume"]].copy())

        data = []
        for _, row in tech.iterrows():
            d = {
                "Date": str(row["timestamp"]),
                "Open": float(row.get("open", 0)),
                "High": float(row.get("high", 0)),
                "Low": float(row.get("low", 0)),
                "Close": float(row.get("close", 0)),
                "Volume": float(row.get("volume", 0)),
            }
            for col in ["sma20", "ema20", "bb_mid", "bb_up", "bb_dn", "rsi14", "macd", "macd_signal", "macd_hist"]:
                val = row.get(col)
                if pd.notna(val):
                    d[col] = float(val)
                else:
                    d[col] = None
            data.append(d)

        # Summary stats
        latest = tech.iloc[-1] if len(tech) > 0 else {}
        result = {
            "status": "success",
            "symbol": symbol,
            "data": data,
            "latestRSI": safe_float(latest.get("rsi14"), None),
            "latestMACD": safe_float(latest.get("macd"), None),
            "latestSignal": "Buy" if safe_float(latest.get("macd"), 0) > safe_float(latest.get("macd_signal"), 0) else "Sell",
        }
        _set_cached(cache_key, result)
        return result
    except Exception as e:
        print(f"Technical API Error: {e}")
        return {"status": "error", "detail": str(e), "data": []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")


@app.post("/api/crypto/sentiment")
async def get_crypto_sentiment(request: SymbolRequest):
    """News sentiment using CryptoPanic + RSS. Skip FinBERT if not loaded."""
    cache_key = f"sentiment_{request.symbol.upper()}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
        
    try:
        symbol = request.symbol.upper()
        all_news = []

        # CryptoPanic (quick timeout) — may return 404 if token expired
        if CP_TOKEN:
            try:
                cp = fetch_cryptopanic_posts(token=CP_TOKEN, coin=symbol, days_back=30, max_pages=1)
                if len(cp) > 0:
                    for _, row in cp.iterrows():
                        all_news.append({
                            "title": row.get("title", ""),
                            "url": row.get("url", "#"),
                            "source": row.get("source", "CryptoPanic"),
                            "published_at": str(row["published_at"]) if pd.notna(row.get("published_at")) else "",
                            "full_text": row.get("full_text", row.get("title", "")),
                        })
            except Exception as e:
                print(f"CryptoPanic fetch error: {e}")

        # RSS (quick timeout)
        try:
            rss = fetch_rss_news(symbol, limit=5)  # Reduced from 10 to 5 for speed
            if len(rss) > 0:
                for _, row in rss.iterrows():
                    all_news.append({
                        "title": row.get("title", ""),
                        "url": row.get("url", "#"),
                        "source": row.get("source", "RSS"),
                        "published_at": str(row["published_at"]) if pd.notna(row.get("published_at")) else "",
                        "full_text": row.get("full_text", row.get("title", "")),
                    })
        except Exception as e:
            print(f"RSS fetch error: {e}")

        # Deduplicate by title
        seen_titles = set()
        unique_news = []
        for item in all_news:
            t = str(item.get("title", "")).strip()
            if t and t not in seen_titles:
                seen_titles.add(t)
                unique_news.append(item)

        # Use shared sentiment analyzer (keyword-based, fast and reliable)
        result = analyze_news_sentiment(unique_news[:15])
        
        # Format news items with sentiment scores
        news_items = []
        for item in result["news"]:
            news_items.append({
                "title": item["title"],
                "url": item["url"],
                "source": item["source"],
                "published_at": item["published_at"],
                "sentiment": round(float(item.get("sentiment", 0)), 4),
            })

        result_final = {
            "status": "success",
            "symbol": symbol,
            "sentiment_score": result["sentiment_score"],
            "sentiment_label": result["sentiment_label"],
            "positive_count": result["positive_count"],
            "negative_count": result["negative_count"],
            "news": news_items,
        }
        _set_cached(cache_key, result_final)
        return result_final
    except Exception as e:
        print(f"Sentiment API Error: {e}")
        return {
            "status": "error",
            "symbol": request.symbol.upper(),
            "sentiment_score": 0,
            "sentiment_label": "Neutral",
            "positive_count": 0,
            "negative_count": 0,
            "news": [],
        }


@app.post("/api/crypto/forecast")
async def get_crypto_forecast(request: ForecastRequest):
    """Model-based predictions: actual vs predicted returns."""
    cache_key = f"forecast_{request.symbol.upper()}_{request.lookback_days}"
    cached = _get_cached(cache_key)
    if cached:
        return cached
        
    try:
        symbol = request.symbol.upper()

        # Wait for model to load (max 60 seconds)
        import time
        wait_start = time.time()
        while MODEL_LOADING and time.time() - wait_start < 60:
            time.sleep(0.5)
            
        if GLOBAL_MODEL is None:
             success = _load_investor_model()
             if not success:
                 return {"status": "error", "detail": "Forecast model could not be loaded."}
                 
        if symbol not in GLOBAL_SYMBOL_TO_ID:
             return {"status": "error", "detail": f"Symbol {symbol} not supported by model."}

        sid = GLOBAL_SYMBOL_TO_ID[symbol]
        available = set(_get_csv_columns(FEATURES_PATH))
        tc = TARGET_COL if TARGET_COL in available else None

        raw = _load_symbol_df(symbol, GLOBAL_FEATURE_COLS, tc)
        if len(raw) == 0:
            return {"status": "error", "detail": "No data for symbol."}

        raw["symbol_id"] = np.int32(sid)
        raw = raw.dropna(subset=["close"] + GLOBAL_FEATURE_COLS + ([tc] if tc else [])).copy()
        raw = raw.sort_values("timestamp", kind="mergesort")

        # Limit to last N days to avoid OOM
        # Frontend supports 1y/2y/3y/5y, so cap to 5 years.
        lookback = min(request.lookback_days, 1825)
        max_ts = pd.to_datetime(raw["timestamp"]).max()
        min_ts = max_ts - pd.Timedelta(days=lookback)
        raw_for_model = raw.loc[raw["timestamp"] >= (min_ts - pd.Timedelta(hours=SEQ_LEN))].copy()

        # Performance guard: trim to a lookback-proportional number of the most recent rows.
        # This keeps the API responsive but allows 1y/2y/3y/5y selections to actually
        # change the returned series length.
        # Heuristic: ~24 points/day (hourly data). Cap to avoid huge responses.
        max_points_per_day = 24
        max_rows_cap = 50_000
        desired_rows = SEQ_LEN + int(lookback * max_points_per_day)
        max_rows = min(max_rows_cap, desired_rows)
        if len(raw_for_model) > max_rows:
            raw_for_model = raw_for_model.tail(max_rows).copy()

        scaled = _apply_scaler(raw_for_model, GLOBAL_FEATURE_COLS, GLOBAL_SCALER)
        X, y_true, ts, sids_arr, close_now = _make_sequences(scaled, GLOBAL_FEATURE_COLS, tc, SEQ_LEN, sid)

        if len(X) == 0:
            return {"status": "error", "detail": "Not enough data for sequences."}

        preds = _infer_predictions(GLOBAL_MODEL, X, sids_arr)
        target_scale = float(GLOBAL_SCALER.get("target_scale", 1.0) or 1.0)

        # Build output
        timestamps = [str(pd.Timestamp(t)) for t in ts]
        
        if "ret" in preds:
            y_pred_arr = preds["ret"] / target_scale
        elif "q50" in preds:
            y_pred_arr = preds["q50"]
        else:
            y_pred_arr = preds.get("mu", np.zeros(len(X)))

        y_pred_list = (y_pred_arr * 100).tolist()
        y_true_list = (y_true * 100).tolist() if y_true is not None else []
 
        # Uncertainty (sigma): if model doesn't provide it, compute a fallback estimate
        # from recent prediction variability so the UI never shows N/A.
        if "sigma" in preds and preds["sigma"] is not None and len(preds["sigma"]) > 0:
            sigma_list = (preds["sigma"] * 100).tolist()
        else:
            window = min(50, len(y_pred_arr))
            if window >= 2:
                sigma_est = float(np.std(y_pred_arr[-window:]) * 100)
            else:
                sigma_est = 0.0
            sigma_list = [safe_float(sigma_est)] * len(y_pred_arr)
 
        dir_prob_list = preds["dir"].tolist() if "dir" in preds else []

        # Compute accuracy if we have actuals
        accuracy = 0.0
        if y_true is not None and len(y_true) > 0 and len(y_pred_arr) > 0:
            actual_dir = (y_true > 0).astype(int)
            pred_dir = (y_pred_arr > 0).astype(int)
            min_len = min(len(actual_dir), len(pred_dir))
            accuracy = float(np.mean(actual_dir[:min_len] == pred_dir[:min_len]) * 100)

        latest_pred_return = safe_float(y_pred_arr[-1]) if len(y_pred_arr) > 0 else 0
        
        # Fetch REAL live price from CoinGecko/Binance (not scaled data)
        live_price = None
        try:
            # Try Binance first (faster)
            pair = f"{symbol}USDT"
            bp = fetch_binance_price(pair)
            live_price = bp["price"]
        except Exception:
            # Fallback to CoinGecko
            cg_id = _map_symbol_to_coingecko(symbol)
            if cg_id:
                try:
                    cg = fetch_coingecko_price(cg_id)
                    live_price = cg["price"]
                except Exception:
                    pass
        
        # Use live price if available, otherwise fallback to close_now (for testing)
        if live_price is not None and live_price > 0:
            latest_price = live_price
        else:
            # If no live price, we can't show accurate predicted price
            # Return error so UI doesn't show misleading prices
            return {"status": "error", "detail": f"Could not fetch live price for {symbol}. Please try again."}
        
        predicted_price = latest_price * (1 + latest_pred_return / 100)  # Convert % to decimal
        horizon_hours = GLOBAL_SCALER.get("horizon_hours", 12)

        # Return series length: keep it proportional to lookback (cap to keep payload reasonable)
        series_cap = 20_000
        desired_series_len = int(lookback * max_points_per_day)
        series_len = min(series_cap, max(150, desired_series_len), len(timestamps))
         
        result = {
            "status": "success",
            "symbol": symbol,
            "horizonHours": horizon_hours,
            "timestamps": timestamps[-series_len:],
            "predictedReturns": [safe_float(x) for x in y_pred_list[-series_len:]],
            "actualReturns": [safe_float(x) for x in y_true_list[-series_len:]],
            "sigma": [safe_float(x) for x in sigma_list[-series_len:]],
            "directionProb": [safe_float(x) for x in dir_prob_list[-series_len:]],
            "accuracy": safe_float(accuracy),
            "latestPredReturn": safe_float(latest_pred_return * 100),
            "latestPrice": safe_float(latest_price),
            "predictedPrice": safe_float(predicted_price),
            "latestSigma": safe_float(sigma_list[-1]) if sigma_list else None,
            "dataPoints": len(timestamps),
            "seqLen": SEQ_LEN,
            "nFeatures": len(GLOBAL_FEATURE_COLS),
        }
        _set_cached(cache_key, result)
        return result
    except Exception as e:
        print(f"Forecast API Error: {e}")
        return {"status": "error", "detail": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast error: {e}")
