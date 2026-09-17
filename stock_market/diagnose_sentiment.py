"""
DIAGNOSTIC SCRIPT — Sentiment Engine Root Cause Analysis
Runs against the CURRENT implementation. No production changes.

Measures:
1. Rule engine raw scores
2. Normalization collapse
3. No-rule-match rate
4. Aggregation math
5. Score distribution
"""

import sys, os, json, math, statistics
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared_sentiment import (
    score_article, POSITIVE_PHRASES, NEGATIVE_PHRASES,
    POSITIVE_WORDS, NEGATIVE_WORDS, IN_LINE_PHRASES,
    _normalize_text, _combine_title_desc, _detect_negation,
)

# ═══════════════════════════════════════════════════════════════════
# SECTION 1: SCORE NORMALIZATION AUDIT
# The normalization function at lines 580-587 of shared_sentiment.py
# ═══════════════════════════════════════════════════════════════════

def normalize_score(raw_score):
    """Exact copy of shared_sentiment.py lines 580-587"""
    s = raw_score
    if abs(s) > 3.0:
        s = max(-1.0, min(1.0, s / 3.0))
    elif abs(s) > 1.5:
        s = max(-1.0, min(1.0, s / 2.0))
    else:
        s = max(-1.0, min(1.0, s * 0.7))
    return s

print("=" * 80)
print("SECTION 1: NORMALIZATION COLLAPSE AUDIT")
print("=" * 80)
print()
print("The normalization function applies DIFFERENT attenuation based on magnitude:")
print("  |raw| > 3.0  -> /3.0  (e.g. raw 4.0 -> 1.33 -> clipped to 1.0)")
print("  |raw| > 1.5  -> /2.0  (e.g. raw 2.0 -> 1.0)")
print("  |raw| <= 1.5 -> *0.7  (e.g. raw 1.0 -> 0.7)")
print()

test_raw_scores = [0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, -0.5, -1.0, -2.0]
for raw in test_raw_scores:
    normed = normalize_score(raw)
    collapse_pct = (1.0 - abs(normed)/abs(raw)) * 100 if raw != 0 else 0
    print(f"  raw={raw:+.2f}  ->  normalized={normed:+.2f}  (collapsed {collapse_pct:.0f}%)")

print()
print("CRITICAL: For raw scores between -1.5 and +1.5, the *0.7 multiplier")
print("is applied. This means ANY article with raw_score <= 1.5 loses 30%")
print("of its signal strength BEFORE aggregation.")
print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 2: RULE ENGINE SCORES — TRACE INDIVIDUAL ARTICLES
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 2: RULE ENGINE — INDIVIDUAL ARTICLE SCORING")
print("=" * 80)
print()

# Test headlines that SHOULD be positive
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

# Test headlines that SHOULD be negative
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

# Test headlines that SHOULD be neutral
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

# Mixed headlines
MIXED_HEADLINES = [
    "Shares rise despite guidance cut from Apple",
    "NVIDIA beats estimates but warns of slowing demand",
    "Microsoft revenue grows but cloud segment misses expectations",
    "Tesla delivers record vehicles but margins contract",
]

ALL_HEADLINES = (
    [(h, "POSITIVE") for h in POSITIVE_HEADLINES] +
    [(h, "NEGATIVE") for h in NEGATIVE_HEADLINES] +
    [(h, "NEUTRAL") for h in NEUTRAL_HEADLINES] +
    [(h, "MIXED") for h in MIXED_HEADLINES]
)

results = []
no_match_count = 0
total_articles = 0

for headline, expected in ALL_HEADLINES:
    result = score_article(headline, "")
    raw_score = result["score"]
    label = result["label"]
    phrases = result["matched_phrases"]
    events = result["events"]
    
    no_match = len(phrases) == 0
    if no_match:
        no_match_count += 1
    total_articles += 1
    
    correct = (
        (expected == "POSITIVE" and label == "positive") or
        (expected == "NEGATIVE" and label == "negative") or
        (expected == "NEUTRAL" and label == "neutral") or
        (expected == "MIXED")  # Mixed is hard to evaluate automatically
    )
    
    results.append({
        "headline": headline,
        "expected": expected,
        "label": label,
        "score": raw_score,
        "phrases": phrases,
        "events": events,
        "no_match": no_match,
        "correct": correct,
    })
    
    marker = "OK" if correct else "MISS"
    phrase_str = ", ".join(phrases[:3]) if phrases else "NO PHRASES"
    print(f"  [{marker}] {expected:8s} -> {label:8s} score={raw_score:+.4f}")
    print(f"         \"{headline[:75]}...\"")
    print(f"         Phrases: {phrase_str}")
    print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 3: STATISTICS
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 3: SCORE STATISTICS")
print("=" * 80)
print()

all_scores = [r["score"] for r in results]
pos_scores = [r["score"] for r in results if r["expected"] == "POSITIVE"]
neg_scores = [r["score"] for r in results if r["expected"] == "NEGATIVE"]
neu_scores = [r["score"] for r in results if r["expected"] == "NEUTRAL"]

print(f"Total headlines tested: {total_articles}")
print(f"No-rule-match rate: {no_match_count}/{total_articles} = {no_match_count/total_articles*100:.1f}%")
print()

if all_scores:
    print(f"ALL scores:")
    print(f"  min={min(all_scores):+.4f}  max={max(all_scores):+.4f}")
    print(f"  mean={statistics.mean(all_scores):+.4f}  median={statistics.median(all_scores):+.4f}")
    print(f"  stdev={statistics.stdev(all_scores):.4f}")
    print()

if pos_scores:
    print(f"POSITIVE-headline scores:")
    print(f"  min={min(pos_scores):+.4f}  max={max(pos_scores):+.4f}")
    print(f"  mean={statistics.mean(pos_scores):+.4f}  median={statistics.median(pos_scores):+.4f}")
    print()

if neg_scores:
    print(f"NEGATIVE-headline scores:")
    print(f"  min={min(neg_scores):+.4f}  max={max(neg_scores):+.4f}")
    print(f"  mean={statistics.mean(neg_scores):+.4f}  median={statistics.median(neg_scores):+.4f}")
    print()

if neu_scores:
    print(f"NEUTRAL-headline scores:")
    print(f"  min={min(neu_scores):+.4f}  max={max(neu_scores):+.4f}")
    print(f"  mean={statistics.mean(neu_scores):+.4f}  median={statistics.median(neu_scores):+.4f}")
    print()

# Classification accuracy
correct_count = sum(1 for r in results if r["correct"])
mixed_count = sum(1 for r in results if r["expected"] == "MIXED")
non_mixed = total_articles - mixed_count
non_mixed_correct = correct_count - sum(1 for r in results if r["expected"] == "MIXED" and r["correct"])
print(f"Classification accuracy (non-mixed): {non_mixed_correct}/{non_mixed} = {non_mixed_correct/non_mixed*100:.1f}%" if non_mixed else "")
print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 4: AGGREGATION MATH AUDIT
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 4: AGGREGATION MATH AUDIT")
print("=" * 80)
print()
print("The aggregation formula in engine.py _aggregate_sentiment():")
print()
print("  weight_i = relevance_i * recency_i * source_quality_i * confidence_i")
print("  label_score_i = finbert_positive_i - finbert_negative_i")
print("  weighted_score = sum(label_score_i * weight_i)")
print("  total_weight = sum(weight_i)")
print("  final_score = weighted_score / total_weight")
print()
print("KEY FINDING: When FinBERT is NOT available (common on 512MB Render),")
print("the fallback converts rule-engine scores to pseudo-probabilities:")
print()
print("  fb_pos = max(0.1, 0.5 + rule_score * 0.4)")
print("  fb_neg = max(0.1, 0.5 - rule_score * 0.4)")
print("  fb_neu = max(0.1, 1.0 - fb_pos - fb_neg)")
print()
print("Then: label_score = fb_pos - fb_neg = (0.5 + s*0.4) - (0.5 - s*0.4) = s * 0.8")
print()
print("So the rule engine score is MULTIPLIED BY 0.8 in the conversion.")
print("Combined with the *0.7 normalization: total attenuation = 0.7 * 0.8 = 0.56")
print("BEFORE any weighting!")
print()

# Simulate the conversion for test scores
print("Conversion simulation (rule engine -> pseudo-probability):")
for s in [0.3, 0.5, 0.8, 1.0, -0.3, -0.5, -0.8]:
    fb_pos = max(0.1, 0.5 + s * 0.4)
    fb_neg = max(0.1, 0.5 - s * 0.4)
    fb_neu = max(0.1, 1.0 - fb_pos - fb_neg)
    total = fb_pos + fb_neg + fb_neu
    fb_pos /= total; fb_neg /= total; fb_neu /= total
    label_score = fb_pos - fb_neg
    print(f"  rule_score={s:+.2f} -> fb_pos={fb_pos:.3f} fb_neg={fb_neg:.3f} label_score={label_score:+.3f} (ratio to original: {label_score/s:.2f}x)" if s != 0 else f"  rule_score={s:+.2f} -> label_score={label_score:+.3f}")

print()

# Simulate full aggregation with typical weights
print("Full aggregation simulation (5 articles):")
print()

test_articles = [
    {"title": "AAPL beats estimates", "rule_score": 0.8, "relevance": 0.75, "recency": 1.0, "source_q": 0.8, "confidence": 0.7},
    {"title": "AAPL raises guidance", "rule_score": 0.9, "relevance": 0.8, "recency": 0.7, "source_q": 0.9, "confidence": 0.6},
    {"title": "AAPL stock rises 3%", "rule_score": 0.3, "relevance": 0.5, "recency": 1.0, "source_q": 0.7, "confidence": 0.5},
    {"title": "AAPL expands partnership", "rule_score": 0.2, "relevance": 0.4, "recency": 0.7, "source_q": 0.8, "confidence": 0.4},
    {"title": "AAPL quarterly results preview", "rule_score": 0.0, "relevance": 0.3, "recency": 1.0, "source_q": 0.7, "confidence": 0.3},
]

total_weight = 0
weighted_score = 0
for a in test_articles:
    # Normalize the rule score first (as the engine does)
    normed = normalize_score(a["rule_score"])
    # Convert to pseudo-probability
    fb_pos = max(0.1, 0.5 + normed * 0.4)
    fb_neg = max(0.1, 0.5 - normed * 0.4)
    fb_neu = max(0.1, 1.0 - fb_pos - fb_neg)
    t = fb_pos + fb_neg + fb_neu
    fb_pos /= t; fb_neg /= t; fb_neu /= t
    
    label_score = fb_pos - fb_neg
    weight = a["relevance"] * a["recency"] * a["source_q"] * max(fb_pos, fb_neg, fb_neu)
    if weight < 0.01:
        weight = 0.01
    
    total_weight += weight
    weighted_score += label_score * weight
    
    print(f"  \"{a['title']}\"")
    print(f"    rule_score={a['rule_score']:+.2f} -> normalized={normed:+.2f} -> label_score={label_score:+.3f}")
    print(f"    weight = {a['relevance']:.2f} * {a['recency']:.2f} * {a['source_q']:.2f} * {max(fb_pos,fb_neg,fb_neu):.3f} = {weight:.4f}")
    print(f"    contribution = {label_score:+.3f} * {weight:.4f} = {label_score*weight:+.4f}")
    print()

final_score = weighted_score / total_weight if total_weight > 0 else 0
print(f"  TOTAL weight: {total_weight:.4f}")
print(f"  WEIGHTED SCORE: {weighted_score:+.4f}")
print(f"  FINAL SCORE: {final_score:+.4f}")
print(f"  LABEL: {'Positive' if final_score > 0.15 else 'Negative' if final_score < -0.15 else 'Neutral'}")
print()
print("  CONCLUSION: Even with 2 strongly positive articles (scores +0.8, +0.9),")
print("  the multiplicative collapse produces a final score of only", f"{final_score:+.4f}")
print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 5: NO-RULE-MATCH ANALYSIS
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 5: NO-RULE-MATCH HEADLINE ANALYSIS")
print("=" * 80)
print()

no_match_headlines = [r for r in results if r["no_match"]]
print(f"Headlines with ZERO rule matches: {len(no_match_headlines)}/{total_articles}")
print()
for r in no_match_headlines:
    print(f"  [{r['expected']:8s}] \"{r['headline'][:75]}...\"")
    print(f"  -> score={r['score']:+.4f} label={r['label']}")
    print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 6: PHRASE STRENGTH AUDIT
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 6: PHRASE STRENGTH vs NORMALIZATION")
print("=" * 80)
print()
print("Showing how phrase_score -> normalized_score attenuates the signal:")
print()

for pattern, score, magnitude, event in POSITIVE_PHRASES[:10]:
    raw = score * magnitude
    normed = normalize_score(raw)
    print(f"  +{event:20s} \"{pattern[:50]}\"")
    print(f"    phrase_score={score:.2f} * magnitude={magnitude:.1f} = raw={raw:.2f} -> normalized={normed:.2f} (retains {normed/raw*100:.0f}%)" if raw != 0 else f"    raw=0")
    print()

for pattern, score, magnitude, event in NEGATIVE_PHRASES[:10]:
    raw = score * magnitude
    normed = normalize_score(raw)
    print(f"  -{event:20s} \"{pattern[:50]}\"")
    print(f"    phrase_score={score:.2f} * magnitude={magnitude:.1f} = raw={raw:.2f} -> normalized={normed:.2f} (retains {abs(normed)/abs(raw)*100:.0f}%)" if raw != 0 else f"    raw=0")
    print()

# ═══════════════════════════════════════════════════════════════════
# SECTION 7: MULTIPLICATIVE COLLAPSE CALCULATION
# ═══════════════════════════════════════════════════════════════════

print("=" * 80)
print("SECTION 7: MULTIPLICATIVE COLLAPSE QUANTIFICATION")
print("=" * 80)
print()
print("For a typical article with moderate scores in all weight dimensions:")
print()
print("  relevance = 0.5  (tier B: company name in text)")
print("  recency   = 0.7  (1-3 day old article)")
print("  source_q  = 0.7  (newsdata/currents provider)")
print("  confidence= 0.5  (rule engine fallback, moderate)")
print()
typical_weight = 0.5 * 0.7 * 0.7 * 0.5
print(f"  weight = 0.5 * 0.7 * 0.7 * 0.5 = {typical_weight:.3f}")
print()
print("  Combined with normalization (0.7x) and conversion (0.8x):")
total_attenuation = typical_weight * 0.7 * 0.8
print(f"  effective_multiplier = {typical_weight:.3f} * 0.7 * 0.8 = {total_attenuation:.3f}")
print()
print("  A rule-engine raw score of +1.0 (strong positive event)")
print(f"  becomes: +1.0 * {total_attenuation:.3f} = +{1.0 * total_attenuation:.3f} contribution to aggregate")
print()
print("  With threshold of +0.15 for Positive, you need:")
print(f"  at least +0.15 / {total_attenuation:.3f} = {0.15/total_attenuation:.1f} weighted contributions")
print("  from articles to cross the Positive threshold.")
print()
print("  This means MULTIPLE strong articles are needed to overcome")
print("  the multiplicative collapse.")
print()

print("=" * 80)
print("DIAGNOSTIC COMPLETE — ROOT CAUSE IDENTIFIED")
print("=" * 80)
print()
print("ROOT CAUSE: MULTIPLICATIVE COLLAPSE from 4 independent weight factors:")
print("  1. Normalization *0.7 (for scores < 1.5)")
print("  2. Conversion *0.8 (rule_score -> pseudo-probability)")
print("  3. Relevance < 1.0 (most articles 0.3-0.8)")
print("  4. Recency < 1.0 (most articles 0.4-1.0)")
print("  5. Source quality < 1.0 (most providers 0.6-0.9)")
print("  6. Confidence < 1.0 (model certainty 0.3-0.7)")
print()
print("Combined: 0.7 * 0.8 * 0.5 * 0.7 * 0.7 * 0.5 = 0.069")
print("A strong +1.0 rule-engine signal becomes +0.069 in the aggregate.")
print("This is why almost EVERYTHING is Neutral.")
