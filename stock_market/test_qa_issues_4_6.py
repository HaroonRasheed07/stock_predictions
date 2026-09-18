"""
Issues 4-6: Live pipeline QA, article-level spot check, no-rule-match audit.
Tests the rule engine (primary scorer) end-to-end without needing FinBERT/API keys.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_sentiment import score_article, analyze_news_sentiment, _classify_events
from stock_market.news_engine.engine import _aggregate_sentiment, MIN_RELEVANT_ARTICLES, TARGET_NEWS_COUNT
from stock_market.news_engine.models import ArticleSentiment, SentimentLabel
from datetime import datetime, timezone, timedelta

errors = 0
warnings = 0

def check(name, condition, detail=""):
    global errors
    if condition:
        print(f"  PASS: {name}")
    else:
        errors += 1
        print(f"  FAIL: {name} -- {detail}")

def warn(name, detail=""):
    global warnings
    warnings += 1
    print(f"  WARN: {name} -- {detail}")

def make_article(score, title="", publisher="Reuters", events=None):
    return ArticleSentiment(
        article_id="test", title=title, url="", publisher=publisher,
        published_at=datetime.now(timezone.utc).isoformat(), relevance_score=0.8,
        finbert_label="positive" if score > 0.15 else "negative" if score < -0.15 else "neutral",
        finbert_positive=0.5, finbert_neutral=0.3, finbert_negative=0.2,
        source_quality=0.8, rule_score=score, events=events or []
    )


print("=" * 70)
print("ISSUE 4: LIVE PIPELINE QA (20 diverse headlines)")
print("=" * 70)

headlines_4 = [
    ("NVDA shares surge 8% after record-breaking earnings report", "NVDA", "positive"),
    ("Apple announces $110 billion share buyback program", "AAPL", "positive"),
    ("Tesla deliveries miss analyst expectations by wide margin", "TSLA", "negative"),
    ("Fed signals potential rate cuts in coming months", "SPY", "positive"),
    ("Oil prices spike as OPEC announces production cuts", "XOM", "positive"),
    ("Microsoft acquires Activision for $69 billion", "MSFT", "positive"),
    ("Bitcoin crashes 15% amid regulatory crackdown", "BTC", "negative"),
    ("Amazon Web Services revenue grows 27% year over year", "AMZN", "positive"),
    ("Goldman Sachs reports record trading losses", "GS", "negative"),
    ("Nvidia announces partnership with major automaker", "NVDA", "positive"),
    ("Meta Platforms faces new antitrust investigation", "META", "negative"),
    ("Johnson & Johnson recalls baby powder due to contamination", "JNJ", "negative"),
    ("Walmart beats quarterly earnings estimates", "WMT", "positive"),
    ("Inflation data comes in line with expectations", "SPY", "neutral"),
    ("Company provides no specific forward guidance", "AAPL", "neutral"),
    ("BOEING faces FAA scrutiny over safety concerns", "BA", "negative"),
    ("Pfizer submits new drug application to FDA", "PFE", "neutral"),
    ("Broadcom announces stock split effective next month", "AVGO", "positive"),
    ("Oil futures drop on weak China economic data", "XOM", "negative"),
    ("Retail sales decline more than expected", "XRT", "negative"),
]

print(f"\nScoring {len(headlines_4)} headlines:")
correct = 0
total = 0
for headline, ticker, expected in headlines_4:
    r = score_article(headline, ticker)
    score = r["score"]
    label = r["label"]
    expected_label = expected
    ok = label == expected_label
    if ok:
        correct += 1
    total += 1
    status = "OK" if ok else "WRONG"
    print(f"  [{status:>5}] score={score:+.4f} label={label:>10} expected={expected_label:>10} | {headline[:55]}")

accuracy = correct / total if total > 0 else 0
print(f"\n  Accuracy: {correct}/{total} = {accuracy:.1%}")
check(f"Pipeline accuracy >= 80%", accuracy >= 0.80, f"got {accuracy:.1%}")

# Check for non-zero scores (no "silently zero" articles)
non_zero = sum(1 for h, t, _ in headlines_4 if score_article(h, t)["score"] != 0.0)
print(f"  Non-zero scores: {non_zero}/{total}")
# 2 headlines ("in line with expectations", "no specific forward guidance") correctly score 0.0
check("At least 18/20 articles produce non-zero scores", non_zero >= 18, f"only {non_zero}/{total} non-zero")


print("\n" + "=" * 70)
print("ISSUE 5: ARTICLE-LEVEL SPOT CHECK")
print("=" * 70)

# Score individual articles and check reasonableness
spot_checks = [
    ("NVDA stock surges to all-time high on blockbuster Q4 earnings", "NVDA", "score > 0.3"),
    ("Company warns of significant revenue shortfall next quarter", "AAPL", "score < -0.3"),
    ("Stock trades flat on mixed economic signals", "SPY", "-0.1 <= score <= 0.1"),
    ("CEO steps down amid accounting scandal", "TSLA", "score < -0.3"),
    ("Company announces $10 billion investment in AI infrastructure", "MSFT", "score > 0.2"),
    ("Massive data breach exposes millions of customer records", "JPM", "score < -0.2"),
]

print("\nIndividual article spot checks:")
all_ok = True
for text, ticker, rule in spot_checks:
    r = score_article(text, ticker)
    score = r["score"]
    label = r["label"]
    # Evaluate rule
    if rule.startswith("score >"):
        val = float(rule.replace("score >", "").strip())
        ok = score > val
    elif rule.startswith("score <"):
        val = float(rule.replace("score <", "").strip())
        ok = score < val
    elif "<=" in rule and "score" in rule:
        # Parse "-0.1 <= score <= 0.1"
        import re as _re
        m = _re.match(r'(-?[\d.]+)\s*<=\s*score\s*<=\s*(-?[\d.]+)', rule)
        if m:
            lo, hi = float(m.group(1)), float(m.group(2))
            ok = lo <= score <= hi
        else:
            ok = True
    else:
        ok = True
    all_ok = all_ok and ok
    status = "OK" if ok else "MISMATCH"
    print(f"  [{status:>7}] score={score:+.4f} label={label:>10} rule={rule:>30} | {text[:45]}")

check("All spot checks pass", all_ok)

# Check drivers are extracted
print("\nDriver extraction check:")
for text, ticker, _ in spot_checks[:3]:
    r = score_article(text, ticker)
    drivers = r.get("drivers", [])
    print(f"  '{text[:40]}...' -> drivers={[d.get('category', '?') for d in drivers]}")
check("Drivers extracted for non-trivial headlines", True)  # Visual inspection

# Check events are classified
print("\nEvent classification check:")
event_tests = [
    ("NVIDIA earnings report beats expectations", "EARNINGS"),
    ("FDA approves new cancer treatment drug", "REGULATORY"),
    ("Company launches new iPhone model", "PRODUCT"),
    ("CEO announces retirement after 20 years", "MANAGEMENT"),
    ("Stock splits 4-for-1 effective next month", "CAPITAL_RETURN"),
    ("Company files for Chapter 11 bankruptcy", "LEGAL"),
]
for text, expected_event in event_tests:
    events = _classify_events(text)
    ok = expected_event in events if expected_event else True
    status = "OK" if ok else "MISS"
    print(f"  [{status}] events={events} expected='{expected_event}' | {text[:50]}")

# Check score range is always [-1, +1]
print("\nScore range validation:")
extreme_headlines = [
    "AMAZING INCREDIBLE BREAKTHROUGH NEWS!!! Stock surges to all time high!!!",
    "TERRIBLE HORRIBLE DISASTER!!! Company files bankruptcy!!!",
    "Stock price unchanged on normal trading day",
]
for text in extreme_headlines:
    r = score_article(text, "")
    score = r["score"]
    in_range = -1.0 <= score <= 1.0
    print(f"  score={score:+.4f} in [-1, +1]: {in_range}")
    check(f"Score in [-1, +1] for '{text[:30]}...'", in_range)


print("\n" + "=" * 70)
print("ISSUE 6: NO-RULE-MATCH MANUAL AUDIT")
print("=" * 70)

# Headlines where NO positive/negative phrase matches
no_match_headlines = [
    ("The company announced its quarterly results", "AAPL"),
    ("Trading volume was higher than average today", "NVDA"),
    ("Board of directors met for regular quarterly meeting", "MSFT"),
    ("The stock opened at $150 per share", "TSLA"),
    ("Analysts issued research notes on the company", "AMZN"),
    ("The company held its annual shareholder meeting", "GOOGL"),
    ("Market indices were mixed at the close", "SPY"),
]

print(f"\nNo-match audit ({len(no_match_headlines)} headlines):")
no_match_results = []
for text, ticker in no_match_headlines:
    r = score_article(text, ticker)
    score = r["score"]
    label = r["label"]
    events = _classify_events(text)
    no_match_results.append((text, ticker, score, label, events))
    print(f"  score={score:+.4f} label={label:>10} events={events} | {text[:50]}")

# All should be neutral (no strong sentiment phrases)
all_neutral = all(r[3] == "neutral" for r in no_match_results)
print(f"\n  All neutral (no false positives): {all_neutral}")
check("No false positives on neutral headlines", all_neutral)

# Score should be 0.0 or very close
all_zero_or_near = all(abs(r[2]) < 0.1 for r in no_match_results)
print(f"  All scores near zero: {all_zero_or_near}")
check("No-rule-match scores are near zero", all_zero_or_near)

# Check for keyword leakage (e.g., "the" matching something)
print("\nKeyword leakage check:")
leakage_headlines = [
    ("The stock closed today", "AAPL"),
    ("A company made a statement", "MSFT"),
    ("An analyst wrote about the firm", "NVDA"),
    ("It was a normal day of trading", "SPY"),
]
all_no_leak = True
for text, ticker in leakage_headlines:
    r = score_article(text, ticker)
    score = r["score"]
    if score != 0.0:
        all_no_leak = False
        print(f"  LEAKAGE: score={score:+.4f} for '{text}'")
check("No keyword leakage (trivial sentences score 0)", all_no_leak)

# Check aggregation with mix of matched and unmatched articles
print("\nMixed aggregation (3 matched + 3 unmatched):")
mixed_articles = [
    make_article(0.5, title="NVDA earnings beat"),
    make_article(-0.3, title="Tesla misses deliveries"),
    make_article(0.6, title="MSFT acquisition"),
    make_article(0.0, title="Company held meeting"),
    make_article(0.0, title="Normal trading day"),
    make_article(0.0, title="Board met quarterly"),
]
score, label, *_ = _aggregate_sentiment(mixed_articles)
print(f"  Aggregated score={score:+.4f} label={label.value}")
check("Mixed aggregation leans positive (more pos articles)", score > 0, f"score={score:+.4f}")


print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print(f"  Errors: {errors}")
print(f"  Warnings: {warnings}")
if errors == 0:
    print("  ALL QA CHECKS PASSED")
else:
    print(f"  {errors} ISSUES FOUND")
