"""
news_engine/engine.py — Main orchestrator for Stock Vanta News Engine.

One ticker → one canonical article set → one canonical sentiment snapshot.
"""

import logging
import time
import threading
import sqlite3
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from .models import (
    NewsArticle, SentimentSnapshot, CompanyIdentity,
    SentimentStatus, SentimentLabel, SourceType, ProviderResult, ArticleSentiment,
)
from .company_resolver import resolve_company, get_search_queries
from .providers import get_all_providers, get_provider_status, NewsProvider
from .finbert_sentiment import analyze_sentiment_batch, is_model_available

logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────────

RELEVANCE_THRESHOLD = 0.15        # Minimum relevance to include article
MIN_RELEVANT_ARTICLES = 2        # Minimum for "sufficient" status
SNAPSHOT_TTL_SECONDS = 900       # 15 minutes
LOOKBACK_DAYS = 3                # How far back to look for news
MAX_ARTICLES_PER_TICKER = 20     # Cap per ticker
METHODOLOGY_VERSION = "3"        # Bump when rule engine changes materially

# Recency weights (hours since publication)
RECENCY_WEIGHTS = [
    (24, 1.0),      # < 24 hours: full weight
    (72, 0.7),      # 1-3 days: strong
    (168, 0.4),     # 3-7 days: moderate
    (336, 0.2),     # 7-14 days: weak
]

# Source quality weights
SOURCE_QUALITY = {
    "marketaux": 0.9,
    "newsdata": 0.7,
    "currents": 0.7,
    "gdelt": 0.6,
    "rss": 0.8,  # RSS from established publishers
}


# ─── L1 Memory Cache ────────────────────────────────────────────────────────

_l1_cache: Dict[str, Tuple[float, SentimentSnapshot]] = {}
_l1_lock = threading.Lock()


def _l1_get(ticker: str) -> Optional[SentimentSnapshot]:
    with _l1_lock:
        if ticker in _l1_cache:
            ts, snapshot = _l1_cache[ticker]
            if time.time() - ts < SNAPSHOT_TTL_SECONDS:
                return snapshot
    return None


def _l1_set(ticker: str, snapshot: SentimentSnapshot):
    with _l1_lock:
        _l1_cache[ticker] = (time.time(), snapshot)


# ─── SQLite Cache ───────────────────────────────────────────────────────────

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "news_cache.db")


def _init_db():
    """Initialize SQLite tables for news cache."""
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sentiment_snapshots (
            ticker TEXT PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS news_articles (
            article_id TEXT PRIMARY KEY,
            ticker TEXT NOT NULL,
            title TEXT,
            description TEXT,
            url TEXT,
            publisher TEXT,
            published_at TEXT,
            provider TEXT,
            source_type TEXT,
            relevance_score REAL,
            finbert_label TEXT,
            finbert_positive REAL,
            finbert_neutral REAL,
            finbert_negative REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_ticker ON news_articles(ticker)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_expires ON sentiment_snapshots(expires_at)")
    conn.commit()
    conn.close()


def _sqlite_get_snapshot(ticker: str) -> Optional[SentimentSnapshot]:
    """Get cached snapshot from SQLite. Rejects stale methodology versions."""
    try:
        conn = sqlite3.connect(_DB_PATH)
        row = conn.execute(
            "SELECT snapshot_json, expires_at FROM sentiment_snapshots WHERE ticker = ?",
            (ticker,)
        ).fetchone()
        conn.close()

        if row:
            expires_at = datetime.fromisoformat(row[1])
            if datetime.now(timezone.utc) < expires_at:
                data = json.loads(row[0])
                # Reject old methodology versions
                cached_version = data.get("methodology_version", "1")
                if cached_version != METHODOLOGY_VERSION:
                    logger.info(f"[CACHE] {ticker} rejecting old methodology v{cached_version} (current=v{METHODOLOGY_VERSION})")
                    return None
                return _dict_to_snapshot(data)
    except Exception as e:
        logger.debug(f"[CACHE] SQLite read error for {ticker}: {e}")
    return None


def _sqlite_set_snapshot(ticker: str, snapshot: SentimentSnapshot):
    """Store snapshot in SQLite."""
    try:
        conn = sqlite3.connect(_DB_PATH)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=SNAPSHOT_TTL_SECONDS * 3)  # SQLite TTL 3x longer
        conn.execute(
            "INSERT OR REPLACE INTO sentiment_snapshots (ticker, snapshot_json, generated_at, expires_at) VALUES (?, ?, ?, ?)",
            (ticker, json.dumps(_snapshot_to_dict(snapshot)), now.isoformat(), expires_at.isoformat())
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.debug(f"[CACHE] SQLite write error for {ticker}: {e}")


def _snapshot_to_dict(s: SentimentSnapshot) -> dict:
    """Serialize snapshot to dict for JSON storage."""
    return {
        "ticker": s.ticker,
        "company_name": s.company_name,
        "status": s.status.value,
        "label": s.label.value,
        "score": s.score,
        "positive_pct": s.positive_pct,
        "neutral_pct": s.neutral_pct,
        "negative_pct": s.negative_pct,
        "article_count": s.article_count,
        "relevant_article_count": s.relevant_article_count,
        "source_count": s.source_count,
        "providers_attempted": s.providers_attempted,
        "articles": [
            {
                "article_id": a.article_id,
                "title": a.title,
                "url": a.url,
                "publisher": a.publisher,
                "published_at": a.published_at,
                "relevance_score": a.relevance_score,
                "finbert_label": a.finbert_label,
                "finbert_positive": a.finbert_positive,
                "finbert_neutral": a.finbert_neutral,
                "finbert_negative": a.finbert_negative,
                "weighted_score": a.weighted_score,
                "source_quality": a.source_quality,
            }
            for a in s.articles[:MAX_ARTICLES_PER_TICKER]
        ],
        "generated_at": s.generated_at,
        "data_freshness": s.data_freshness,
        "methodology_version": s.methodology_version,
        "provider_summary": s.provider_summary,
    }


def _dict_to_snapshot(d: dict) -> SentimentSnapshot:
    """Deserialize snapshot from dict."""
    articles = [
        ArticleSentiment(
            article_id=a.get("article_id", ""),
            title=a.get("title", ""),
            url=a.get("url", ""),
            publisher=a.get("publisher", ""),
            published_at=a.get("published_at", ""),
            relevance_score=a.get("relevance_score", 0.0),
            finbert_label=a.get("finbert_label", ""),
            finbert_positive=a.get("finbert_positive", 0.0),
            finbert_neutral=a.get("finbert_neutral", 0.0),
            finbert_negative=a.get("finbert_negative", 0.0),
            weighted_score=a.get("weighted_score", 0.0),
            source_quality=a.get("source_quality", 0.5),
        )
        for a in d.get("articles", [])
    ]

    status_str = d.get("status", "insufficient")
    try:
        status = SentimentStatus(status_str)
    except ValueError:
        status = SentimentStatus.INSUFFICIENT

    label_str = d.get("label", "Insufficient News")
    try:
        label = SentimentLabel(label_str)
    except ValueError:
        label = SentimentLabel.INSUFFICIENT

    return SentimentSnapshot(
        ticker=d.get("ticker", ""),
        company_name=d.get("company_name", ""),
        status=status,
        label=label,
        score=d.get("score", 0.0),
        positive_pct=d.get("positive_pct", 0.0),
        neutral_pct=d.get("neutral_pct", 0.0),
        negative_pct=d.get("negative_pct", 0.0),
        article_count=d.get("article_count", 0),
        relevant_article_count=d.get("relevant_article_count", 0),
        source_count=d.get("source_count", 0),
        providers_attempted=d.get("providers_attempted", []),
        articles=articles,
        generated_at=d.get("generated_at", ""),
        data_freshness=d.get("data_freshness", "fresh"),
        methodology_version=d.get("methodology_version", "3"),
        provider_summary=d.get("provider_summary", {}),
    )


# ─── Single-Flight Lock ────────────────────────────────────────────────────

_inflight: Dict[str, threading.Event] = {}
_inflight_lock = threading.Lock()


def _acquire_inflight(ticker: str) -> bool:
    """Try to acquire single-flight lock. Returns True if this caller should compute."""
    with _inflight_lock:
        if ticker in _inflight:
            return False  # Another request is already computing
        _inflight[ticker] = threading.Event()
        return True


def _release_inflight(ticker: str):
    with _inflight_lock:
        event = _inflight.pop(ticker, None)
        if event:
            event.set()


def _wait_for_inflight(ticker: str, timeout: float = 15.0) -> Optional[SentimentSnapshot]:
    """Wait for another request to finish computing."""
    with _inflight_lock:
        event = _inflight.get(ticker)
    if event:
        event.wait(timeout=timeout)
        # After wait, check L1 cache
        return _l1_get(ticker)
    return None


# ─── Relevance Scoring ──────────────────────────────────────────────────────

def _score_relevance(article: NewsArticle, company: CompanyIdentity) -> float:
    """
    Score article relevance to the target company.
    Returns 0.0-1.0. Higher = more relevant.
    """
    text = f"{article.title} {article.description}".lower()
    score = 0.0

    # Check provider entity matches (Marketaux etc.)
    if article.matched_entities:
        for entity_name in article.matched_entities:
            entity_lower = entity_name.lower()
            if company.canonical_name.lower() in entity_lower or entity_lower in company.canonical_name.lower():
                score += 0.5  # Strong entity match
                break
            if company.ticker.lower() in entity_lower:
                score += 0.4
                break
            for alias in company.aliases:
                if alias.lower() in entity_lower:
                    score += 0.3
                    break

    # Explicit ticker match (strongest signal in text)
    if company.ticker.lower() in text:
        score += 0.3

    # Canonical company name match
    if company.canonical_name.lower() in text:
        score += 0.25

    # Short name match
    if company.short_name and company.short_name.lower() in text:
        score += 0.2

    # Alias match
    for alias in company.aliases:
        if alias.lower() in text:
            score += 0.15
            break

    # Penalize if title is very generic and doesn't mention company
    title_lower = article.title.lower()
    if score < 0.1 and not any(w in title_lower for w in [company.ticker.lower(), company.canonical_name.lower()]):
        score *= 0.3

    return min(1.0, score)


def _get_recency_weight(published_at: str) -> float:
    """Calculate recency weight based on publication time."""
    if not published_at:
        return 0.3  # Unknown age gets moderate weight

    try:
        # Try parsing various formats
        for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
            try:
                pub_time = datetime.strptime(published_at[:19], fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        else:
            return 0.3

        age_hours = (datetime.now(timezone.utc) - pub_time).total_seconds() / 3600

        for max_hours, weight in RECENCY_WEIGHTS:
            if age_hours <= max_hours:
                return weight
        return 0.1  # Very old
    except Exception:
        return 0.3


# ─── Deduplication ──────────────────────────────────────────────────────────

def _deduplicate_articles(articles: List[NewsArticle]) -> List[NewsArticle]:
    """
    Deduplicate articles across providers.
    Groups similar articles and keeps the highest-quality representative.
    """
    if not articles:
        return []

    # Build fingerprint groups
    seen_fingerprints: Dict[str, int] = {}
    groups: Dict[int, List[NewsArticle]] = {}
    group_counter = 0

    for article in articles:
        # Normalize for fingerprinting
        import re
        norm_title = re.sub(r'[^a-z0-9]', '', article.title.lower())
        norm_url = re.sub(r'[?#].*', '', article.url.lower())
        fp = hashlib.md5(f"{norm_title}|{norm_url}".encode()).hexdigest()

        if fp in seen_fingerprints:
            gid = seen_fingerprints[fp]
            groups[gid].append(article)
        else:
            seen_fingerprints[fp] = group_counter
            groups[group_counter] = [article]
            group_counter += 1

    # Fuzzy dedup: only merge if titles are VERY similar AND from same publisher
    titles = [(i, re.sub(r'[^a-z0-9]', '', a.title.lower()), a.publisher.lower()) for i, a in enumerate(articles)]
    for i in range(len(titles)):
        for j in range(i + 1, len(titles)):
            t1 = titles[i][1]
            t2 = titles[j][1]
            pub1 = titles[i][2]
            pub2 = titles[j][2]
            # Only merge if same publisher AND high title similarity
            if t1 and t2 and pub1 == pub2 and _jaccard_similarity(t1, t2) > 0.7:
                gid1 = seen_fingerprints.get(
                    hashlib.md5(f"{t1}|{re.sub(r'[?#].*', '', articles[titles[i][0]].url.lower())}".encode()).hexdigest(),
                    -1
                )
                gid2 = seen_fingerprints.get(
                    hashlib.md5(f"{t2}|{re.sub(r'[?#].*', '', articles[titles[j][0]].url.lower())}".encode()).hexdigest(),
                    -1
                )
                if gid1 != gid2 and gid1 >= 0 and gid2 >= 0:
                    # Merge groups
                    groups[gid1].extend(groups.pop(gid2, []))
                    for a in groups[gid1]:
                        seen_fingerprints[
                            hashlib.md5(f"{re.sub(r'[^a-z0-9]', '', a.title.lower())}|{re.sub(r'[?#].*', '', a.url.lower())}".encode()).hexdigest()
                        ] = gid1

    # Select best representative from each group
    representatives = []
    for gid, group in groups.items():
        # Sort by: provider quality, has description, recency
        group.sort(key=lambda a: (
            -SOURCE_QUALITY.get(a.provider, 0.5),
            -len(a.description),
            a.published_at or "",
        ), reverse=True)
        best = group[0]
        best.duplicate_group = gid
        best.is_representative = True
        representatives.append(best)

    return representatives


def _jaccard_similarity(s1: str, s2: str) -> float:
    """Simple Jaccard similarity for short strings."""
    set1 = set(s1)
    set2 = set(s2)
    intersection = set1 & set2
    union = set1 | set2
    return len(intersection) / len(union) if union else 0.0


import hashlib


# ─── Weighted Aggregation ───────────────────────────────────────────────────

def _aggregate_sentiment(articles: List[ArticleSentiment]) -> Tuple[float, SentimentLabel, float, float, float, int, int, int]:
    """
    Compute weighted canonical sentiment from scored articles.
    Returns: (score, label, positive_pct, neutral_pct, negative_pct, positive_count, neutral_count, negative_count)

    DISTRIBUTION = simple article COUNTS (not weighted).
    WEIGHTED SCORE = relevance × recency × source_quality × model_confidence.
    These are intentionally separate concepts.
    """
    if not articles:
        return 0.0, SentimentLabel.INSUFFICIENT, 0.0, 0.0, 0.0, 0, 0, 0

    total_weight = 0.0
    weighted_score = 0.0

    # Article COUNT distribution (simple, not weighted)
    positive_count = 0
    negative_count = 0
    neutral_count = 0

    for article in articles:
        # article_weight = relevance × recency × source_quality × model_confidence
        recency = _get_recency_weight(article.published_at)
        source_q = article.source_quality
        confidence = max(article.finbert_positive, article.finbert_negative, article.finbert_neutral)

        weight = article.relevance_score * recency * source_q * confidence
        if weight < 0.01:
            weight = 0.01  # Minimum weight for any retained article

        total_weight += weight

        # FinBERT label → numeric score for weighted overall
        label_score = article.finbert_positive - article.finbert_negative
        weighted_score += label_score * weight

        # Count-based distribution (one vote per article)
        if article.finbert_label == "positive":
            positive_count += 1
        elif article.finbert_label == "negative":
            negative_count += 1
        else:
            neutral_count += 1

    if total_weight == 0:
        return 0.0, SentimentLabel.INSUFFICIENT, 0.0, 0.0, 0.0, 0, 0, 0

    final_score = max(-1.0, min(1.0, weighted_score / total_weight))

    # Distribution = simple article count percentages (MUST sum to 100%)
    total = positive_count + neutral_count + negative_count
    if total > 0:
        positive_pct = round((positive_count / total) * 100, 1)
        negative_pct = round((negative_count / total) * 100, 1)
        neutral_pct = round(100.0 - positive_pct - negative_pct, 1)  # Ensure sum = 100
    else:
        positive_pct = neutral_pct = negative_pct = 0.0

    # Label determination with minimum evidence
    if len(articles) < MIN_RELEVANT_ARTICLES:
        label = SentimentLabel.INSUFFICIENT
    elif final_score > 0.15:
        label = SentimentLabel.POSITIVE
    elif final_score < -0.15:
        label = SentimentLabel.NEGATIVE
    else:
        label = SentimentLabel.NEUTRAL

    return final_score, label, positive_pct, neutral_pct, negative_pct, positive_count, neutral_count, negative_count


# ─── Main Pipeline ──────────────────────────────────────────────────────────

def get_sentiment_snapshot(
    ticker: str,
    force_refresh: bool = False,
) -> SentimentSnapshot:
    """
    Get the canonical sentiment snapshot for a ticker.

    Pipeline:
    1. Check L1 cache → return if fresh
    2. Check SQLite cache → promote to L1 if fresh
    3. Acquire single-flight lock
    4. Fetch from providers (adaptive fallback)
    5. Score relevance
    6. Deduplicate
    7. Run FinBERT
    8. Aggregate weighted sentiment
    9. Store in L1 + SQLite
    10. Return canonical snapshot
    """
    ticker = ticker.upper().strip()
    start_time = time.perf_counter()

    # 1. L1 cache check
    if not force_refresh:
        cached = _l1_get(ticker)
        if cached:
            cached.data_freshness = "fresh"
            logger.info(f"[ENGINE] {ticker} L1 cache HIT")
            return cached

    # 2. SQLite cache check
    if not force_refresh:
        sqlite_cached = _sqlite_get_snapshot(ticker)
        if sqlite_cached:
            sqlite_cached.data_freshness = "fresh"
            _l1_set(ticker, sqlite_cached)
            logger.info(f"[ENGINE] {ticker} SQLite cache HIT")
            return sqlite_cached

    # 3. Single-flight: if another request is computing, wait
    if not _acquire_inflight(ticker):
        logger.info(f"[ENGINE] {ticker} waiting for inflight request")
        result = _wait_for_inflight(ticker, timeout=20.0)
        if result:
            return result
        # If still nothing after wait, proceed to compute

    try:
        # 4. Resolve company identity
        company = resolve_company(ticker)
        logger.info(f"[ENGINE] {ticker} resolved to {company.canonical_name}")

        # 5. Fetch from providers
        providers = get_all_providers()
        all_articles: List[NewsArticle] = []
        provider_results: Dict[str, Any] = {}

        for provider in providers:
            if not provider.is_available():
                provider_results[provider.name] = {"status": "skipped", "count": 0}
                continue

            try:
                result = provider.fetch(
                    ticker=ticker,
                    company=company,
                    lookback_days=LOOKBACK_DAYS,
                    max_results=10,
                )
                provider_results[provider.name] = {
                    "status": "success" if result.success else f"error: {result.error}",
                    "count": len(result.articles),
                    "latency_ms": round(result.latency_ms, 1),
                }
                if result.articles:
                    all_articles.extend(result.articles)
                    logger.info(f"[ENGINE] {provider.name} returned {len(result.articles)} articles for {ticker}")

                # Sufficiency check: if we have enough, stop expensive providers
                if len(all_articles) >= 15:
                    logger.info(f"[ENGINE] {ticker} sufficient articles ({len(all_articles)}), stopping provider fan-out")
                    break

            except Exception as e:
                provider_results[provider.name] = {"status": f"error: {e}", "count": 0}
                logger.warning(f"[ENGINE] {provider.name} error for {ticker}: {e}")
                continue

        logger.info(f"[ENGINE] {ticker} collected {len(all_articles)} raw articles from {len([p for p in providers if p.is_available()])} providers")

        # 6. Score relevance
        for article in all_articles:
            article.relevance_score = _score_relevance(article, company)

        # Filter by relevance
        relevant = [a for a in all_articles if a.relevance_score >= RELEVANCE_THRESHOLD]
        logger.info(f"[ENGINE] {ticker} {len(relevant)} relevant articles after filtering (threshold={RELEVANCE_THRESHOLD})")

        # 7. Deduplicate
        unique_articles = _deduplicate_articles(relevant)
        logger.info(f"[ENGINE] {ticker} {len(unique_articles)} unique articles after dedup")

        # 8. Determine status
        if not all_articles:
            status = SentimentStatus.NEWS_UNAVAILABLE
            label = SentimentLabel.UNAVAILABLE
        elif not unique_articles:
            status = SentimentStatus.NO_RELEVANT_NEWS
            label = SentimentLabel.INSUFFICIENT
        elif len(unique_articles) < MIN_RELEVANT_ARTICLES:
            status = SentimentStatus.INSUFFICIENT
            label = SentimentLabel.INSUFFICIENT
        else:
            status = SentimentStatus.SUFFICIENT
            label = SentimentLabel.NEUTRAL  # Will be updated after FinBERT

        # 9. Run FinBERT (only if we have enough articles)
        article_sentiments: List[ArticleSentiment] = []

        if unique_articles and is_model_available():
            # Run FinBERT in batches
            finbert_inputs = [
                {"title": a.title, "description": a.description}
                for a in unique_articles
            ]
            finbert_results = analyze_sentiment_batch(finbert_inputs)

            for article, fb in zip(unique_articles, finbert_results):
                article.finbert_label = fb["label"]
                article.finbert_positive = fb["positive"]
                article.finbert_neutral = fb["neutral"]
                article.finbert_negative = fb["negative"]

                # Source quality
                source_q = SOURCE_QUALITY.get(article.provider, 0.5)
                if article.source_type == SourceType.COMPANY_OFFICIAL:
                    source_q = 1.0
                elif article.source_type == SourceType.REGULATORY:
                    source_q = 0.9

                article_sentiments.append(ArticleSentiment(
                    article_id=article.id,
                    title=article.title,
                    url=article.url,
                    publisher=article.publisher,
                    published_at=article.published_at,
                    relevance_score=article.relevance_score,
                    finbert_label=article.finbert_label,
                    finbert_positive=article.finbert_positive,
                    finbert_neutral=article.finbert_neutral,
                    finbert_negative=article.finbert_negative,
                    source_quality=source_q,
                ))
        elif unique_articles:
            # No FinBERT — use finance-specific rule engine
            _parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if _parent_dir not in sys.path:
                sys.path.insert(0, _parent_dir)
            try:
                from shared_sentiment import score_article as _score_article
            except ImportError:
                # Fallback: inline minimal scoring
                def _score_article(title, description=""):
                    t = (title + " " + description).lower()
                    pos = sum(1 for k in ['beats', 'raises', 'record', 'upgrade', 'growth', 'profit', 'surge'] if k in t)
                    neg = sum(1 for k in ['misses', 'cuts', 'downgrade', 'weak', 'loss', 'crash', 'decline'] if k in t)
                    total = pos + neg
                    if total == 0: return {"label": "neutral", "score": 0.0, "positive_count": 0, "negative_count": 0, "events": ["GENERAL"]}
                    s = (pos - neg) / total
                    return {"label": "positive" if s > 0.15 else "negative" if s < -0.15 else "neutral", "score": s, "positive_count": pos, "negative_count": neg, "events": ["GENERAL"]}

            for article in unique_articles:
                result = _score_article(article.title, article.description)
                fb_label = result["label"]
                fb_pos = max(0.1, 0.5 + result["score"] * 0.4)
                fb_neg = max(0.1, 0.5 - result["score"] * 0.4)
                fb_neu = max(0.1, 1.0 - fb_pos - fb_neg)
                # Normalize
                total = fb_pos + fb_neg + fb_neu
                fb_pos /= total
                fb_neg /= total
                fb_neu /= total

                article.finbert_label = fb_label
                article.finbert_positive = round(fb_pos, 4)
                article.finbert_negative = round(fb_neg, 4)
                article.finbert_neutral = round(fb_neu, 4)

                source_q = SOURCE_QUALITY.get(article.provider, 0.5)
                article_sentiments.append(ArticleSentiment(
                    article_id=article.id,
                    title=article.title,
                    url=article.url,
                    publisher=article.publisher,
                    published_at=article.published_at,
                    relevance_score=article.relevance_score,
                    finbert_label=fb_label,
                    finbert_positive=fb_pos,
                    finbert_negative=fb_neg,
                    finbert_neutral=fb_neu,
                    source_quality=source_q,
                ))

        # 10. Aggregate
        if article_sentiments:
            score, agg_label, pos_pct, neu_pct, neg_pct, pos_count, neu_count, neg_count = _aggregate_sentiment(article_sentiments)
            if status == SentimentStatus.SUFFICIENT:
                label = agg_label
        else:
            score = 0.0
            agg_label = SentimentLabel.INSUFFICIENT
            pos_pct = neu_pct = neg_pct = 0.0
            pos_count = neu_count = neg_count = 0

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # 11. Build snapshot
        providers_attempted = [name for name, r in provider_results.items() if r.get("status") != "skipped"]
        sources = list(set(a.publisher for a in unique_articles if a.publisher))

        snapshot = SentimentSnapshot(
            ticker=ticker,
            company_name=company.canonical_name,
            status=status,
            label=agg_label if status == SentimentStatus.SUFFICIENT else label,
            score=score,
            positive_pct=round(pos_pct, 1),
            neutral_pct=round(neu_pct, 1),
            negative_pct=round(neg_pct, 1),
            article_count=len(all_articles),
            relevant_article_count=len(unique_articles),
            source_count=len(sources),
            providers_attempted=providers_attempted,
            articles=article_sentiments[:MAX_ARTICLES_PER_TICKER],
            news_headlines=[
                {"title": a.title, "source": a.publisher, "url": a.url, "published_at": a.published_at}
                for a in article_sentiments[:10]
            ],
            data_freshness="fresh",
            provider_summary=provider_results,
            methodology_version=METHODOLOGY_VERSION,
        )
        snapshot.news_impact_summary += f" Processing time: {elapsed_ms:.0f}ms."

        # 12. Store in caches
        _l1_set(ticker, snapshot)
        _sqlite_set_snapshot(ticker, snapshot)

        logger.info(
            f"[ENGINE] {ticker} DONE: {snapshot.status.value} | "
            f"score={snapshot.score:.3f} | label={snapshot.label.value} | "
            f"articles={snapshot.relevant_article_count}/{snapshot.article_count} | "
            f"sources={snapshot.source_count} | {elapsed_ms:.0f}ms"
        )

        return snapshot

    except Exception as e:
        logger.error(f"[ENGINE] {ticker} pipeline error: {e}")
        import traceback
        traceback.print_exc()
        return SentimentSnapshot(
            ticker=ticker,
            status=SentimentStatus.ERROR,
            label=SentimentLabel.ERROR,
        )
    finally:
        _release_inflight(ticker)


# ─── Public API ─────────────────────────────────────────────────────────────

def get_sentiment_for_api(ticker: str) -> Dict[str, Any]:
    """Public API: returns snapshot as legacy-compatible dict."""
    snapshot = get_sentiment_snapshot(ticker)
    return snapshot.to_legacy_dict()


def get_news_provider_status() -> Dict[str, Dict[str, Any]]:
    """Public API: return provider health."""
    providers = get_all_providers()
    return get_provider_status(providers)


# Initialize DB on import
try:
    _init_db()
except Exception as e:
    logger.warning(f"[ENGINE] Failed to initialize news cache DB: {e}")
