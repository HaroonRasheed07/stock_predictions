# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import json
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
import io

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import streamlit as st
import tensorflow as tf
import requests
import cloudscraper
from scipy import stats
from bs4 import BeautifulSoup
import re
import gc

try:
    from streamlit_autorefresh import st_autorefresh
except Exception:
    st_autorefresh = None

try:
    from transformers import AutoTokenizer, TFAutoModelForSequenceClassification, AutoModelForSequenceClassification
except Exception:
    AutoTokenizer = None
    TFAutoModelForSequenceClassification = None
    AutoModelForSequenceClassification = None

try:
    import torch
except Exception:
    torch = None

try:
    import safetensors  # noqa: F401
except Exception:
    safetensors = None


@st.cache_resource
def load_model_cached(model_path: str) -> tf.keras.Model:
    return tf.keras.models.load_model(model_path, compile=False)


@st.cache_resource
def load_finbert_cached():
    if AutoTokenizer is None:
        raise RuntimeError("transformers is not installed. Install requirements.txt dependencies.")
    tok = AutoTokenizer.from_pretrained("ProsusAI/finbert")

    # Default to PyTorch backend (lower memory overhead vs TF on many Windows setups).
    if torch is not None and AutoModelForSequenceClassification is not None:
        if safetensors is None:
            raise RuntimeError(
                "PyTorch FinBERT loading requires 'safetensors'. Install with: pip install safetensors"
            )
        mdl = AutoModelForSequenceClassification.from_pretrained(
            "ProsusAI/finbert",
            use_safetensors=True,
            low_cpu_mem_usage=True,
        )
        mdl.eval()
        return {"backend": "pt", "tokenizer": tok, "model": mdl}

    # Fallback to TF only if PyTorch isn't available.
    if TFAutoModelForSequenceClassification is None:
        raise RuntimeError(
            "FinBERT requires either PyTorch ('torch') or the Transformers TF backend. "
            "Install with: pip install torch safetensors"
        )
    mdl = TFAutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
    return {"backend": "tf", "tokenizer": tok, "model": mdl}


@st.cache_data
def load_json_cached(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@st.cache_data
def get_csv_columns_cached(path: str) -> List[str]:
    return list(pd.read_csv(path, nrows=0).columns)


@st.cache_data(ttl=24 * 3600)
def load_coingecko_coin_list_cached() -> List[Dict]:
    resp = requests.get("https://api.coingecko.com/api/v3/coins/list", timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"CoinGecko HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError("Unexpected CoinGecko response for coins/list")
    return data


def map_symbol_to_coingecko_id(symbol: str) -> Optional[str]:
    sym = str(symbol).strip().lower()
    # Fast common mappings
    common = {
        "btc": "bitcoin",
        "eth": "ethereum",
        "bnb": "binancecoin",
        "sol": "solana",
        "xrp": "ripple",
        "ada": "cardano",
        "doge": "dogecoin",
        "dot": "polkadot",
        "ltc": "litecoin",
        "trx": "tron",
        "avax": "avalanche-2",
        "link": "chainlink",
        "matic": "polygon",
        "ton": "the-open-network",
        "shib": "shiba-inu",
        "uni": "uniswap",
    }
    if sym in common:
        return common[sym]

    # Heuristic: prefer exact id match, then unique symbol match
    coins = load_coingecko_coin_list_cached()
    for c in coins:
        if str(c.get("id", "")).lower() == sym:
            return str(c.get("id"))

    matches = [c for c in coins if str(c.get("symbol", "")).lower() == sym]
    if len(matches) == 1:
        return str(matches[0].get("id"))
    return None


@st.cache_data(ttl=60)
def fetch_coingecko_price(coin_id: str, vs: str = "usd") -> Dict[str, float]:
    params = {
        "ids": coin_id,
        "vs_currencies": vs,
        "include_24hr_change": "true",
    }
    resp = requests.get("https://api.coingecko.com/api/v3/simple/price", params=params, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"CoinGecko HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if coin_id not in data:
        raise RuntimeError("CoinGecko returned no price for that id")
    row = data[coin_id]
    price = float(row.get(vs))
    chg = float(row.get(f"{vs}_24h_change", 0.0))
    return {"price": price, "change_24h": chg}


@st.cache_data(ttl=1)
def fetch_binance_price(symbol_pair: str) -> Dict[str, float]:
    # Example symbol_pair: BTCUSDT
    resp = requests.get("https://api.binance.com/api/v3/ticker/price", params={"symbol": symbol_pair}, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Binance HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    price = float(data.get("price"))
    return {"price": price}


@st.cache_data(ttl=300)
def fetch_fear_greed_index() -> Dict:
    """Fetch Fear & Greed Index from alternative.me API."""
    try:
        resp = requests.get("https://api.alternative.me/fng/?limit=1", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and len(data["data"]) > 0:
                return {
                    "value": int(data["data"][0]["value"]),
                    "classification": data["data"][0]["value_classification"],
                    "timestamp": data["data"][0]["timestamp"]
                }
    except Exception:
        pass
    return {"value": 50, "classification": "Neutral", "timestamp": ""}


def generate_trading_signal(
    predicted_return: float,
    rsi: Optional[float],
    sentiment: Optional[float],
    volatility: Optional[float]
) -> Dict:
    """Generate AI-powered trading signal based on multiple indicators."""
    score = 0
    reasons = []
    
    # Prediction component (40% weight)
    if predicted_return > 0.03:
        score += 40
        reasons.append("Strong bullish prediction")
    elif predicted_return > 0.01:
        score += 25
        reasons.append("Bullish prediction")
    elif predicted_return < -0.03:
        score -= 40
        reasons.append("Strong bearish prediction")
    elif predicted_return < -0.01:
        score -= 25
        reasons.append("Bearish prediction")
    
    # RSI component (25% weight)
    if rsi is not None:
        if rsi < 30:
            score += 25
            reasons.append("RSI oversold")
        elif rsi < 40:
            score += 10
        elif rsi > 70:
            score -= 25
            reasons.append("RSI overbought")
        elif rsi > 60:
            score -= 10
    
    # Sentiment component (20% weight)
    if sentiment is not None:
        if sentiment > 0.3:
            score += 20
            reasons.append("Positive sentiment")
        elif sentiment < -0.3:
            score -= 20
            reasons.append("Negative sentiment")
    
    # Volatility component (15% weight)
    if volatility is not None:
        if volatility > 0.05:
            score -= 15
            reasons.append("High volatility risk")
    
    # Determine signal
    if score >= 50:
        signal = "🟢 STRONG BUY"
        color = "#00C853"
    elif score >= 20:
        signal = "🟢 BUY"
        color = "#4CAF50"
    elif score <= -50:
        signal = "🔴 STRONG SELL"
        color = "#D50000"
    elif score <= -20:
        signal = "🔴 SELL"
        color = "#F44336"
    else:
        signal = "🟡 HOLD"
        color = "#FFC107"
    
    return {
        "signal": signal,
        "score": score,
        "color": color,
        "reasons": reasons[:3],
        "confidence": min(abs(score), 100)
    }


def calculate_risk_score(
    volatility_24h: Optional[float],
    sentiment: Optional[float],
    rsi: Optional[float],
    prediction_sigma: Optional[float]
) -> Dict:
    """Calculate composite risk score 0-100."""
    risk = 50  # Base risk
    factors = []
    
    if volatility_24h is not None:
        vol_risk = min(volatility_24h * 500, 30)
        risk += vol_risk
        if vol_risk > 15:
            factors.append("High volatility")
    
    if sentiment is not None:
        sent_risk = max(-sentiment * 15, -10)
        risk += sent_risk
        if sentiment < -0.2:
            factors.append("Negative sentiment")
    
    if rsi is not None:
        if rsi > 75 or rsi < 25:
            risk += 15
            factors.append("Extreme RSI")
    
    if prediction_sigma is not None:
        sigma_risk = min(prediction_sigma * 200, 20)
        risk += sigma_risk
        if sigma_risk > 10:
            factors.append("High uncertainty")
    
    risk = max(0, min(100, risk))
    
    if risk < 30:
        level = "Low"
        color = "#4CAF50"
    elif risk < 60:
        level = "Medium"
        color = "#FFC107"
    else:
        level = "High"
        color = "#F44336"
    
    return {"score": int(risk), "level": level, "color": color, "factors": factors}


def _ensure_cache_dir() -> str:
    d = os.path.join(os.path.dirname(__file__), ".cache")
    os.makedirs(d, exist_ok=True)
    return d


def _parse_cp_dt(s: Optional[str]) -> Optional[pd.Timestamp]:
    if not s:
        return None
    try:
        # CryptoPanic uses ISO timestamps
        return pd.to_datetime(s, utc=True)
    except Exception:
        return None


def resolve_and_scrape(news_item: Dict) -> Dict:
    """
    Attempts to resolve the original URL and scrape full content.
    Returns a dict with 'url', 'text', 'scraped'.
    """
    original_url = news_item.get("url")
    # Fallback to click URL if original is missing
    if not original_url and news_item.get("id"):
        original_url = f"https://cryptopanic.com/news/{news_item['id']}/click/"
    
    # Defaults
    result = {
        "url": original_url,
        "text": news_item.get("title", "") + ". " + (news_item.get("description") or ""),
        "scraped": False
    }

    # Use cloudscraper to bypass Cloudflare
    try:
        scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'mobile': False
            }
        )
    except Exception:
        # Fallback to requests if cloudscraper fails to init
        return result

    # If it's a click URL, try to resolve it
    if original_url and "cryptopanic.com" in original_url:
        try:
            resp = scraper.get(original_url, timeout=10, allow_redirects=True)
            
            # Check for meta refresh (client-side redirect)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'lxml')
                meta_refresh = soup.find('meta', attrs={'http-equiv': re.compile("^refresh$", re.I)})
                if meta_refresh:
                    content = meta_refresh.get('content', '')
                    if "url=" in content.lower():
                        target = re.split(r'url=', content, flags=re.I)[-1].strip()
                        if target.startswith('http'):
                            result['url'] = target
                            # Follow the new link to scrape
                            try:
                                resp = scraper.get(target, timeout=10)
                            except Exception:
                                pass
                
                # If we are now at a non-cryptopanic URL
                if "cryptopanic.com" not in resp.url:
                    result['url'] = resp.url
                    soup = BeautifulSoup(resp.text, 'lxml')
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    
                    paragraphs = soup.find_all('p')
                    text_content = ' '.join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 20])
                    
                    if len(text_content) > 100:
                        result['text'] = text_content
                        result['scraped'] = True

        except Exception:
            pass
            
    return result


def fetch_cryptopanic_posts(
    *,
    token: str,
    coin: str,
    days_back: int = 365,
    max_pages: int = 6,
    page_size: int = 100,
) -> pd.DataFrame:
    """Fetch per-coin news from CryptoPanic Developer v2.

    We keep it resilient: if params change, we still show a useful error.
    """
    base = "https://cryptopanic.com/api/developer/v2/posts/"
    cutoff = pd.Timestamp.now(tz=timezone.utc) - pd.Timedelta(days=int(days_back))

    rows: List[Dict] = []
    for page in range(1, int(max_pages) + 1):
        params = {
            "auth_token": token,
            "currencies": coin,
            "public": "true",
            "page": page,
            "page_size": int(page_size),
        }
        resp = requests.get(base, params=params, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"CryptoPanic HTTP {resp.status_code}: {resp.text[:500]}")

        data = resp.json()
        results = data.get("results") or data.get("data") or []
        if not isinstance(results, list) or len(results) == 0:
            break

        stop = False
        for it in results:
            title = it.get("title")
            raw_url = it.get("url") or it.get("source", {}).get("url")
            
            # Fallback URL construction if missing
            if not raw_url and it.get("id"):
                raw_url = f"https://cryptopanic.com/news/{it['id']}/click/"
            
            published_at = _parse_cp_dt(it.get("published_at") or it.get("created_at"))
            domain = None
            if isinstance(it.get("source"), dict):
                domain = it.get("source", {}).get("domain")
            
            # Fallback Source
            if not domain:
                domain = "CryptoPanic"

            if published_at is not None and published_at < cutoff:
                stop = True
                continue
            
            # Populate basic info first
            item_data = {
                "published_at": published_at,
                "title": title,
                "url": raw_url,
                "source": domain,
                "kind": it.get("kind"),
                "description": it.get("description"), # Keep for fallback
                "id": it.get("id"),
                "full_text": title + ". " + (it.get("description") or "")
            }
            
            rows.append(item_data)
        
        if stop:
            break

    # Robust Scraping for Top Items (limit to top 8 to avoid timeout)
    # We do this AFTER collecting the initial list to ensure we have the most recent ones.
    # But here we are page by page. We can do it on the final DF, 
    # but the user wants "analysis" so we need the text *before* scoring.
    # To keep it simple inside this function, let's scrape the first few rows encountered.
    # NOTE: This function might be called multiple times for pagination, but usually page 1 is what matters for "latest".
    
    count_scraped = 0
    for i in range(len(rows)):
        if count_scraped >= 8: # Limit to 8 articles
            break
        
        # Only scrape if it's news (not media/polls if distinguished)
        # And only if we haven't scraped it yet (though rows is fresh list)
        
        # Resolve & Scrape
        try:
             # Re-construct a temporary dict to pass
             tmp_item = {
                 "url": rows[i]["url"], 
                 "id": rows[i]["id"],
                 "title": rows[i]["title"],
                 "description": rows[i]["description"]
             }
             scraped_data = resolve_and_scrape(tmp_item)
             
             rows[i]["url"] = scraped_data["url"]
             rows[i]["full_text"] = scraped_data["text"]
             # Verify if we actually got new text
             if scraped_data["scraped"]:
                 count_scraped += 1
                 
        except Exception:
            pass

    df = pd.DataFrame(rows)
    if len(df) == 0:
        return df
    df = df.dropna(subset=["title"]).copy()
    df["published_at"] = pd.to_datetime(df["published_at"], utc=True, errors="coerce")
    return df


def fetch_rss_news(coin: str, limit: int = 50) -> pd.DataFrame:
    """Fetch cryptocurrency news from top tier RSS feeds with robust bypass."""
    feeds = [
        {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss"},
        {"name": "Decrypt", "url": "https://decrypt.co/feed"},
        {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
        {"name": "NewsBTC", "url": "https://www.newsbtc.com/feed/"}
    ]
    
    all_rows = []
    
    # Coin keywords for filtering
    coin_keywords = {
        "BTC": ["bitcoin", "btc"],
        "ETH": ["ethereum", "eth"],
        "BNB": ["binance", "bnb"],
        "SOL": ["solana", "sol"],
        "XRP": ["ripple", "xrp"],
        "ADA": ["cardano", "ada"],
        "DOGE": ["dogecoin", "doge"],
        "DOT": ["polkadot", "dot"],
        "MATIC": ["polygon", "matic"],
        "AVAX": ["avalanche", "avax"],
        "LINK": ["chainlink", "link"],
        "SHIB": ["shiba", "shib"],
        "LTC": ["litecoin", "ltc"],
    }
    
    keywords = coin_keywords.get(coin.upper(), [coin.lower()])
    
    # Try cloudscraper to bypass protections
    try:
        scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'mobile': False
            }
        )
    except Exception:
        scraper = requests

    for feed in feeds:
        try:
            resp = scraper.get(feed["url"], timeout=10)
            if resp.status_code != 200:
                continue
                
            soup = BeautifulSoup(resp.content, "xml")
            items = soup.find_all("item")
            
            for it in items:
                title = it.title.text if it.title else ""
                link = it.link.text if it.link else ""
                pub_date = it.pubDate.text if it.pubDate else ""
                
                # Try to get best description
                desc = ""
                if it.description:
                    desc = it.description.text
                elif it.find("content:encoded"):
                    desc = it.find("content:encoded").text
                
                # Simple keyword filtering
                text_to_check = (title + " " + desc).lower()
                matches_coin = any(k in text_to_check for k in keywords)
                
                if matches_coin or coin.upper() == "ALL":
                    all_rows.append({
                        "published_at": pd.to_datetime(pub_date, utc=True, errors='coerce'),
                        "title": title,
                        "url": link,
                        "source": feed["name"],
                        "description": desc,
                        "full_text": title + ". " + desc,
                        "is_fallback": False
                    })
        except Exception:
            continue
            
    # Fallback to general news if no coin-specific news found
    if not all_rows:
        for feed in feeds:
            try:
                resp = scraper.get(feed["url"], timeout=10)
                soup = BeautifulSoup(resp.content, "xml")
                items = soup.find_all("item")[:15] # Take latest 15
                for it in items:
                    all_rows.append({
                        "published_at": pd.to_datetime(it.pubDate.text if it.pubDate else "", utc=True, errors='coerce'),
                        "title": it.title.text if it.title else "",
                        "url": it.link.text if it.link else "",
                        "source": feed["name"],
                        "description": (it.description.text if it.description else "")[:300],
                        "full_text": (it.title.text if it.title else "") + ". " + (it.description.text if it.description else ""),
                        "is_fallback": True
                    })
            except Exception:
                continue

    df = pd.DataFrame(all_rows)
    if len(df) > 0:
        df = df.dropna(subset=["published_at"])
        df = df.sort_values("published_at", ascending=False).head(limit)
    return df


def score_finbert(texts: List[str], batch_size: int = 16) -> np.ndarray:
    """Returns sentiment in [-1, 1] approx: p_pos - p_neg."""
    try:
        bundle = load_finbert_cached()
    except (MemoryError, OSError, RuntimeError) as e:
        st.error(f"Sentiment model could not be loaded: {e}")
        return np.zeros((len(texts),), dtype=np.float32)
    tok = bundle["tokenizer"]
    mdl = bundle["model"]
    backend = bundle.get("backend", "pt")  # Default to PyTorch backend

    scores: List[np.ndarray] = []
    for i in range(0, len(texts), int(batch_size)):
        batch = texts[i : i + int(batch_size)]
        if backend == "tf":
            enc = tok(batch, padding=True, truncation=True, max_length=128, return_tensors="tf")
            out = mdl(enc)
            logits = out.logits
            probs = tf.nn.softmax(logits, axis=-1).numpy()
            # FinBERT label order: negative, neutral, positive
            p_neg = probs[:, 0]
            p_pos = probs[:, 2]
            s = (p_pos - p_neg).astype(np.float32)
            scores.append(s)
        else:
            # PyTorch backend
            try:
                enc = tok(batch, padding=True, truncation=True, max_length=128, return_tensors="pt")
                with torch.inference_mode():
                    out = mdl(**enc)
                    logits = out.logits
                    probs = torch.softmax(logits, dim=-1).cpu().numpy()
            except (MemoryError, OSError, RuntimeError) as e:
                st.error(f"Sentiment scoring failed due to memory limits: {e}")
                return np.zeros((len(texts),), dtype=np.float32)
            p_neg = probs[:, 0]
            p_pos = probs[:, 2]
            s = (p_pos - p_neg).astype(np.float32)
            scores.append(s)
    return np.concatenate(scores, axis=0) if scores else np.empty((0,), dtype=np.float32)


def build_daily_sentiment(news_df: pd.DataFrame) -> pd.DataFrame:
    if len(news_df) == 0:
        return pd.DataFrame(columns=["date", "sentiment", "count"])
    g = news_df.copy()
    g["date"] = g["published_at"].dt.tz_convert(None).dt.date
    daily = (
        g.groupby("date", as_index=False)
        .agg(sentiment=("sentiment", "mean"), count=("sentiment", "size"))
        .sort_values("date")
    )
    return daily


def _get_symbol_to_id(scaler: Dict) -> Dict[str, int]:
    if "symbol_to_id" in scaler and scaler["symbol_to_id"]:
        return {str(k): int(v) for k, v in scaler["symbol_to_id"].items()}
    if "symbols" in scaler and scaler["symbols"]:
        return {str(k): int(v) for k, v in scaler["symbols"].items()}
    return {}


def get_expected_n_features(model: tf.keras.Model) -> Optional[int]:
    for t in list(getattr(model, "inputs", []) or []):
        tshape = getattr(t, "shape", None)
        if tshape is None:
            continue
        if len(tshape) == 3 and tshape[-1] is not None:
            return int(tshape[-1])
    return None


def resolve_feature_cols_for_model(features_path: str, scaler: Dict, expected_n: Optional[int]) -> List[str]:
    available_cols = set(get_csv_columns_cached(features_path))

    base: List[str] = []
    if "feature_cols" in scaler and scaler["feature_cols"]:
        base = list(scaler["feature_cols"])
    elif "features" in scaler and scaler["features"]:
        base = list(scaler["features"])
    else:
        base = []

    drop = {"timestamp", "symbol", "imputed"}
    base = [c for c in base if c not in drop]
    base = [c for c in base if not str(c).startswith("target_ret_")]

    cols = [c for c in base if c in available_cols]

    if expected_n is None:
        return cols

    if len(cols) < expected_n:
        missing = [c for c in base if c not in available_cols]
        raise ValueError(
            f"Model expects n_features={expected_n} but only found {len(cols)} feature columns in CSV. "
            f"Missing columns (first 30): {missing[:30]}"
        )

    if len(cols) > expected_n:
        cols = cols[:expected_n]
    return cols


def apply_scaler(df: pd.DataFrame, feature_cols: List[str], scaler: Dict) -> pd.DataFrame:
    mu = pd.Series(scaler["mean"])
    sd = pd.Series(scaler["std"])
    out = df.copy()
    out[feature_cols] = (out[feature_cols] - mu[feature_cols].values) / sd[feature_cols].values
    return out


def iter_symbol_rows(
    features_path: str,
    *,
    symbol: str,
    usecols: List[str],
    dtypes: Dict[str, str],
    min_timestamp: Optional[pd.Timestamp],
    chunksize: int = 100_000,
):
    for chunk in pd.read_csv(
        features_path,
        usecols=usecols,
        dtype=dtypes,
        parse_dates=["timestamp"],
        chunksize=chunksize,
        low_memory=False,
    ):
        chunk["symbol"] = chunk["symbol"].astype(str).str.strip().str.upper()
        sub = chunk.loc[chunk["symbol"] == symbol].copy()
        if min_timestamp is not None:
            sub = sub.loc[sub["timestamp"] > min_timestamp]
        if len(sub) == 0:
            continue
        yield sub


@st.cache_data(ttl=600, show_spinner=False)
def load_symbol_df(
    features_path: str,
    *,
    symbol: str,
    feature_cols: List[str],
    target_col: Optional[str],
    min_timestamp: Optional[pd.Timestamp],
) -> pd.DataFrame:
    available_cols = set(get_csv_columns_cached(features_path))
    price_cols = [c for c in ["open", "high", "low", "close", "volume"] if c in available_cols]

    needed = ["timestamp", "symbol"] + price_cols + feature_cols
    if target_col:
        needed.append(target_col)
    usecols = [c for c in list(dict.fromkeys(needed)) if c in available_cols]

    dtypes: Dict[str, str] = {"symbol": "string"}
    for c in feature_cols:
        if c in available_cols:
            dtypes[c] = "float32"
    for c in price_cols:
        dtypes[c] = "float32"
    if target_col and target_col in available_cols:
        dtypes[target_col] = "float32"

    frames = list(
        iter_symbol_rows(
            features_path,
            symbol=symbol,
            usecols=usecols,
            dtypes=dtypes,
            min_timestamp=min_timestamp,
        )
    )
    if not frames:
        return pd.DataFrame(columns=usecols)
    return pd.concat(frames, ignore_index=True)


def make_sequences_for_symbol(
    g: pd.DataFrame,
    feature_cols: List[str],
    target_col: Optional[str],
    seq_len: int,
    symbol_id: int,
) -> Tuple[np.ndarray, Optional[np.ndarray], np.ndarray, np.ndarray, np.ndarray]:
    g = g.sort_values("timestamp", kind="mergesort")
    x = g[feature_cols].to_numpy(dtype=np.float32)
    t = g["timestamp"].to_numpy()
    c = g["close"].to_numpy(dtype=np.float32)

    if target_col and target_col in g.columns:
        y = g[target_col].to_numpy(dtype=np.float32)
    else:
        y = None

    if len(g) <= seq_len:
        X = np.empty((0, seq_len, len(feature_cols)), dtype=np.float32)
        ts = np.empty((0,), dtype=object)
        sids = np.empty((0,), dtype=np.int32)
        close_now = np.empty((0,), dtype=np.float32)
        return X, y, ts, sids, close_now

    xs: List[np.ndarray] = []
    ys: List[float] = []
    ts: List[object] = []
    closes: List[float] = []

    for i in range(seq_len - 1, len(g)):
        xw = x[i - seq_len + 1 : i + 1]
        if np.isnan(xw).any():
            continue
        if y is not None:
            yw = float(y[i])
            if np.isnan(yw):
                continue
            ys.append(yw)
        xs.append(xw)
        ts.append(t[i])
        closes.append(float(c[i]))

    if not xs:
        X = np.empty((0, seq_len, len(feature_cols)), dtype=np.float32)
        ts_arr = np.empty((0,), dtype=object)
        sids = np.empty((0,), dtype=np.int32)
        close_now = np.empty((0,), dtype=np.float32)
        return X, None if y is None else np.empty((0,), dtype=np.float32), ts_arr, sids, close_now

    # Optimization: pre-allocate to avoid double memory during np.stack if possible
    # but np.stack is already quite efficient. The main issue is xs + X existing.
    X = np.stack(xs, axis=0)
    del xs # Free list of arrays immediately
    
    ts_arr = np.asarray(ts)
    del ts
    
    sids = np.full((len(X),), np.int32(symbol_id), dtype=np.int32)
    
    close_now = np.asarray(closes, dtype=np.float32)
    del closes
    
    y_arr = None if y is None else np.asarray(ys, dtype=np.float32)
    del ys
    
    gc.collect() # Force reclaim
    return X, y_arr, ts_arr, sids, close_now


def infer_predictions(model: tf.keras.Model, X: np.ndarray, sids: np.ndarray, batch_size: int = 1024) -> Dict[str, np.ndarray]:
    input_names = list(getattr(model, "input_names", []) or [])
    if not input_names:
        inferred: List[str] = []
        for t in list(getattr(model, "inputs", []) or []):
            name = getattr(t, "name", "")
            if name:
                inferred.append(name.split(":")[0])
        input_names = inferred

    x_key: Optional[str] = "x" if "x" in input_names else None
    sid_key: Optional[str] = None

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
            elif rank in (0, 1):
                if sid_key is None:
                    sid_key = tname

    if x_key is None or sid_key is None:
        raise ValueError(
            f"Could not determine input keys. model.input_names={getattr(model, 'input_names', None)}; "
            f"model.inputs={[getattr(t,'name',None) for t in getattr(model,'inputs', [])]}"
        )

    yraw = model.predict({x_key: X, sid_key: sids}, batch_size=batch_size, verbose=0)

    def _as_array(v):
        if isinstance(v, tf.Tensor):
            v = v.numpy()
        return np.asarray(v)

    # If the model returns named heads (e.g. {'ret': ..., 'dir': ...}), keep those.
    if isinstance(yraw, dict):
        out: Dict[str, np.ndarray] = {}
        if "ret" in yraw:
            out["ret"] = _as_array(yraw["ret"]).reshape(-1).astype(np.float32)
        if "dir" in yraw:
            out["dir"] = _as_array(yraw["dir"]).reshape(-1).astype(np.float32)
        if out:
            return out

    def _normalize_outputs(v) -> np.ndarray:
        # Keras predict can return: ndarray, list/tuple of ndarrays, dict of ndarrays, or scalar.
        if isinstance(v, dict):
            # Prefer common keys if present
            preferred_orders = [
                ["q10", "q50", "q90"],
                ["p10", "p50", "p90"],
                ["mu", "sigma"],
                ["y", "yhat"],
            ]
            keys = list(v.keys())
            order: List[str] = []
            for cand in preferred_orders:
                if all(k in v for k in cand):
                    order = cand
                    break
            if not order:
                order = sorted(keys)
            parts = []
            for k in order:
                a = _as_array(v[k])
                a = np.squeeze(a)
                if a.ndim == 0:
                    a = np.full((X.shape[0],), float(a), dtype=np.float32)
                if a.ndim == 1:
                    a = a[:, None]
                parts.append(a)
            return np.concatenate(parts, axis=1)

        if isinstance(v, (list, tuple)):
            parts = []
            for item in v:
                a = _as_array(item)
                a = np.squeeze(a)
                if a.ndim == 0:
                    a = np.full((X.shape[0],), float(a), dtype=np.float32)
                if a.ndim == 1:
                    a = a[:, None]
                parts.append(a)
            return np.concatenate(parts, axis=1) if parts else np.empty((X.shape[0], 0), dtype=np.float32)

        a = _as_array(v)
        a = np.squeeze(a)
        if a.ndim == 0:
            a = np.full((X.shape[0], 1), float(a), dtype=np.float32)
        elif a.ndim == 1:
            a = a[:, None]
        elif a.ndim > 2:
            # Some models return (batch, horizon, out_dim); take the last step.
            a = a[:, -1, :]
        return a

    yhat = _normalize_outputs(yraw)

    if yhat.ndim != 2:
        raise ValueError(f"Unexpected model output shape after normalize: {yhat.shape} (raw type={type(yraw)})")

    if yhat.shape[1] == 3:
        return {
            "q10": yhat[:, 0].astype(np.float32),
            "q50": yhat[:, 1].astype(np.float32),
            "q90": yhat[:, 2].astype(np.float32),
        }

    if yhat.shape[1] == 2:
        mu = yhat[:, 0].astype(np.float32)
        sigma = np.exp(yhat[:, 1]).astype(np.float32)
        return {"mu": mu, "sigma": sigma}

    if yhat.shape[1] == 1:
        return {"mu": yhat[:, 0].astype(np.float32)}

    raise ValueError(f"Unsupported model output dimension: {yhat.shape[1]}")


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


st.set_page_config(
    page_title="CryptoVision 360 | AI-Powered Crypto Analysis",
    page_icon="🔮",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Professional CSS styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }
    .sub-header {
        color: #888;
        font-size: 1rem;
        margin-bottom: 2rem;
    }
    .metric-card {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        padding: 1.2rem;
        border: 1px solid #333;
    }
    .signal-card {
        padding: 1.5rem;
        border-radius: 16px;
        text-align: center;
        font-size: 1.5rem;
        font-weight: bold;
    }
    .fear-greed-gauge {
        font-size: 3rem;
        font-weight: bold;
        text-align: center;
    }
    .risk-badge {
        display: inline-block;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-weight: 600;
    }
    div[data-testid="stMetricValue"] {
        font-size: 1.8rem;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        background-color: #1a1a2e;
        border-radius: 8px 8px 0 0;
        padding: 10px 20px;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .news-card {
        background: #1a1a2e;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        border-left: 5px solid #333;
        transition: transform 0.2s, background 0.2s;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .news-card:hover {
        transform: translateY(-5px);
        background: #242444;
    }
    .news-title {
        font-size: 1.2rem;
        font-weight: 600;
        color: #fff !important;
        text-decoration: none !important;
        margin-bottom: 0.8rem;
        display: block;
    }
    .news-meta {
        display: flex;
        gap: 15px;
        font-size: 0.85rem;
        color: #888;
        align-items: center;
        margin-top: 0.5rem;
    }
    .sentiment-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 0.75rem;
    }
    .bullish { background: #00C853; color: white; }
    .bearish { background: #D50000; color: white; }
    .neutral { background: #FFC107; color: black; }
    .source-tag {
        color: #667eea;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

st.sidebar.title("🔮 CryptoVision 360")
model_path = st.sidebar.text_input("Model path", value="cv360_investor_model.keras")
scaler_path = st.sidebar.text_input("Scaler path", value="scaler.json")
features_path = st.sidebar.text_input("Features CSV", value="cv360_features.csv")

val_end_str = st.sidebar.text_input("val_end (optional)", value="")
seq_len = int(st.sidebar.number_input("seq_len", min_value=8, max_value=512, value=72, step=1))
target_col = st.sidebar.text_input("Target col (optional)", value="")
batch_size = int(st.sidebar.number_input("predict batch_size", min_value=1, max_value=8192, value=1024, step=1))
lookback_days = int(st.sidebar.number_input("Lookback days (charts)", min_value=7, max_value=3650, value=365, step=1))
plot_points = int(st.sidebar.number_input("Plot points", min_value=200, max_value=20000, value=1000, step=100))
tech_mode = st.sidebar.selectbox("Technical chart mode", options=["Candlestick", "Line"], index=0)

st.sidebar.markdown("---")
st.sidebar.subheader("News sentiment")
default_cp_token = "4cd086bc8de6d4cb6d3fc10a1cf82c974b625896"
try:
    s_token = str(st.secrets.get("CRYPTOPANIC_TOKEN", ""))
    if s_token:
        default_cp_token = s_token
except Exception:
    pass

if default_cp_token == "4cd086bc8de6d4cb6d3fc10a1cf82c974b625896":
    env_token = os.environ.get("CRYPTOPANIC_TOKEN", "")
    if env_token:
        default_cp_token = env_token

cp_token = st.sidebar.text_input(
    "CryptoPanic auth_token",
    value=default_cp_token,
    type="password",
)
news_days = int(st.sidebar.number_input("News days back", min_value=7, max_value=3650, value=365, step=7))
news_limit_pages = int(st.sidebar.number_input("News pages", min_value=1, max_value=30, value=6, step=1))
news_enable = st.sidebar.checkbox("Enable news sentiment", value=True)

st.sidebar.markdown("---")
st.sidebar.subheader("Live price")
enable_live_price = st.sidebar.checkbox("Enable live price (CoinGecko)", value=True)
coingecko_id_override = st.sidebar.text_input("CoinGecko id override (optional)", value="")
realtime_price = st.sidebar.checkbox("Real-time price (1s)", value=False)
refresh_ms = int(st.sidebar.number_input("Refresh interval (ms)", min_value=500, max_value=10000, value=1000, step=250))
binance_pair = st.sidebar.text_input("Binance symbol pair (optional)", value="")
live_only_mode = st.sidebar.checkbox("Real-time mode: live price only (recommended)", value=True)

if not os.path.exists(scaler_path):
    st.error(f"Scaler file not found: {scaler_path}")
    st.stop()

scaler = load_json_cached(scaler_path)
symbol_to_id = _get_symbol_to_id(scaler)
if not symbol_to_id:
    st.error("No symbol mapping found in scaler.json (expected 'symbols' or 'symbol_to_id').")
    st.stop()

symbols = sorted(symbol_to_id.keys())
selected_symbol = st.sidebar.selectbox("Symbol", options=symbols, index=0)

# If user wants real-time updates, don't reload the whole dashboard each second.
if realtime_price and live_only_mode:
    st.title(f"{selected_symbol} Live Price")
    if st_autorefresh is None:
        st.warning("Real-time refresh requires 'streamlit-autorefresh'. Install requirements.txt and restart.")
    else:
        st_autorefresh(interval=refresh_ms, key="live_price_refresh")

    if enable_live_price:
        pair = binance_pair.strip().upper() or f"{selected_symbol.upper()}USDT"
        got = False
        try:
            live_b = fetch_binance_price(pair)
            lp = float(live_b["price"])
            st.metric("Live price (Binance)", f"{lp:,.6f}")
            got = True
        except Exception:
            got = False

        if not got:
            coin_id = coingecko_id_override.strip() or map_symbol_to_coingecko_id(selected_symbol)
            if not coin_id:
                st.info("Live price: could not map this symbol to CoinGecko id. Set 'CoinGecko id override' in sidebar.")
            else:
                try:
                    live = fetch_coingecko_price(coin_id)
                    lp = float(live["price"])
                    chg = float(live["change_24h"])
                    st.metric("Live price (USD)", f"{lp:,.6f}", delta=f"{chg:+.2f}% 24h")
                except Exception as e:
                    st.warning(f"Live price unavailable: {e}")

    st.stop()

if not os.path.exists(model_path):
    st.error(f"Model file not found: {model_path}")
    st.stop()
if not os.path.exists(features_path):
    st.error(f"Features CSV not found: {features_path}")
    st.stop()

model = load_model_cached(model_path)
expected_n = get_expected_n_features(model)
feature_cols_used = resolve_feature_cols_for_model(features_path, scaler, expected_n)

available_cols = set(get_csv_columns_cached(features_path))
tc = target_col.strip() if target_col.strip() else None
if not tc and "target_ret_12h" in available_cols:
    tc = "target_ret_12h"
val_end_ts = None
if val_end_str.strip():
    val_end_ts = pd.to_datetime(val_end_str.strip())

sid = int(symbol_to_id[selected_symbol])

# ============== MAIN HEADER ==============
st.markdown('<p class="main-header">🔮 CryptoVision 360</p>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">AI-Powered Cryptocurrency Analysis & Forecasting Platform</p>', unsafe_allow_html=True)

# Top metrics row
col1, col2, col3, col4 = st.columns(4)

# Live Price
live_price_val = None
live_change_val = 0.0
with col1:
    if enable_live_price:
        pair = binance_pair.strip().upper() or f"{selected_symbol.upper()}USDT"
        try:
            live_b = fetch_binance_price(pair)
            live_price_val = float(live_b["price"])
            st.metric(f"💰 {selected_symbol} Price", f"${live_price_val:,.4f}")
        except Exception:
            coin_id = coingecko_id_override.strip() or map_symbol_to_coingecko_id(selected_symbol)
            if coin_id:
                try:
                    live = fetch_coingecko_price(coin_id)
                    live_price_val = float(live["price"])
                    live_change_val = float(live["change_24h"])
                    st.metric(f"💰 {selected_symbol} Price", f"${live_price_val:,.4f}", f"{live_change_val:+.2f}%")
                except Exception:
                    st.metric(f"💰 {selected_symbol} Price", "N/A")
            else:
                st.metric(f"💰 {selected_symbol} Price", "N/A")

# Fear & Greed Index
with col2:
    fng = fetch_fear_greed_index()
    fng_value = fng["value"]
    fng_class = fng["classification"]
    if fng_value <= 25:
        fng_color = "#D50000"
        fng_emoji = "😱"
    elif fng_value <= 45:
        fng_color = "#F44336"
        fng_emoji = "😨"
    elif fng_value <= 55:
        fng_color = "#FFC107"
        fng_emoji = "😐"
    elif fng_value <= 75:
        fng_color = "#8BC34A"
        fng_emoji = "😊"
    else:
        fng_color = "#4CAF50"
        fng_emoji = "🤑"
    st.metric(f"{fng_emoji} Fear & Greed", f"{fng_value}", fng_class)

# Placeholder for Signal (will be calculated after predictions)
with col3:
    signal_placeholder = st.empty()
    signal_placeholder.metric("📊 AI Signal", "Loading...", "Analyzing...")

# Placeholder for Risk Score
with col4:
    risk_placeholder = st.empty()
    risk_placeholder.metric("⚠️ Risk Score", "Loading...", "Calculating...")

st.markdown("---")

# ============== TABS ==============
tab1, tab2, tab3, tab4 = st.tabs(["📊 Overview", "🔮 Predictions", "📈 Technical", "💬 Sentiment"])

# Real-time refresh
if realtime_price:
    if st_autorefresh is None:
        st.warning("Real-time refresh requires 'streamlit-autorefresh'. Install requirements.txt and restart.")
    else:
        st_autorefresh(interval=refresh_ms, key="live_price_refresh")


raw = load_symbol_df(
    features_path,
    symbol=selected_symbol,
    feature_cols=feature_cols_used,
    target_col=tc,
    min_timestamp=val_end_ts,
)

if len(raw) == 0:
    st.error("No rows found for symbol (check val_end / symbol).")
    st.stop()

if "close" not in raw.columns:
    st.error("CSV must contain 'close' column.")
    st.stop()

raw["symbol_id"] = np.int32(sid)
raw = raw.dropna(subset=["close"] + feature_cols_used + ([tc] if tc else [])).copy()
raw = raw.sort_values("timestamp", kind="mergesort")

# To avoid OOM, only build model windows for the visible chart range (+ a small context buffer)
max_ts_raw = None
if len(raw) > 0:
    max_ts_raw = pd.to_datetime(raw["timestamp"]).max()
if max_ts_raw is not None:
    # Capping: only predict for the last 30 days to avoid massive 3D arrays on low-RAM systems
    # 30 days is plenty for dashboard visualization.
    lookback_cap_days = min(int(lookback_days), 30)
    min_ts_plot_raw = max_ts_raw - pd.Timedelta(days=lookback_cap_days)
    # Keep enough history for seq_len context
    raw_for_model = raw.loc[raw["timestamp"] >= (min_ts_plot_raw - pd.Timedelta(hours=int(seq_len)))].copy()
else:
    raw_for_model = raw

scaled = apply_scaler(raw_for_model, feature_cols_used, scaler)
X, y_true, ts, sids, close_now = make_sequences_for_symbol(scaled, feature_cols_used, tc, seq_len, sid)
if len(X) == 0:
    st.error("No sequences created (not enough rows for seq_len or too many NaNs).")
    st.stop()

preds = infer_predictions(model, X, sids, batch_size=batch_size)
out = pd.DataFrame({"timestamp": pd.to_datetime(ts)})
if y_true is not None:
    out["y_true"] = y_true
target_scale = float(scaler.get("target_scale", 1.0) or 1.0)
if "ret" in preds:
    out["y_pred"] = preds["ret"] / target_scale
    if "dir" in preds:
        out["dir_prob_up"] = preds["dir"]
elif "q50" in preds:
    out["y_pred"] = preds["q50"]
    out["q10"] = preds["q10"]
    out["q90"] = preds["q90"]
else:
    out["y_pred"] = preds.get("mu")
    if "sigma" in preds:
        out["sigma"] = preds["sigma"]

max_ts = None
if len(out) > 0:
    max_ts = pd.to_datetime(out["timestamp"]).max()
if max_ts is not None:
    min_ts = max_ts - pd.Timedelta(days=int(lookback_days))
    out_plot = out.loc[out["timestamp"] >= min_ts].copy()
else:
    out_plot = out

# Calculate latest prediction for Signal Generator
latest_pred = float(out_plot["y_pred"].iloc[-1]) if len(out_plot) > 0 and "y_pred" in out_plot.columns else 0.0
latest_sigma = float(out_plot["sigma"].iloc[-1]) if "sigma" in out_plot.columns and len(out_plot) > 0 else None

# Calculate technical indicators for signal
plot_df = add_indicators(raw[["timestamp", "open", "high", "low", "close", "volume"]].copy())
latest_rsi = float(plot_df["rsi14"].iloc[-1]) if "rsi14" in plot_df.columns and len(plot_df) > 0 else None
latest_volatility = float(raw_for_model["logret_1h"].std()) if "logret_1h" in raw_for_model.columns else None

# Generate Signal
signal_data = generate_trading_signal(latest_pred, latest_rsi, None, latest_volatility)
risk_data = calculate_risk_score(latest_volatility, None, latest_rsi, latest_sigma)

# Update top-level metrics
signal_placeholder.metric("📊 AI Signal", signal_data['signal'], f"Conf: {signal_data['confidence']}%")
risk_placeholder.metric("⚠️ Risk Score", f"{risk_data['score']}/100", risk_data['level'])

# ============== TAB 1: OVERVIEW ==============
with tab1:
    st.subheader(f"📊 {selected_symbol} Market Overview")
    
    # Signal and Risk display
    sig_col, risk_col, model_col = st.columns(3)
    
    with sig_col:
        st.markdown("### 🤖 AI Trading Signal")
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, {signal_data['color']}22, {signal_data['color']}44); 
             padding: 20px; border-radius: 16px; text-align: center; border: 2px solid {signal_data['color']};">
            <div style="font-size: 2rem; font-weight: bold; color: {signal_data['color']};">{signal_data['signal']}</div>
            <div style="color: #888; margin-top: 10px;">Confidence: {signal_data['confidence']}%</div>
        </div>
        """, unsafe_allow_html=True)
        if signal_data["reasons"]:
            st.caption("Based on: " + ", ".join(signal_data["reasons"]))
    
    with risk_col:
        st.markdown("### ⚠️ Risk Assessment")
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, {risk_data['color']}22, {risk_data['color']}44); 
             padding: 20px; border-radius: 16px; text-align: center; border: 2px solid {risk_data['color']};">
            <div style="font-size: 2rem; font-weight: bold; color: {risk_data['color']};">{risk_data['score']}/100</div>
            <div style="color: #888; margin-top: 10px;">Risk Level: {risk_data['level']}</div>
        </div>
        """, unsafe_allow_html=True)
        if risk_data["factors"]:
            st.caption("Factors: " + ", ".join(risk_data["factors"]))
    
    with model_col:
        st.markdown("### 📈 Model Info")
        st.metric("Sequence Length", seq_len)
        st.metric("Features Used", len(feature_cols_used))
        st.metric("Prediction Horizon", f"{scaler.get('horizon_hours', 12)}H")
    
    st.markdown("---")
    
    # Latest prediction summary
    st.markdown("### 🔮 Latest AI Prediction")
    pred_col1, pred_col2, pred_col3 = st.columns(3)
    with pred_col1:
        pred_pct = latest_pred * 100
        st.metric("Predicted Return (12H)", f"{pred_pct:+.2f}%")
    with pred_col2:
        if live_price_val and latest_pred:
            predicted_price = live_price_val * (1 + latest_pred)
            st.metric("Predicted Price", f"${predicted_price:,.4f}")
        else:
            st.metric("Predicted Price", "N/A")
    with pred_col3:
        if latest_sigma:
            st.metric("Prediction Uncertainty (σ)", f"{latest_sigma*100:.2f}%")
        else:
            st.metric("Prediction Uncertainty", "N/A")

# ============== TAB 2: PREDICTIONS ==============
with tab2:
    st.subheader("🔮 AI Predictions - Actual vs Predicted")
    ap_col1, ap_col2 = st.columns([1, 1])
    with ap_col1:
        x_mode = st.radio("X axis", options=["Time Steps", "Timestamp"], index=0, horizontal=True)
    with ap_col2:
        show_percent = st.checkbox("Show as %", value=True)
    
    pred_series = pd.to_numeric(out_plot.get("y_pred"), errors="coerce")
    true_series = pd.to_numeric(out_plot.get("y_true"), errors="coerce") if "y_true" in out_plot.columns else None
    
    if len(out_plot) == 0:
        st.warning("No points to plot for the selected lookback window.")
    else:
        if pred_series is None or pred_series.isna().all():
            st.error("Predicted series is empty/NaN (model output could not be mapped).")
        else:
            if x_mode == "Time Steps":
                x = np.arange(len(out_plot))
                x_title = "Time Steps"
            else:
                x = out_plot["timestamp"]
                x_title = "Timestamp"

            if int(plot_points) > 0 and len(out_plot) > int(plot_points):
                x = x[-int(plot_points) :]
                pred_series = pred_series.iloc[-int(plot_points) :]
                if true_series is not None:
                    true_series = true_series.iloc[-int(plot_points) :]

            scale = 100.0 if bool(show_percent) else 1.0
            y_title = "Return (%)" if bool(show_percent) else "Return"

            fig_ap = go.Figure()
            if true_series is not None:
                fig_ap.add_trace(
                    go.Scatter(
                        x=x,
                        y=true_series.to_numpy(dtype=np.float32) * scale,
                        mode="lines",
                        name="Actual",
                        line=dict(color="#1f77b4", width=2),
                    )
                )

            fig_ap.add_trace(
                go.Scatter(
                    x=x,
                    y=pred_series.to_numpy(dtype=np.float32) * scale,
                    mode="lines",
                    name="Predicted",
                    line=dict(color="#ff7f0e", width=2, dash="dash"),
                )
            )

            fig_ap.add_hline(y=0, line_width=1, line_dash="dash", line_color="black")

            horizon = scaler.get("horizon_hours")
            horizon_txt = "" if horizon is None else f" {int(horizon)}H"
            fig_ap.update_layout(
                title=f"{selected_symbol} - Actual vs Predicted{horizon_txt} Return",
                height=420,
                margin=dict(l=10, r=10, t=40, b=10),
                plot_bgcolor="white",
                legend=dict(x=0.99, y=0.99, xanchor="right", yanchor="top"),
            )
            fig_ap.update_xaxes(title=x_title, showgrid=True, gridcolor="rgba(0,0,0,0.08)")
            fig_ap.update_yaxes(title=y_title, showgrid=True, gridcolor="rgba(0,0,0,0.08)")
            st.plotly_chart(fig_ap, use_container_width=True)

            if "dir_prob_up" in out_plot.columns:
                st.caption(f"Latest direction probability (up): {float(out_plot['dir_prob_up'].iloc[-1]):.2f}")

# ============== TAB 4: SENTIMENT ==============
with tab4:
    st.subheader("💬 News Sentiment Analysis")
    if not news_enable:
        st.info("📢 Enable 'News sentiment' in the sidebar to see sentiment analysis.")
    elif not cp_token.strip():
        st.info("🔑 Set CryptoPanic auth_token in the sidebar (or env var CRYPTOPANIC_TOKEN).")
    elif AutoTokenizer is None or TFAutoModelForSequenceClassification is None:
        st.error("FinBERT requires 'transformers' + 'sentencepiece'. Install requirements.txt then restart Streamlit.")
    else:
        cache_dir = _ensure_cache_dir()
        cache_path = os.path.join(cache_dir, f"cryptopanic_{selected_symbol}_news.parquet")

        refresh = st.button("🔄 Refresh news now")

        _news_source_options = ["All", "CryptoPanic", "Top Publications"]
        _default_news_source_index = 0
        if "news_source" in st.session_state and st.session_state["news_source"] in _news_source_options:
            _default_news_source_index = _news_source_options.index(st.session_state["news_source"])
        news_source = st.radio(
            "Select News Source",
            options=_news_source_options,
            index=_default_news_source_index,
            horizontal=True,
            key="news_source",
        )
        
        use_cache = os.path.exists(cache_path) and not refresh
        if use_cache:
            news = pd.read_parquet(cache_path)
            if "api_source" not in news.columns:
                news["api_source"] = "CryptoPanic"
            news["published_at"] = pd.to_datetime(news["published_at"], utc=True, errors="coerce")
        else:
            with st.spinner("Fetching news articles..."):
                all_news = []
                
                # Fetch CryptoPanic
                cp_news = fetch_cryptopanic_posts(
                    token=cp_token.strip(),
                    coin=selected_symbol,
                    days_back=int(news_days),
                    max_pages=int(news_limit_pages),
                )
                if len(cp_news) > 0:
                    cp_news["api_source"] = "CryptoPanic"
                    all_news.append(cp_news)
                
                # Fetch Top Publications RSS
                rss_news = fetch_rss_news(selected_symbol)
                if len(rss_news) > 0:
                    rss_news["api_source"] = "Top Publications"
                    all_news.append(rss_news)
                
                if not all_news:
                    news = pd.DataFrame()
                else:
                    news = pd.concat(all_news, ignore_index=True)
                    news = news.sort_values("published_at", ascending=False)
                    news = news.drop_duplicates(subset=["title"], keep="first")
                    
                if len(news) > 0:
                    news.to_parquet(cache_path, index=False)

        # Source Status Indicators
        status_cols = st.columns(3)
        sources_found = news["api_source"].unique() if "api_source" in news.columns else []
        
        with status_cols[0]:
            st.caption("📡 **CryptoPanic**: " + ("✅ Active" if "CryptoPanic" in sources_found else "⏳ Waiting"))
        with status_cols[1]:
            st.caption("📡 **Top Publications**: " + ("✅ Active" if "Top Publications" in sources_found else "⏳ Waiting"))
        with status_cols[2]:
            st.caption("🤖 **AI Sentiment**: ✅ Ready")

        if news_source != "All":
            news = news[news["api_source"] == news_source]

        # Check for fallback
        is_viewing_fallback = False
        if not news.empty and "is_fallback" in news.columns:
            if news["is_fallback"].any():
                is_viewing_fallback = True
                st.info(f"💡 Note: No specific news found for **{selected_symbol}** on {news_source}. Showing **Global Crypto Market News** to keep you informed.")

        if len(news) == 0:
            st.warning("No news returned for this coin (or API limit reached).")
        else:
            # score sentiment using full text
            with st.spinner("Scoring sentiment with FinBERT (analyzing full content)..."):
                # Use full_text if available, else title
                texts_to_score = news["full_text"].fillna(news["title"]).astype(str).tolist()
                s = score_finbert(texts_to_score, batch_size=16)
            news = news.copy()
            news["sentiment"] = s
            daily = build_daily_sentiment(news)

            # Sentiment metrics row
            sent_col1, sent_col2, sent_col3 = st.columns(3)
            with sent_col1:
                latest_mean = float(np.nanmean(news["sentiment"].to_numpy(dtype=np.float32)))
                sent_color = "#4CAF50" if latest_mean > 0 else "#F44336" if latest_mean < 0 else "#FFC107"
                st.metric("📊 Average Sentiment", f"{latest_mean:+.3f}")
            with sent_col2:
                positive_count = (news["sentiment"] > 0.1).sum()
                st.metric("📈 Positive News", f"{positive_count}")
            with sent_col3:
                negative_count = (news["sentiment"] < -0.1).sum()
                st.metric("📉 Negative News", f"{negative_count}")

            if len(daily) > 0:
                fig_s = go.Figure()
                fig_s.add_trace(
                    go.Scatter(
                        x=pd.to_datetime(daily["date"]),
                        y=daily["sentiment"],
                        mode="lines+markers",
                        name="Daily sentiment",
                        line=dict(color="#667eea", width=2),
                        marker=dict(size=4),
                    )
                )
                fig_s.add_hline(y=0, line_width=1, line_dash="dash", line_color="gray")
                fig_s.update_layout(
                    title="📈 Daily Sentiment Trend",
                    height=300,
                    margin=dict(l=10, r=10, t=40, b=10),
                    plot_bgcolor="white",
                )
                fig_s.update_xaxes(showgrid=True, gridcolor="rgba(0,0,0,0.08)")
                fig_s.update_yaxes(showgrid=True, gridcolor="rgba(0,0,0,0.08)", range=[-1, 1])
                st.plotly_chart(fig_s, use_container_width=True)

            st.markdown("### 📰 Latest Headlines")
            
            def display_news_card(item):
                sent_val = item['sentiment']
                sent_class = "bullish" if sent_val > 0.1 else "bearish" if sent_val < -0.1 else "neutral"
                sent_label = "BULLISH" if sent_val > 0.1 else "BEARISH" if sent_val < -0.1 else "NEUTRAL"
                
                time_str = item['published_at'].strftime("%Y-%m-%d %H:%M")
                
                # Truncate title if too long
                title = item['title']
                if len(title) > 100:
                    title = title[:97] + "..."
                
                fallback_badge = '<span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 10px;">MARKET NEWS</span>' if item.get('is_fallback') else ''
                
                st.markdown(f"""<div class="news-card" style="border-left-color: {'#4CAF50' if sent_val > 0.1 else '#F44336' if sent_val < -0.1 else '#FFC107'}">
<a href="{item['url']}" target="_blank" class="news-title">{title}</a>
<div class="news-meta">
{fallback_badge}
<span class="sentiment-badge {sent_class}">{sent_label} ({sent_val:+.2f})</span>
<span class="source-tag">🌐 {item['source']}</span>
<span>📅 {time_str}</span>
</div>
</div>""", unsafe_allow_html=True)

            # Limit to 15 news cards for clean UI
            for _, row in news.head(15).iterrows():
                display_news_card(row)

# ============== TAB 3: TECHNICAL ==============
with tab3:
    plot_df_tech = add_indicators(raw[[c for c in raw.columns if c in {"timestamp", "open", "high", "low", "close", "volume"}]].copy())
    plot_df_tech = plot_df_tech.sort_values("timestamp", kind="mergesort")
    if max_ts is not None:
        plot_df_tech = plot_df_tech.loc[plot_df_tech["timestamp"] >= min_ts].copy()
    
    st.subheader("📈 Technical Analysis Charts")
    
    has_ohlc = all(c in plot_df_tech.columns for c in ["open", "high", "low", "close"])
    rows = 4
    row_heights = [0.55, 0.15, 0.15, 0.15]
    if tech_mode == "Line":
        price_cols = [c for c in ["close", "sma20", "ema20", "bb_mid", "bb_up", "bb_dn"] if c in plot_df_tech.columns]
        if price_cols and "timestamp" in plot_df_tech.columns:
            st.markdown("### Price + overlays")
            st.line_chart(plot_df_tech.set_index("timestamp")[price_cols])
        if "volume" in plot_df_tech.columns:
            st.markdown("### Volume")
            st.bar_chart(plot_df_tech.set_index("timestamp")[["volume"]])
        if "rsi14" in plot_df_tech.columns:
            st.markdown("### RSI")
            st.line_chart(plot_df_tech.set_index("timestamp")[["rsi14"]])
        macd_cols = [c for c in ["macd", "macd_signal", "macd_hist"] if c in plot_df_tech.columns]
        if macd_cols:
            st.markdown("### MACD")
            st.line_chart(plot_df_tech.set_index("timestamp")[macd_cols])
    else:
        fig = make_subplots(
            rows=rows,
            cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            row_heights=row_heights,
            specs=[[{"secondary_y": False}], [{"secondary_y": False}], [{"secondary_y": False}], [{"secondary_y": False}]],
        )

        if has_ohlc:
            fig.add_trace(
                go.Candlestick(
                    x=plot_df_tech["timestamp"],
                    open=plot_df_tech["open"],
                    high=plot_df_tech["high"],
                    low=plot_df_tech["low"],
                    close=plot_df_tech["close"],
                    name="OHLC",
                ),
                row=1,
                col=1,
            )
        else:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["close"], mode="lines", name="close"), row=1, col=1)

        if "sma20" in plot_df_tech.columns:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["sma20"], mode="lines", name="SMA20"), row=1, col=1)
        if "ema20" in plot_df_tech.columns:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["ema20"], mode="lines", name="EMA20"), row=1, col=1)
        if "bb_up" in plot_df_tech.columns and "bb_dn" in plot_df_tech.columns:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["bb_up"], mode="lines", name="BB_up", line=dict(width=1)), row=1, col=1)
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["bb_dn"], mode="lines", name="BB_dn", line=dict(width=1)), row=1, col=1)

        if "volume" in plot_df_tech.columns:
            fig.add_trace(go.Bar(x=plot_df_tech["timestamp"], y=plot_df_tech["volume"], name="volume"), row=2, col=1)

        if "rsi14" in plot_df_tech.columns:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["rsi14"], mode="lines", name="RSI14"), row=3, col=1)
            fig.add_hline(y=70, line_width=1, line_dash="dash", row=3, col=1)
            fig.add_hline(y=30, line_width=1, line_dash="dash", row=3, col=1)

        if "macd" in plot_df_tech.columns and "macd_signal" in plot_df_tech.columns:
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["macd"], mode="lines", name="MACD"), row=4, col=1)
            fig.add_trace(go.Scatter(x=plot_df_tech["timestamp"], y=plot_df_tech["macd_signal"], mode="lines", name="Signal"), row=4, col=1)
            if "macd_hist" in plot_df_tech.columns:
                fig.add_trace(go.Bar(x=plot_df_tech["timestamp"], y=plot_df_tech["macd_hist"], name="Hist"), row=4, col=1)

        fig.update_layout(
            height=900,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis_rangeslider_visible=False,
            legend=dict(orientation="h"),
        )

        st.plotly_chart(fig, use_container_width=True)


