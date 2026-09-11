"""
catalyst.py — Catalyst Intelligence Engine

Scans news headlines to detect market-moving events:
- Earnings (reports, guidance, beats/misses)
- Analyst actions (upgrades, downgrades, price targets)
- FDA / regulatory decisions
- Insider trading (buys, sells)
- M&A activity
- Product launches / partnerships
- Macro events (Fed, tariffs, rates)

Returns structured catalyst data with type, impact, confidence, and metadata.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Catalyst Types & Keyword Patterns
# ---------------------------------------------------------------------------

CATALYST_PATTERNS = {
    "earnings": {
        "keywords": [
            "earnings", "quarterly results", "revenue", "eps", "earnings report",
            "earnings beat", "earnings miss", "profit warning", "guidance",
            "revenue forecast", "financial results", "net income", "gross margin",
            "same-store sales", "comp sales", "top line", "bottom line",
        ],
        "impact_boost": {
            "positive": ["beat", "exceed", "surpass", "raise", "upgrade", "record", "strong", "surge"],
            "negative": ["miss", "disappoint", "cut", "lower", "weak", "decline", "warning", "down"],
        },
        "base_confidence": 0.85,
    },
    "analyst": {
        "keywords": [
            "analyst", "price target", "upgrade", "downgrade", "initiates coverage",
            "reiterates", "outperform", "underperform", "overweight", "underweight",
            "buy rating", "sell rating", "hold rating", "sector outperform",
            "street consensus", "wall street", "research note",
        ],
        "impact_boost": {
            "positive": ["upgrade", "buy", "outperform", "overweight", "raise", "bullish", "higher target"],
            "negative": ["downgrade", "sell", "underperform", "underweight", "cut", "bearish", "lower target"],
        },
        "base_confidence": 0.80,
    },
    "fda_regulatory": {
        "keywords": [
            "fda", "fda approval", "fda rejection", "fda warning", "clinical trial",
            "phase 3", "phase 2", "emergency use", "eu authorization", "regulatory",
            "sec filing", "antitrust", "patent", "lawsuit", "settlement",
        ],
        "impact_boost": {
            "positive": ["approve", "approval", "authorize", "clear", "positive", "success", "favorable"],
            "negative": ["reject", "rejection", "warning", "deny", "fail", "unfavorable", "concern"],
        },
        "base_confidence": 0.75,
    },
    "insider": {
        "keywords": [
            "insider buying", "insider selling", "ceo buys", "ceo sells",
            "cfo buys", "cfo sells", "director buys", "director sells",
            "insider transaction", "form 4", "10b5-1", "open market purchase",
            "executive purchase", "board member",
        ],
        "impact_boost": {
            "positive": ["buy", "purchase", "acquire", "bullish"],
            "negative": ["sell", "dispose", "dump", "bearish"],
        },
        "base_confidence": 0.70,
    },
    "merger_acquisition": {
        "keywords": [
            "merger", "acquisition", "takeover", "buyout", "acquire",
            "deal", "bid", "tender offer", "goes private", "spin-off",
            "divest", "joint venture", "strategic partnership",
        ],
        "impact_boost": {
            "positive": ["acquire", "buyout", "premium", "deal", "partnership", "joint venture"],
            "negative": ["divest", "spin-off", "antitrust", "block", "reject bid"],
        },
        "base_confidence": 0.80,
    },
    "product": {
        "keywords": [
            "product launch", "new product", "unveil", "release", "announce",
            "partnership", "contract", "deal", "agreement", "expansion",
            "market entry", "ipoh", "innovation", "breakthrough",
        ],
        "impact_boost": {
            "positive": ["launch", "unveil", "partnership", "deal", "expand", "innovation", "breakthrough"],
            "negative": ["delay", "recall", "discontinue", "fail", "setback"],
        },
        "base_confidence": 0.65,
    },
    "macro": {
        "keywords": [
            "federal reserve", "fed rate", "interest rate", "inflation",
            "gdp", "jobs report", "unemployment", "tariff", "trade war",
            "recession", "stimulus", "fiscal policy", "monetary policy",
            "cpi", "ppi", "nonfarm payrolls",
        ],
        "impact_boost": {
            "positive": ["cut", "stimulus", "dovish", "easing", "growth", "strong"],
            "negative": ["hike", "tighten", "hawkish", "recession", "tariff", "war"],
        },
        "base_confidence": 0.60,
    },
}


# ---------------------------------------------------------------------------
# Catalyst Detection
# ---------------------------------------------------------------------------

@dataclass
class Catalyst:
    """A detected market-moving event."""
    type: str
    title: str
    source: str
    url: str
    published_at: str
    impact: str  # positive, negative, neutral
    confidence: float
    matched_keywords: List[str]


def _detect_catalyst_type(title: str, full_text: str) -> Optional[Dict[str, Any]]:
    """Detect the most likely catalyst type from text."""
    text = f"{title} {full_text}".lower()
    best_match = None
    best_score = 0

    for cat_type, config in CATALYST_PATTERNS.items():
        score = 0
        matched = []
        for kw in config["keywords"]:
            if kw in text:
                score += 1
                matched.append(kw)

        if score > best_score:
            best_score = score
            best_match = {
                "type": cat_type,
                "score": score,
                "matched_keywords": matched,
                "config": config,
            }

    return best_match


def _determine_impact(
    text: str,
    impact_boost: Dict[str, List[str]],
) -> str:
    """Determine if the catalyst is positive, negative, or neutral."""
    text_lower = text.lower()
    pos_count = sum(1 for kw in impact_boost.get("positive", []) if kw in text_lower)
    neg_count = sum(1 for kw in impact_boost.get("negative", []) if kw in text_lower)

    if pos_count > neg_count:
        return "positive"
    elif neg_count > pos_count:
        return "negative"
    return "neutral"


def detect_catalysts(
    articles: List[Dict[str, Any]],
    min_confidence: float = 0.5,
) -> List[Dict[str, Any]]:
    """
    Scan news articles and detect catalysts.
    Returns list of catalyst dicts sorted by confidence descending.
    """
    catalysts = []

    for article in articles:
        title = article.get("title", "")
        full_text = article.get("full_text", "") or article.get("description", "")
        text = f"{title} {full_text}"

        match = _detect_catalyst_type(title, full_text)
        if match is None:
            continue

        cat_type = match["type"]
        config = match["config"]
        impact = _determine_impact(text, config["impact_boost"])

        # Confidence: base + keyword density bonus
        keyword_density = min(match["score"] / 3.0, 1.0)
        confidence = config["base_confidence"] * (0.7 + 0.3 * keyword_density)

        if confidence < min_confidence:
            continue

        catalysts.append({
            "type": cat_type,
            "title": title,
            "source": article.get("source", "Unknown"),
            "url": article.get("url", "#"),
            "published_at": article.get("published_at", ""),
            "impact": impact,
            "confidence": round(confidence, 3),
            "matched_keywords": match["matched_keywords"][:5],
        })

    # Sort by confidence descending
    catalysts.sort(key=lambda c: c["confidence"], reverse=True)

    # Deduplicate by type+title (keep highest confidence)
    seen = set()
    deduped = []
    for c in catalysts:
        key = f"{c['type']}:{c['title'][:50]}"
        if key not in seen:
            seen.add(key)
            deduped.append(c)

    return deduped


def get_catalyst_summary(catalysts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate a summary of detected catalysts."""
    if not catalysts:
        return {
            "total": 0,
            "by_type": {},
            "sentiment_breakdown": {"positive": 0, "negative": 0, "neutral": 0},
            "top_catalyst": None,
            "summary_text": "No significant catalysts detected in recent news.",
        }

    by_type = {}
    for c in catalysts:
        t = c["type"]
        by_type[t] = by_type.get(t, 0) + 1

    sentiment = {"positive": 0, "negative": 0, "neutral": 0}
    for c in catalysts:
        sentiment[c["impact"]] = sentiment.get(c["impact"], 0) + 1

    top = catalysts[0] if catalysts else None
    top_str = f"{top['type'].replace('_', ' ').title()} ({top['impact']})" if top else "None"

    return {
        "total": len(catalysts),
        "by_type": by_type,
        "sentiment_breakdown": sentiment,
        "top_catalyst": top,
        "summary_text": (
            f"Detected {len(catalysts)} catalyst(s). "
            f"Top: {top_str}. "
            f"Types: {', '.join(f'{k}({v})' for k, v in by_type.items())}."
        ),
    }
