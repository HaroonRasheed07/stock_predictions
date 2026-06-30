# opportunity.py — Opportunity Score engine for the Discovery Dashboard
"""
Scans and ranks assets based on an Opportunity Score built from:
Trend strength, technical momentum, sentiment, volatility, and volume.
"""

import pandas as pd
from typing import List, Dict, Any, Optional

from utils import load_data, _get_cached_scan, _set_cached_scan
from indicators import calculate_indicators
from sentiment import analyze_sentiment
from volatility import get_volatility_summary
from risk import calculate_trend_strength
from multi_asset import get_asset_info


def calculate_opportunity_score(ticker: str, period: str = "1y", use_cache: bool = True) -> Optional[Dict[str, Any]]:
    """
    Calculate an opportunity score (0-100) for a given ticker.
    Combines multiple signals into a single score.
    """
    try:
        # Check scan cache first
        if use_cache:
            cache_key = f"opportunity_{ticker}_{period}"
            cached = _get_cached_scan(cache_key)
            if cached is not None:
                return cached
        # 1. Load data and indicators
        df = load_data(ticker, period)
        if df is None or len(df) < 50:
            return None

        df_ind_records = calculate_indicators(df)
        df_ind = pd.DataFrame(df_ind_records)
        
        asset_info = get_asset_info(ticker)
        has_volume = asset_info["has_volume"]
        asset_class = asset_info["asset_class"]

        score = 50.0  # Base neutral score
        factors = []

        # 2. Trend Strength (Weight: 25%)
        # 0-100 score where >50 is bullish, <50 is bearish
        trend_score = calculate_trend_strength(df_ind)
        trend_impact = (trend_score - 50) * 0.50  # -25 to +25 points
        score += trend_impact
        factors.append({
            "name": "Trend Strength",
            "impact": round(trend_impact, 1),
            "value": "Bullish" if trend_score > 60 else "Bearish" if trend_score < 40 else "Neutral",
            "detail": f"Score: {trend_score:.1f}/100"
        })

        # 3. Technical Momentum (RSI) (Weight: 20%)
        latest_rsi = df_ind["RSI"].iloc[-1]
        rsi_impact = 0.0
        rsi_val = "Neutral"
        
        if latest_rsi < 30:
            rsi_impact = 20.0  # Oversold = high opportunity for reversal
            rsi_val = "Oversold (Bullish)"
        elif latest_rsi < 40:
            rsi_impact = 10.0
            rsi_val = "Weak (Slight Bullish)"
        elif latest_rsi > 70:
            rsi_impact = -20.0 # Overbought = high risk, low opportunity
            rsi_val = "Overbought (Bearish)"
        elif latest_rsi > 60:
            rsi_impact = -10.0
            rsi_val = "Strong (Slight Bearish)"

        score += rsi_impact
        factors.append({
            "name": "Momentum (RSI)",
            "impact": round(rsi_impact, 1),
            "value": rsi_val,
            "detail": f"RSI: {latest_rsi:.1f}"
        })

        # 4. Volatility (Weight: 20%)
        vol_summary = get_volatility_summary(df, has_volume)
        daily_vol = vol_summary["daily_volatility"]
        
        # We prefer moderate volatility (opportunity). Too low = boring, Too high = gambling.
        vol_impact = 0.0
        vol_val = "Moderate"
        if 15 <= daily_vol <= 35:
            vol_impact = 20.0
            vol_val = "Optimal (Moderate)"
        elif 35 < daily_vol <= 50:
            vol_impact = 5.0
            vol_val = "High Risk/Reward"
        elif daily_vol > 50:
            vol_impact = -15.0
            vol_val = "Extreme Risk"
        else:
            vol_impact = -5.0
            vol_val = "Low Movement"
            
        score += vol_impact
        factors.append({
            "name": "Volatility",
            "impact": round(vol_impact, 1),
            "value": vol_val,
            "detail": f"{daily_vol:.1f}% Daily Vol"
        })

        # 5. Sentiment (Weight: 20%)
        # For performance, we might skip sentiment for large scans or use a cached version
        # Let's assume we do a quick fetch
        sentiment_impact = 0.0
        sentiment_val = "Neutral"
        sentiment_score = 0.0
        
        try:
            # We wrap this in a try-except to avoid failing the whole scan if news API is down
            sent_res = analyze_sentiment(ticker)
            sentiment_score = sent_res["score"]
            sentiment_impact = sentiment_score * 20.0  # -20 to +20
            sentiment_val = sent_res["label"]
        except Exception:
            pass

        score += sentiment_impact
        factors.append({
            "name": "Sentiment",
            "impact": round(sentiment_impact, 1),
            "value": sentiment_val,
            "detail": f"Score: {sentiment_score:.2f}"
        })

        # 6. Relative Volume (Weight: 15%) - If available
        vol_impact_score = 0.0
        if has_volume:
            rel_vol = vol_summary["relative_volume"]["relative_volume"]
            vol_class = vol_summary["relative_volume"]["classification"]
            
            # High volume supports the current trend
            if rel_vol >= 1.5:
                vol_impact_score = 15.0 if trend_score > 50 else -15.0
            elif rel_vol >= 1.2:
                vol_impact_score = 5.0 if trend_score > 50 else -5.0
                
            score += vol_impact_score
            factors.append({
                "name": "Relative Volume",
                "impact": round(vol_impact_score, 1),
                "value": vol_class,
                "detail": f"{rel_vol:.1f}x Avg"
            })
        else:
            # Redistribute weight if no volume
            score *= (100 / 85)

        # Final bounds check
        final_score = max(0.0, min(100.0, score))
        
        # Price and change for display
        close_prices = df["Close"]
        if isinstance(close_prices, pd.DataFrame):
            close_prices = close_prices.iloc[:, 0]
        
        current_price = float(close_prices.iloc[-1])
        prev_price = float(close_prices.iloc[-2]) if len(close_prices) > 1 else current_price
        change_val = current_price - prev_price
        change_pct = (change_val / prev_price * 100) if prev_price != 0 else 0

        result = {
            "ticker": ticker,
            "name": asset_info["name"],
            "asset_class": asset_class,
            "score": round(final_score, 1),
            "price": current_price,
            "change": change_val,
            "change_percent": change_pct,
            "factors": factors
        }
        
        # Cache the result
        if use_cache:
            cache_key = f"opportunity_{ticker}_{period}"
            _set_cached_scan(cache_key, result)
        
        return result
    except Exception as e:
        print(f"Error scoring {ticker}: {e}")
        return None


def scan_watchlist(tickers: List[str], period: str = "1y") -> List[Dict[str, Any]]:
    """
    Scan a list of tickers and return them ranked by opportunity score.
    """
    results = []
    # For a real production app, we'd use asyncio or concurrent.futures here
    # Since we are keeping it simple for the API, we iterate synchronously
    for ticker in tickers:
        score_data = calculate_opportunity_score(ticker, period)
        if score_data:
            results.append(score_data)
            
    # Sort descending by score
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
