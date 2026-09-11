"""
watchlist_monitor.py — Intelligent Watchlist Monitor

Detects meaningful changes in watchlist stocks:
- Price moves beyond threshold (configurable %)
- Volume spikes (relative to 20-day average)
- RSI extremes (overbought/oversold)
- Trend changes (SMA crossovers)
- Sentiment shifts (new catalysts detected)

Returns a prioritized list of alerts sorted by significance.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed


# ---------------------------------------------------------------------------
# Alert Thresholds
# ---------------------------------------------------------------------------

PRICE_CHANGE_THRESHOLD = 3.0      # % — alert if daily move exceeds this
VOLUME_SPIKE_THRESHOLD = 2.0      # x — alert if volume > 2x 20-day avg
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70


# ---------------------------------------------------------------------------
# Individual Alert Checkers
# ---------------------------------------------------------------------------

def _check_price_move(df: pd.DataFrame, ticker: str) -> List[Dict[str, Any]]:
    """Detect significant price moves."""
    alerts = []
    if len(df) < 2:
        return alerts

    closes = df["Close"].astype(float)
    current = float(closes.iloc[-1])
    prev = float(closes.iloc[-2])
    pct_change = ((current - prev) / prev) * 100 if prev > 0 else 0

    if abs(pct_change) >= PRICE_CHANGE_THRESHOLD:
        direction = "up" if pct_change > 0 else "down"
        alerts.append({
            "type": "price_move",
            "ticker": ticker,
            "severity": "high" if abs(pct_change) > 5 else "medium",
            "message": f"{ticker} moved {direction} {abs(pct_change):.1f}% (${prev:.2f} → ${current:.2f})",
            "value": round(pct_change, 2),
            "direction": direction,
        })
    return alerts


def _check_volume_spike(df: pd.DataFrame, ticker: str) -> List[Dict[str, Any]]:
    """Detect volume spikes relative to 20-day average."""
    alerts = []
    if "Volume" not in df.columns or len(df) < 20:
        return alerts

    vol = df["Volume"].astype(float)
    current_vol = float(vol.iloc[-1])
    avg_vol = float(vol.rolling(20).mean().iloc[-1])

    if avg_vol > 0:
        ratio = current_vol / avg_vol
        if ratio >= VOLUME_SPIKE_THRESHOLD:
            alerts.append({
                "type": "volume_spike",
                "ticker": ticker,
                "severity": "high" if ratio > 3 else "medium",
                "message": f"{ticker} volume {ratio:.1f}x above 20-day average",
                "value": round(ratio, 2),
                "direction": "up",
            })
    return alerts


def _check_rsi_extremes(df: pd.DataFrame, ticker: str) -> List[Dict[str, Any]]:
    """Detect RSI overbought/oversold conditions."""
    alerts = []
    if "RSI" not in df.columns or len(df) < 14:
        return alerts

    rsi = float(df["RSI"].iloc[-1])

    if rsi <= RSI_OVERSOLD:
        alerts.append({
            "type": "rsi_oversold",
            "ticker": ticker,
            "severity": "medium",
            "message": f"{ticker} RSI oversold at {rsi:.1f} — potential bounce",
            "value": round(rsi, 1),
            "direction": "up",
        })
    elif rsi >= RSI_OVERBOUGHT:
        alerts.append({
            "type": "rsi_overbought",
            "ticker": ticker,
            "severity": "medium",
            "message": f"{ticker} RSI overbought at {rsi:.1f} — potential pullback",
            "value": round(rsi, 1),
            "direction": "down",
        })
    return alerts


def _check_trend_change(df: pd.DataFrame, ticker: str) -> List[Dict[str, Any]]:
    """Detect SMA crossover (golden/death cross)."""
    alerts = []
    if not all(c in df.columns for c in ["SMA20", "SMA50"]) or len(df) < 2:
        return alerts

    sma20_now = float(df["SMA20"].iloc[-1])
    sma50_now = float(df["SMA50"].iloc[-1])
    sma20_prev = float(df["SMA20"].iloc[-2])
    sma50_prev = float(df["SMA50"].iloc[-2])

    if np.isnan(sma20_now) or np.isnan(sma50_now) or np.isnan(sma20_prev) or np.isnan(sma50_prev):
        return alerts

    # Golden cross
    if sma20_now > sma50_now and sma20_prev <= sma50_prev:
        alerts.append({
            "type": "golden_cross",
            "ticker": ticker,
            "severity": "high",
            "message": f"{ticker} golden cross — SMA20 crossed above SMA50",
            "value": 1,
            "direction": "up",
        })
    # Death cross
    elif sma20_now < sma50_now and sma20_prev >= sma50_prev:
        alerts.append({
            "type": "death_cross",
            "ticker": ticker,
            "severity": "high",
            "message": f"{ticker} death cross — SMA20 crossed below SMA50",
            "value": -1,
            "direction": "down",
        })
    return alerts


# ---------------------------------------------------------------------------
# Main Monitor
# ---------------------------------------------------------------------------

def scan_watchlist_intelligent(
    tickers: List[str],
    period: str = "1y",
) -> Dict[str, Any]:
    """
    Scan watchlist for meaningful changes across all alert types.
    Returns prioritized alerts sorted by severity.
    """
    from utils import load_data
    from indicators import calculate_indicators

    all_alerts: List[Dict[str, Any]] = []
    ticker_summaries = {}

    def _scan_single(ticker: str):
        try:
            df = load_data(ticker, period)
            if df is None or df.empty:
                return ticker, [], {}

            df_ind_records = calculate_indicators(df)
            df_ind = pd.DataFrame(df_ind_records)

            alerts = []
            alerts.extend(_check_price_move(df_ind, ticker))
            alerts.extend(_check_volume_spike(df_ind, ticker))
            alerts.extend(_check_rsi_extremes(df_ind, ticker))
            alerts.extend(_check_trend_change(df_ind, ticker))

            # Summary stats
            closes = df_ind["Close"].astype(float)
            current_price = float(closes.iloc[-1])
            prev_price = float(closes.iloc[-2]) if len(closes) > 1 else current_price
            pct = ((current_price - prev_price) / prev_price * 100) if prev_price > 0 else 0

            summary = {
                "ticker": ticker,
                "price": round(current_price, 2),
                "change_pct": round(pct, 2),
                "alert_count": len(alerts),
            }
            return ticker, alerts, summary
        except Exception:
            return ticker, [], {"ticker": ticker, "price": 0, "change_pct": 0, "alert_count": 0}

    # Parallel scan
    with ThreadPoolExecutor(max_workers=min(len(tickers), 10)) as executor:
        futures = {executor.submit(_scan_single, t): t for t in tickers}
        for future in as_completed(futures):
            ticker, alerts, summary = future.result()
            all_alerts.extend(alerts)
            ticker_summaries[ticker] = summary

    # Sort alerts: high severity first, then by type
    severity_order = {"high": 0, "medium": 1, "low": 2}
    all_alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    # Summary stats
    high_count = sum(1 for a in all_alerts if a["severity"] == "high")
    medium_count = sum(1 for a in all_alerts if a["severity"] == "medium")

    return {
        "alerts": all_alerts,
        "ticker_summaries": ticker_summaries,
        "total_alerts": len(all_alerts),
        "high_severity": high_count,
        "medium_severity": medium_count,
        "summary_text": (
            f"Scanned {len(tickers)} tickers. "
            f"{len(all_alerts)} alerts: {high_count} high, {medium_count} medium."
        ),
    }
