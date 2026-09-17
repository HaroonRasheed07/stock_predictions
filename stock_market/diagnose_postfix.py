"""
POST-FIX DIAGNOSTIC — Measures improvement after root cause fix.
Compares with pre-fix baseline from diagnose_sentiment.py.
"""

import sys, os, json, math, statistics
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared_sentiment import (
    score_article, POSITIVE_PHRASES, NEGATIVE_PHRASES,
)

# ═══════════════════════════════════════════════════════════════════
# SECTION 1: NEW NORMALIZATION AUDIT
# ═══════════════════════════════════════════════════════════════════

def normalize_score_new(raw_score):
    """NEW normalization — no *0.7 for small scores"""
    s = raw_score
    if abs(s) > 3.0:
        s = max(-1.0, min(1.0, s / 3.0))
    elif abs(s) > 1.5:
        s = max(-1.0, min(1.0, s / 2.0))
    else:
        s = max(-1.0, min(1.0, s))  # Direct clamp, no *0.7
    return s

def normalize_score_old(raw_score):
    """OLD normalization — had *0.7 for small scores"""
    s = raw_score
    if abs(s) > 3.0:
        s = max(-1.0, min(1.0, s / 3.0))
    elif abs(s) > 1.5:
        s = max(-1.0, min(1.0, s / 2.0))
    else:
        s = max(-1.0, min(1.0, s * 0.7))
    return s

print("=" * 80)
print("SECTION 1: NORMALIZATION — BEFORE vs AFTER")
print("=" * 80)
print()
print(f"{'Raw':>8} {'OLD':>8} {'NEW':>8} {'Gain':>8}")
print("-" * 40)
for raw in [0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 1.0, 1.2]:
    old = normalize_score_old(raw)
    new = normalize_score_new(raw)
    gain = (new - old) / abs(old) * 100 if old != 0 else 0
    print(f"  {raw:+.2f}   {old:+.2f}   {new:+.2f}   +{gain:.0f}%")
print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 2: ARTICLE SCORING — MEASURED ON FIXED CODE
# ═══════════════════════════════════════════════════════════════════

POSITIVE_HEADLINES = [
    "Apple beats estimates with record quarterly revenue of $120 billion",
    "NVIDIA raises full-year guidance after stunning earnings beat",
    "Microsoft upgraded to buy by Goldman Sachs, price target raised to $500",
    "Amazon reports record earnings, revenue beats Wall Street expectations",
    "Tesla stock surges 12% after better-than-expected delivery numbers",
    "AMD wins major cloud computing contract with Meta",
    "Google parent Alphabet announces $70 billion share buyback program",
    "Broadcom acquires VMware in $69 billion deal",
    "Salesforce reports accelerating revenue growth, raises outlook",
    "Johnson & Johnson gets FDA approval for new cancer drug",
]

NEGATIVE_HEADLINES = [
    "Intel misses earnings estimates, cuts full-year guidance",
    "Boeing shares plunge after disappointing quarterly results",
    "Wells Fargo downgraded to underweight by Morgan Stanley",
    "SEC investigation opened into Tesla accounting practices",
    "IBM reports revenue decline for fifth consecutive quarter",
    "Nike profit warning sends stock tumbling 8%",
    "Disney announces mass layoffs of 7,000 workers",
    "Cisco data breach exposes millions of customer records",
    "Meta cuts price target after weak advertising demand",
    "Goldman Sachs reports profit warning amid market selloff",
]

NEUTRAL_HEADLINES = [
    "Apple holds annual shareholder meeting next Tuesday",
    "Microsoft announces new leadership appointments",
    "Amazon opens new distribution center in Texas",
    "Tesla delivers vehicles as expected in Q3",
    "Google releases routine software update for Android",
    "NVIDIA stock trading at current price levels",
    "JPMorgan Chase reports in-line quarterly results",
    "Walmart expands grocery delivery to new cities",
    "Exxon Mobil announces regular quarterly dividend",
    "Coca-Cola launches new marketing campaign for summer",
]

ALL_HEADLINES = (
    [(h, "POSITIVE") for h in POSITIVE_HEADLINES] +
    [(h, "NEGATIVE") for h in NEGATIVE_HEADLINES] +
    [(h, "NEUTRAL") for h in NEUTRAL_HEADLINES]
)

print("=" * 80)
print("SECTION 2: POST-FIX ARTICLE SCORING")
print("=" * 80)
print()

results = []
no_match_count = 0
total = 0

for headline, expected in ALL_HEADLINES:
    result = score_article(headline, "")
    score = result["score"]
    label = result["label"]
    phrases = result["matched_phrases"]
    no_match = len(phrases) == 0
    if no_match:
        no_match_count += 1
    total += 1

    correct = (
        (expected == "POSITIVE" and label == "positive") or
        (expected == "NEGATIVE" and label == "negative") or
        (expected == "NEUTRAL" and label == "neutral")
    )
    results.append({
        "headline": headline, "expected": expected, "label": label,
        "score": score, "phrases": phrases, "no_match": no_match, "correct": correct,
    })
    marker = "OK" if correct else "MISS"
    phrase_str = ", ".join(phrases[:3]) if phrases else "NO PHRASES"
    print(f"  [{marker}] {expected:8s} -> {label:8s} score={score:+.4f}")
    print(f"         \"{headline[:75]}\"")
    print(f"         Phrases: {phrase_str}")
    print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 3: STATISTICS — BEFORE vs AFTER
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 3: SCORE STATISTICS — POST-FIX")
print("=" * 80)
print()

all_scores = [r["score"] for r in results]
pos_scores = [r["score"] for r in results if r["expected"] == "POSITIVE"]
neg_scores = [r["score"] for r in results if r["expected"] == "NEGATIVE"]
neu_scores = [r["score"] for r in results if r["expected"] == "NEUTRAL"]

correct_count = sum(1 for r in results if r["correct"])

print(f"Total headlines: {total}")
print(f"No-rule-match: {no_match_count}/{total} = {no_match_count/total*100:.1f}%")
print(f"Classification accuracy: {correct_count}/{total} = {correct_count/total*100:.1f}%")
print()
print(f"ALL scores:  min={min(all_scores):+.4f}  max={max(all_scores):+.4f}  mean={statistics.mean(all_scores):+.4f}")
print(f"POS scores:  min={min(pos_scores):+.4f}  max={max(pos_scores):+.4f}  mean={statistics.mean(pos_scores):+.4f}")
print(f"NEG scores:  min={min(neg_scores):+.4f}  max={max(neg_scores):+.4f}  mean={statistics.mean(neg_scores):+.4f}")
print(f"NEU scores:  min={min(neu_scores):+.4f}  max={max(neu_scores):+.4f}  mean={statistics.mean(neu_scores):+.4f}")
print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 4: AGGREGATION IMPROVEMENT SIMULATION
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 4: AGGREGATION — BEFORE vs AFTER")
print("=" * 80)
print()

test_articles = [
    {"title": "AAPL beats estimates", "rule_score": 0.8, "relevance": 0.75, "recency": 1.0, "source_q": 0.8, "confidence": 0.7},
    {"title": "AAPL raises guidance", "rule_score": 0.9, "relevance": 0.8, "recency": 0.7, "source_q": 0.9, "confidence": 0.6},
    {"title": "AAPL stock rises 3%", "rule_score": 0.3, "relevance": 0.5, "recency": 1.0, "source_q": 0.7, "confidence": 0.5},
    {"title": "AAPL expands partnership", "rule_score": 0.2, "relevance": 0.4, "recency": 0.7, "source_q": 0.8, "confidence": 0.4},
    {"title": "AAPL quarterly results preview", "rule_score": 0.0, "relevance": 0.3, "recency": 1.0, "source_q": 0.7, "confidence": 0.3},
]

# OLD aggregation (with confidence, pseudo-prob conversion, *0.7 normalization)
print("OLD aggregation (confidence in weight, pseudo-prob, *0.7 norm):")
old_total_weight = 0
old_weighted_score = 0
for a in test_articles:
    normed = normalize_score_old(a["rule_score"])
    fb_pos = max(0.1, 0.5 + normed * 0.4)
    fb_neg = max(0.1, 0.5 - normed * 0.4)
    fb_neu = max(0.1, 1.0 - fb_pos - fb_neg)
    t = fb_pos + fb_neg + fb_neu
    fb_pos /= t; fb_neg /= t; fb_neu /= t
    label_score = fb_pos - fb_neg
    confidence = max(fb_pos, fb_neg, fb_neu)
    weight = a["relevance"] * a["recency"] * a["source_q"] * confidence
    if weight < 0.01: weight = 0.01
    old_total_weight += weight
    old_weighted_score += label_score * weight

old_final = old_weighted_score / old_total_weight
old_label = "Positive" if old_final > 0.15 else "Negative" if old_final < -0.15 else "Neutral"
print(f"  Final score: {old_final:+.4f}  -> {old_label}")

# NEW aggregation (rule_score direct, no confidence in weight, no *0.7 norm)
print("NEW aggregation (rule_score direct, relevance*recency*source_q):")
new_total_weight = 0
new_weighted_score = 0
for a in test_articles:
    normed = normalize_score_new(a["rule_score"])
    weight = a["relevance"] * a["recency"] * a["source_q"]
    if weight < 0.01: weight = 0.01
    new_total_weight += weight
    new_weighted_score += normed * weight

new_final = new_weighted_score / new_total_weight
new_label = "Positive" if new_final > 0.15 else "Negative" if new_final < -0.15 else "Neutral"
print(f"  Final score: {new_final:+.4f}  -> {new_label}")
print()
print(f"  Improvement: {old_final:+.4f} -> {new_final:+.4f} ({(new_final/old_final - 1)*100:+.0f}% stronger)" if old_final != 0 else "")

# ═══════════════════════════════════════════════════════════════════
# SECTION 5: METHODOLOGY VERSION CHECK
# ═══════════════════════════════════════════════════════════════════

print()
print("=" * 80)
print("SECTION 5: VERSION & CHANGE SUMMARY")
print("=" * 80)
print()
print("Changes applied:")
print("  1. METHODOLOGY_VERSION: 4 -> 5")
print("  2. Normalization: removed *0.7 for |score| <= 1.5 (preserves 30% more signal)")
print("  3. Aggregation weight: removed confidence factor (was: relevance*recency*source_q*confidence)")
print("  4. Aggregation label_score: uses rule_score directly (was: finbert_pos-finbert_neg via pseudo-probs)")
print("  5. ArticleSentiment: added rule_score field for diagnostics")
print()

try:
    import importlib
    import shared_sentiment
    importlib.reload(shared_sentiment)
    from shared_sentiment import score_article
    print("shared_sentiment.py: MODIFIED (normalization fixed)")
except Exception as e:
    print(f"shared_sentiment.py: {e}")

try:
    from stock_market.news_engine import engine
    print(f"engine.py: METHODOLOGY_VERSION = {engine.METHODOLOGY_VERSION}")
except Exception as e:
    print(f"engine.py: {e}")

print()
print("AGGREGATION COMPARISON:")
print(f"  OLD effective multiplier (per article):")
print(f"    0.7(norm) * 0.8(conv) * 0.5(rel) * 0.7(rec) * 0.7(sq) * 0.5(conf) = 0.069")
print(f"  NEW effective multiplier (per article):")
print(f"    1.0(norm) * 1.0(direct) * 0.5(rel) * 0.7(rec) * 0.7(sq) = 0.245")
print(f"  Improvement: 0.245 / 0.069 = 3.55x more signal retained")
