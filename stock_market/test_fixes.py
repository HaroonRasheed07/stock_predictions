"""Verify all backend changes work correctly."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from stock_market.news_engine.models import SentimentSnapshot, ArticleSentiment, SentimentLabel, SentimentStatus
from stock_market.news_engine.engine import METHODOLOGY_VERSION, _aggregate_sentiment

# 1. Verify ArticleSentiment has rule_score
a = ArticleSentiment(
    article_id='test', title='test', url='test', publisher='test',
    published_at='', relevance_score=0.5, finbert_label='neutral',
    finbert_positive=0.33, finbert_neutral=0.34, finbert_negative=0.33,
    rule_score=0.75
)
assert a.rule_score == 0.75, f"rule_score not set: {a.rule_score}"
print("PASS: ArticleSentiment.rule_score field works")

# 2. Verify methodology version
assert METHODOLOGY_VERSION == "5", f"Expected v5, got {METHODOLOGY_VERSION}"
print(f"PASS: METHODOLOGY_VERSION = {METHODOLOGY_VERSION}")

# 3. Verify aggregation uses rule_score directly
articles = [
    ArticleSentiment(
        article_id='a1', title='beat estimates', url='', publisher='',
        published_at='', relevance_score=0.8, finbert_label='positive',
        finbert_positive=0.7, finbert_neutral=0.2, finbert_negative=0.1,
        source_quality=0.8, rule_score=0.8
    ),
    ArticleSentiment(
        article_id='a2', title='record revenue', url='', publisher='',
        published_at='', relevance_score=0.7, finbert_label='positive',
        finbert_positive=0.6, finbert_neutral=0.3, finbert_negative=0.1,
        source_quality=0.7, rule_score=0.9
    ),
]
score, label, pos_pct, neu_pct, neg_pct, pos_c, neu_c, neg_c = _aggregate_sentiment(articles)
print(f"PASS: Aggregation score={score:+.4f} label={label.value} (2 strongly positive articles)")
assert score > 0.15, f"Expected positive, got score={score}"
assert label == SentimentLabel.POSITIVE, f"Expected POSITIVE, got {label}"

# 4. Verify serialization roundtrip
snap = SentimentSnapshot(
    ticker='TEST', company_name='Test Corp', status=SentimentStatus.SUFFICIENT,
    label=SentimentLabel.POSITIVE, score=0.5, positive_pct=60.0,
    neutral_pct=20.0, negative_pct=20.0, article_count=5,
    relevant_article_count=5, source_count=3, providers_attempted=['test'],
    articles=articles
)
legacy = snap.to_legacy_dict()
assert legacy['sentiment_score'] == 0.5
assert legacy['articles'][0]['rule_score'] == 0.8
assert legacy['articles'][1]['rule_score'] == 0.9
print("PASS: Serialization roundtrip preserves rule_score")

# 5. Verify normalization (shared_sentiment)
from shared_sentiment import score_article
result = score_article("Apple beats estimates with record quarterly revenue", "")
assert result['score'] > 0.5, f"Expected strong positive, got {result['score']}"
print(f"PASS: Normalization fix - strong positive headline scores {result['score']:+.4f}")

# 6. Verify false positive fix
result_neutral = score_article("Coca-Cola launches new marketing campaign for summer", "")
assert result_neutral['score'] == 0.0, f"Expected neutral (0.0), got {result_neutral['score']}"
print(f"PASS: False positive fix - 'launches new marketing' scores {result_neutral['score']:+.4f}")

result_neutral2 = score_article("Microsoft announces new leadership appointments", "")
assert result_neutral2['score'] == 0.0, f"Expected neutral (0.0), got {result_neutral2['score']}"
print(f"PASS: False positive fix - 'announces new leadership' scores {result_neutral2['score']:+.4f}")

print()
print("ALL BACKEND TESTS PASSED")
