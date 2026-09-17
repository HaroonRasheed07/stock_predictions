"""
news_engine/finbert_sentiment.py — FinBERT financial sentiment inference.

Uses ProsusAI/finbert via transformers.pipeline.
Singleton model instance — shared across all requests.
"""

import logging
import threading
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Global singleton — loaded once, reused
_model = None
_model_lock = threading.Lock()
_model_loaded = False


def _load_model():
    """Lazy-load FinBERT model. Thread-safe singleton."""
    global _model, _model_loaded
    if _model_loaded:
        return _model

    with _model_lock:
        if _model_loaded:
            return _model
        try:
            import torch  # noqa: F401 — ensure torch is importable
            from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
            logger.info("[FINBERT] Loading ProsusAI/finbert model...")
            _model = pipeline(
                "sentiment-analysis",
                model="ProsusAI/finbert",
                tokenizer="ProsusAI/finbert",
                top_k=None,
                truncation=True,
                max_length=512,
            )
            _model_loaded = True
            logger.info("[FINBERT] Model loaded successfully.")
            return _model
        except Exception as e:
            logger.error(f"[FINBERT] Failed to load model: {e}")
            _model_loaded = True  # Mark as attempted to avoid retries
            return None


def _build_text(title: str, description: str) -> str:
    """Build optimal NLP input from headline + description."""
    title = (title or "").strip()
    desc = (description or "").strip()

    # Clean HTML artifacts
    import re
    title = re.sub(r'<[^>]+>', '', title)
    desc = re.sub(r'<[^>]+>', '', desc)

    # Prefer title + short description, avoid duplication
    if desc and len(desc) > 10:
        # Check if description already contains the title
        if title.lower() in desc.lower():
            text = desc[:512]
        else:
            text = f"{title}. {desc[:400]}"
    else:
        text = title[:512]

    return text.strip()


def analyze_sentiment_batch(
    articles: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    """
    Analyze sentiment for a batch of articles.

    Each article dict should have:
    - title: str
    - description: str (optional)

    Returns list of dicts with:
    - label: "positive" | "negative" | "neutral"
    - positive: float
    - negative: float
    - neutral: float
    """
    model = _load_model()
    if model is None:
        # Fallback: return neutral for all
        return [
            {"label": "neutral", "positive": 0.33, "negative": 0.33, "neutral": 0.34}
            for _ in articles
        ]

    results = []
    texts = [_build_text(a.get("title", ""), a.get("description", "")) for a in articles]

    try:
        # Batch inference for efficiency
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch = [t for t in batch if t.strip()]  # Remove empty texts

            if not batch:
                results.extend([
                    {"label": "neutral", "positive": 0.33, "negative": 0.33, "neutral": 0.34}
                    for _ in range(len(texts[i:i + batch_size]))
                ])
                continue

            outputs = model(batch)

            for output in outputs:
                if isinstance(output, list):
                    # top_k=None returns list of all labels
                    scores = {item["label"]: item["score"] for item in output}
                else:
                    scores = {output["label"]: output["score"]}

                label = max(scores, key=scores.get)
                results.append({
                    "label": label,
                    "positive": round(scores.get("positive", 0.0), 4),
                    "negative": round(scores.get("negative", 0.0), 4),
                    "neutral": round(scores.get("neutral", 0.0), 4),
                })

        # Pad results if batch processing skipped empty texts
        while len(results) < len(articles):
            results.append({"label": "neutral", "positive": 0.33, "negative": 0.33, "neutral": 0.34})

    except Exception as e:
        logger.error(f"[FINBERT] Batch analysis error: {e}")
        # Fallback: return neutral for all
        results = [
            {"label": "neutral", "positive": 0.33, "negative": 0.33, "neutral": 0.34}
            for _ in articles
        ]

    return results[:len(articles)]


def analyze_single(title: str, description: str = "") -> Dict[str, Any]:
    """Analyze sentiment for a single article."""
    results = analyze_sentiment_batch([{"title": title, "description": description}])
    return results[0] if results else {"label": "neutral", "positive": 0.33, "negative": 0.33, "neutral": 0.34}


def is_model_available() -> bool:
    """Check if FinBERT model is loaded and available."""
    model = _load_model()
    return model is not None
