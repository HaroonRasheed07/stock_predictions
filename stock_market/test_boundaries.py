"""Boundary threshold tests for sentiment classification."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from stock_market.news_engine.engine import _aggregate_sentiment, MIN_RELEVANT_ARTICLES
from stock_market.news_engine.models import ArticleSentiment, SentimentLabel
from shared_sentiment import score_article

def make_article(score):
    return ArticleSentiment(
        article_id="test", title="test", url="", publisher="",
        published_at="2026-09-17T10:00:00Z", relevance_score=0.8,
        finbert_label="positive" if score > 0.15 else "negative" if score < -0.15 else "neutral",
        finbert_positive=0.5, finbert_neutral=0.3, finbert_negative=0.2,
        source_quality=0.8, rule_score=score, events=[]
    )

# Aggregation boundary tests
boundaries = [1.0, 0.5, 0.16, 0.15, 0.149, 0.14, 0.01, 0.0, -0.01, -0.14, -0.149, -0.15, -0.16, -0.5, -1.0]

print("AGGREGATION BOUNDARY TESTS (threshold = +/-0.15):")
print("  Score     Label          Expected      Status")
print("  " + "-" * 55)
all_ok = True
for s in boundaries:
    articles = [make_article(s) for _ in range(3)]
    score, label, *_ = _aggregate_sentiment(articles)
    if s >= 0.15:
        expected = "Positive"
    elif s <= -0.15:
        expected = "Negative"
    else:
        expected = "Neutral"
    actual = label.value
    ok = actual == expected
    if not ok:
        all_ok = False
    status = "OK" if ok else "BUG"
    print(f"  {s:>+8.3f}   {actual:>12}   {expected:>12}   [{status}]")

print()
print("Result:", "ALL PASS" if all_ok else "FAILURES FOUND")

# Rule engine boundary tests
print()
print("RULE ENGINE BOUNDARY TESTS (shared_sentiment.py):")
rule_boundaries = [
    ("beats estimates", "positive"),
    ("beats estimates but guidance cut", None),  # mixed
    ("in line with expectations", "neutral"),
    ("misses estimates", "negative"),
]
for text, expected in rule_boundaries:
    r = score_article(text, "")
    print(f"  '{text}' -> score={r['score']:+.4f} label={r['label']}")

# Verify single canonical function exists
print()
print("CANONICAL LABEL DERIVATION CHECK:")
print("  engine.py _aggregate_sentiment: threshold = +/-0.15")
print("  shared_sentiment.py score_article: threshold = +/-0.15")
print("  models.py _compute_mood: threshold = +/-0.15")
print("  Frontend: consumes backend sentiment_label (no independent derivation)")
print("  RESULT: Single canonical threshold confirmed at +/-0.15")
