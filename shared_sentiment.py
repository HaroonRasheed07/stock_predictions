"""
shared_sentiment.py — Lightweight finance-specific rule-based sentiment engine.

Architecture:
  1. Normalize text
  2. Detect financial phrases (multi-word > single word)
  3. Apply negation detection
  4. Detect contrast/reversal
  5. Classify event type
  6. Compute article score with magnitude
  7. Aggregate to ticker-level snapshot

Deterministic, explainable, cacheable, <5 MB memory.
"""

import re
from typing import List, Dict, Any, Optional, Tuple

# ─── Phrase Dictionaries ─────────────────────────────────────────────────────
# Each phrase: (pattern, score, magnitude, event_type)
# score: -1.0 to +1.0
# magnitude: STRONG=2.0, MODERATE=1.0, WEAK=0.5
# event_type: for classification

# POSITIVE PHRASES — ordered by specificity (longer/more specific first)
POSITIVE_PHRASES: List[Tuple[str, float, float, str]] = [
    # Earnings beats
    (r'beats?\s+(?:estimates?|expectations?|consensus|wall\s+street|analyst|earnings|revenue|forecast)', 0.8, 2.0, 'EARNINGS'),
    (r'tops?\s+(?:estimates?|expectations?|consensus|wall\s+street|analyst|forecast)', 0.8, 2.0, 'EARNINGS'),
    (r'exceeds?\s+(?:estimates?|expectations?|consensus|forecast)', 0.8, 2.0, 'EARNINGS'),
    (r'surpasses?\s+(?:estimates?|expectations?|consensus|forecast)', 0.8, 2.0, 'EARNINGS'),
    (r'earnings?\s+beat', 0.8, 2.0, 'EARNINGS'),
    (r'revenue\s+beat', 0.8, 2.0, 'EARNINGS'),
    (r'eps\s+beat', 0.8, 2.0, 'EARNINGS'),
    (r'better\s+than\s+expected', 0.7, 1.5, 'EARNINGS'),
    (r'above\s+expectations?', 0.7, 1.5, 'EARNINGS'),
    (r'ahead\s+of\s+(?:estimates?|expectations?|consensus)', 0.7, 1.5, 'EARNINGS'),
    (r'beats?\s+\w+\s+estimates?', 0.7, 1.5, 'EARNINGS'),  # "beats iPhone estimates"
    (r'revenue\s+(?:tops?|beats?|exceeds?|surpasses?)', 0.7, 1.5, 'EARNINGS'),  # "revenue tops"
    (r'exceeds?\s+(?:wall\s+street|analyst)', 0.7, 1.5, 'EARNINGS'),
    (r'(?:wall\s+street|analyst)\s+expectations?', 0.3, 0.5, 'EARNINGS'),  # Weak on its own
    # Guidance raises
    (r'raises?\s+(?:full[- ]year|annual|quarterly|revenue|earnings|profit|its)?\s*(?:guidance|outlook|forecast)', 0.85, 2.0, 'GUIDANCE'),
    (r'increases?\s+(?:full[- ]year|annual|quarterly|revenue|earnings|profit|its)?\s*(?:guidance|outlook|forecast)', 0.8, 2.0, 'GUIDANCE'),
    (r'lifts?\s+(?:full[- ]year|annual|quarterly|revenue|earnings|profit|its)?\s*(?:guidance|outlook|forecast|revenue)', 0.8, 2.0, 'GUIDANCE'),
    (r'upside\s+(?:guidance|outlook)', 0.8, 2.0, 'GUIDANCE'),
    # Record/strong performance
    (r'record\s+(?:revenue|earnings|profit|income|sales|high)', 0.8, 2.0, 'EARNINGS'),
    (r'all[- ]time\s+high', 0.7, 1.5, 'MARKET_REACTION'),
    (r'surges?\s+(?:\d+%|percent|points?)', 0.7, 1.5, 'MARKET_REACTION'),
    (r'soars?\s+(?:\d+%|percent|points?)', 0.7, 1.5, 'MARKET_REACTION'),
    (r'rallies?\s+(?:\d+%|percent|points?)', 0.7, 1.5, 'MARKET_REACTION'),
    # Analyst upgrades
    (r'upgraded?\s+to\s+(?:buy|outperform|overweight|overweight)', 0.7, 1.5, 'ANALYST_ACTION'),
    (r'raises?\s+price\s+target', 0.6, 1.0, 'ANALYST_ACTION'),
    (r'price\s+target\s+(?:raised|increased|hiked)', 0.6, 1.0, 'ANALYST_ACTION'),
    (r'initiated?\s+(?:with\s+)?(?:buy|outperform|overweight)', 0.6, 1.0, 'ANALYST_ACTION'),
    (r'overweight\s+(?:rating|from)', 0.5, 1.0, 'ANALYST_ACTION'),
    # Business wins
    (r'wins?\s+.*(?:contract|deal)', 0.6, 1.0, 'CONTRACT'),
    (r'contract\s+awarded', 0.6, 1.0, 'CONTRACT'),
    (r'secures?\s+.*(?:contract|deal|partnership)', 0.6, 1.0, 'CONTRACT'),
    (r'awarded.*(?:contract|deal)', 0.6, 1.0, 'CONTRACT'),
    (r'partnership\s+(?:with|announced)', 0.4, 0.5, 'PRODUCT'),
    (r'new\s+partnership', 0.4, 0.5, 'PRODUCT'),
    (r'expand.*partnership', 0.5, 1.0, 'PRODUCT'),
    (r'announce.*partnership', 0.5, 1.0, 'PRODUCT'),
    # Financial health
    (r'buyback\s+authorized', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'share\s+repurchase', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'buyback\s+program', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'dividend\s+increase', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'dividend\s+hike', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'increases?\s+(?:quarterly\s+)?dividend', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'debt\s+reduction', 0.4, 0.5, 'CAPITAL_RETURN'),
    (r'pay\s+down\s+.*debt', 0.5, 1.0, 'CAPITAL_RETURN'),
    (r'positive\s+free\s+cash\s+flow', 0.4, 0.5, 'EARNINGS'),
    # Product/approval
    (r'product\s+launch', 0.5, 1.0, 'PRODUCT'),
    (r'unveils?\s+(?:new|updated)', 0.5, 1.0, 'PRODUCT'),
    (r'launches?\s+(?:new|updated)', 0.5, 1.0, 'PRODUCT'),
    (r'announce.*(?:new|feature|product|partnership)', 0.4, 0.8, 'PRODUCT'),
    (r'regulatory\s+approval', 0.6, 1.0, 'REGULATORY'),
    (r'fda\s+(?:approval|clearance|authorizes)', 0.7, 1.5, 'REGULATORY'),
    (r'acqui(?:re|sition)', 0.4, 0.5, 'M_A'),
    (r'to\s+acquire', 0.4, 0.5, 'M_A'),
    # General positive
    (r'margin\s+expansion', 0.5, 1.0, 'EARNINGS'),
    (r'accelerating\s+growth', 0.6, 1.0, 'EARNINGS'),
    (r'strong\s+demand', 0.5, 1.0, 'EARNINGS'),
    (r'revenue\s+growth', 0.4, 0.5, 'EARNINGS'),
    (r'profit\s+growth', 0.4, 0.5, 'EARNINGS'),
]

# NEGATIVE PHRASES
NEGATIVE_PHRASES: List[Tuple[str, float, float, str]] = [
    # Earnings misses
    (r'misses?\s+(?:estimates?|expectations?|consensus|wall\s+street|analyst)', -0.8, 2.0, 'EARNINGS'),
    (r'falls?\s+short\s+of\s+(?:estimates?|expectations?|consensus)', -0.8, 2.0, 'EARNINGS'),
    (r'below\s+(?:estimates?|expectations?|consensus)', -0.7, 1.5, 'EARNINGS'),
    (r'earnings?\s+miss', -0.8, 2.0, 'EARNINGS'),
    (r'revenue\s+miss', -0.8, 2.0, 'EARNINGS'),
    (r'eps\s+miss', -0.8, 2.0, 'EARNINGS'),
    (r'worse\s+than\s+expected', -0.7, 1.5, 'EARNINGS'),
    (r'behind\s+(?:estimates?|expectations?|consensus)', -0.7, 1.5, 'EARNINGS'),
    # Guidance cuts
    (r'cuts?\s+(?:full[- ]year|annual|quarterly|revenue|earnings|profit|its)?\s*(?:guidance|outlook|forecast)', -0.85, 2.0, 'GUIDANCE'),
    (r'lowers?\s+.*(?:guidance|outlook|forecast)', -0.8, 2.0, 'GUIDANCE'),
    (r'cuts?\s+full[- ]year.*(?:guidance|outlook|forecast)', -0.85, 2.0, 'GUIDANCE'),
    (r'lowers?\s+full[- ]year.*(?:guidance|outlook|forecast)', -0.8, 2.0, 'GUIDANCE'),
    (r'withdraws?\s+(?:guidance|outlook|forecast)', -0.9, 2.0, 'GUIDANCE'),
    (r'downsides?\s+(?:guidance|outlook)', -0.8, 2.0, 'GUIDANCE'),
    (r'cuts?\s+prices?', -0.5, 1.0, 'GENERAL'),
    # Analyst downgrades
    (r'downgraded?\s+to\s+(?:sell|underperform|underweight)', -0.7, 1.5, 'ANALYST_ACTION'),
    (r'cuts?\s+price\s+target', -0.5, 1.0, 'ANALYST_ACTION'),
    (r'price\s+target\s+(?:cut|reduced|lowered)', -0.5, 1.0, 'ANALYST_ACTION'),
    (r'initiated?\s+(?:with\s+)?(?:sell|underperform|underweight)', -0.6, 1.0, 'ANALYST_ACTION'),
    (r'underweight\s+(?:rating|from)', -0.5, 1.0, 'ANALYST_ACTION'),
    # Serious issues
    (r'sec\s+investigation', -0.8, 2.0, 'REGULATORY'),
    (r'opens?\s+investigation', -0.6, 1.5, 'REGULATORY'),
    (r'antitrust\s+investigation', -0.7, 1.5, 'REGULATORY'),
    (r'regulatory\s+investigation', -0.7, 1.5, 'REGULATORY'),
    (r'accounting\s+irregularities', -0.9, 2.0, 'LEGAL'),
    (r'profit\s+warning', -0.8, 2.0, 'EARNINGS'),
    (r'dividend\s+cut', -0.6, 1.5, 'CAPITAL_RETURN'),
    (r'bankruptcy', -1.0, 2.0, 'LEGAL'),
    (r'chapter\s+11', -1.0, 2.0, 'LEGAL'),
    (r'default', -0.7, 1.5, 'LEGAL'),
    (r'(?:hit|slapped|fined)\s+with.*(?:fine|penalty|antitrust)', -0.7, 1.5, 'REGULATORY'),
    (r'fine[ds]?\s+(?:\$|by|for)', -0.6, 1.0, 'REGULATORY'),
    # Operational
    (r'recall', -0.6, 1.0, 'PRODUCT'),
    (r'data\s+breach', -0.7, 1.5, 'CYBERSECURITY'),
    (r'lays?\s+off', -0.6, 1.5, 'MANAGEMENT'),
    (r'layoffs?', -0.6, 1.5, 'MANAGEMENT'),
    (r'job\s+cuts?', -0.6, 1.5, 'MANAGEMENT'),
    (r'cuts?\s+\d+.*jobs?', -0.6, 1.5, 'MANAGEMENT'),  # "cut 18,000 jobs"
    (r'cut\s+\d+', -0.3, 0.5, 'MANAGEMENT'),  # "cut 10,000" (context needed)
    (r'mass\s+layoffs?', -0.7, 1.5, 'MANAGEMENT'),
    (r'staff\s+cuts?', -0.6, 1.5, 'MANAGEMENT'),
    (r'workforce\s+(?:reduction|eliminate|cut)', -0.6, 1.5, 'MANAGEMENT'),
    (r'eliminate.*(?:jobs|positions|workforce)', -0.6, 1.5, 'MANAGEMENT'),
    (r'lawsuit', -0.5, 1.0, 'LEGAL'),
    (r'sued', -0.5, 1.0, 'LEGAL'),
    # Financial weakness
    (r'margin\s+contraction', -0.5, 1.0, 'EARNINGS'),
    (r'weak\s+demand', -0.5, 1.0, 'EARNINGS'),
    (r'revenue\s+decline', -0.5, 1.0, 'EARNINGS'),
    (r'profit\s+decline', -0.5, 1.0, 'EARNINGS'),
    (r'losses\s+(?:mount|widen|grow)', -0.5, 1.0, 'EARNINGS'),
    # General negative
    (r'warning', -0.4, 0.5, 'GENERAL'),
    (r'warns?\s+(?:of|about|that)\s+(?:slowing|weak|declining|risk|impact|headwind)', -0.7, 1.5, 'GUIDANCE'),
    (r'warns?\s+(?:of|about|that)', -0.5, 1.0, 'GUIDANCE'),
    (r'headwind', -0.3, 0.5, 'GENERAL'),
    (r'selloff', -0.5, 1.0, 'MARKET_REACTION'),
    (r'sell[- ]off', -0.5, 1.0, 'MARKET_REACTION'),
    (r'correction', -0.4, 0.5, 'MARKET_REACTION'),
    (r'security\s+vulnerability', -0.5, 1.0, 'CYBERSECURITY'),
    (r'resign', -0.4, 0.5, 'MANAGEMENT'),
    (r'resigns', -0.4, 0.5, 'MANAGEMENT'),
    (r'price\s+target\s+cut', -0.5, 1.0, 'ANALYST_ACTION'),
    (r'price\s+target\s+(?:reduced|lowered)', -0.5, 1.0, 'ANALYST_ACTION'),
]

# SINGLE-WORD fallback (lower priority than phrases)
POSITIVE_WORDS = [
    'surge', 'soar', 'rally', 'boom', 'bullish', 'gains', 'growth', 'strong',
    'record', 'outperform', 'beats', 'exceeds', 'profit', 'upgrade', 'breakthrough',
    'momentum', 'milestone', 'innovation', 'expansion', 'uptick', 'upside', 'breakout',
]

NEGATIVE_WORDS = [
    'crash', 'plunge', 'plummet', 'bearish', 'losses', 'weakness', 'underperform',
    'misses', 'decline', 'recession', 'fear', 'panic', 'correction', 'downgrade',
    'overvaluation', 'slump', 'tumble', 'restructur', 'headwind', 'drag',
]

# EXPECTATION PHRASES — these modify the interpretation
EXPECTATION_POSITIVE = [
    (r'better\s+than\s+expected', 0.5),
    (r'better[- ]than[- ]expected', 0.5),
    (r'exceeds?\s+expectations?', 0.5),
    (r'above\s+expectations?', 0.5),
    (r'ahead\s+of\s+(?:estimates?|expectations?)', 0.5),
    (r'beats?\s+(?:wall\s+street|consensus|analyst)', 0.5),
    (r'tops?\s+(?:wall\s+street|consensus|analyst)', 0.5),
    (r'not\s+overvalued', 0.3),
    (r'not\s+undervalued', -0.3),
]

EXPECTATION_NEGATIVE = [
    (r'worse\s+than\s+expected', -0.5),
    (r'worse[- ]than[- ]expected', -0.5),
    (r'below\s+expectations?', -0.5),
    (r'behind\s+(?:estimates?|expectations?)', -0.5),
    (r'misses?\s+(?:wall\s+street|consensus|analyst)', -0.5),
    (r'falls?\s+short\s+of', -0.5),
    (r'disappointing', -0.4),
]

# IN-LINE phrases — should be near neutral
IN_LINE_PHRASES = [
    r'in\s+line\s+with\s+(?:expectations?|estimates?|consensus)',
    r'meets?\s+(?:expectations?|estimates?|consensus)',
    r'as\s+expected',
    r'in\s+line\s+with\s+(?:guidance|outlook)',
]

# CONTRAST SIGNALS — indicate later clause may dominate
CONTRAST_SIGNALS = [
    'but', 'however', 'despite', 'although', 'yet', 'while', 'even as',
    'nevertheless', 'nonetheless', 'on the other hand', 'conversely',
    'in contrast', 'whereas',
]

# NEGATION SIGNALS — invalidate/flip nearby sentiment
NEGATION_SIGNALS = [
    'not', "n't", 'no', 'never', 'neither', 'nor', 'barely', 'hardly',
    'without', 'lack', 'lacking', 'failed', 'fails', 'unable',
    'did not', 'does not', 'do not', 'is not', 'are not', 'was not', 'were not',
    'has not', 'have not', 'had not', 'will not', 'would not', 'could not',
    'should not', 'cannot', "can't", "won't", "wouldn't", "couldn't", "shouldn't",
]

# MARKET REACTION PHRASES — these describe price movement, not fundamental sentiment
MARKET_REACTION_PATTERNS = [
    (r'shares?\s+(?:falls?|drops?|declines?|dips?|slides?|tumbles?|plunges?|craters?)', -0.4, 'NEGATIVE'),
    (r'stock\s+(?:falls?|drops?|declines?|dips?|slides?|tumbles?|plunges?)', -0.4, 'NEGATIVE'),
    (r'shares?\s+(?:rises?|climbs?|jumps?|surges?|soars?|rallies?|pops?|gains?)', 0.4, 'POSITIVE'),
    (r'stock\s+(?:rises?|climbs?|jumps?|surges?|soars?|rallies?|pops?|gains?)', 0.4, 'POSITIVE'),
    (r'slips?\s+(?:\d+%|percent)', -0.3, 'NEGATIVE'),
    (r'dips?\s+(?:\d+%|percent)', -0.3, 'NEGATIVE'),
    (r'jumps?\s+(?:\d+%|percent)', 0.3, 'POSITIVE'),
    (r'gains?\s+(?:\d+%|percent)', 0.3, 'POSITIVE'),
    (r'surges?\s+(?:\d+%|percent)', 0.4, 'POSITIVE'),
    (r'tumbles?\s+(?:\d+%|percent)', -0.4, 'NEGATIVE'),
    (r'plunges?\s+(?:\d+%|percent)', -0.4, 'NEGATIVE'),
]

# ─── Text Normalization ─────────────────────────────────────────────────────

def _normalize_text(text: str) -> str:
    """Normalize text for pattern matching while preserving sentiment signals."""
    if not text:
        return ""
    # Remove HTML
    text = re.sub(r'<[^>]+>', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Normalize quotes
    text = re.sub(r'["""]', '"', text)
    text = re.sub(r"['']", "'", text)
    # Normalize dashes
    text = re.sub(r'[–—]', '-', text)
    return text


def _combine_title_desc(title: str, description: str) -> str:
    """Combine title and description for scoring, avoiding duplication."""
    title = (title or "").strip()
    desc = (description or "").strip()
    if not title and not desc:
        return ""
    if not desc:
        return title
    if not title:
        return desc[:512]
    # If description contains the title, just use description
    if title.lower() in desc.lower():
        return desc[:512]
    return f"{title}. {desc[:400]}"


# ─── Negation Detection ─────────────────────────────────────────────────────

def _detect_negation(text: str, phrase_start: int, phrase_end: int, window: int = 10) -> bool:
    """
    Check if a phrase within [phrase_start, phrase_end] is negated.
    Looks at the `window` words before the phrase, or checks multi-word negation patterns.
    """
    # Check multi-word negation patterns first (more reliable)
    before_text = text[:phrase_start]
    multi_word_negations = [
        'does not', 'did not', 'do not', 'is not', 'are not', 'was not', 'were not',
        'has not', 'have not', 'had not', 'will not', 'would not', 'could not',
        'should not', 'cannot', "can't", "won't", "wouldn't", "couldn't", "shouldn't",
        "doesn't", "didn't", "don't", "isn't", "aren't", "wasn't", "weren't",
        "hasn't", "haven't", "hadn't",
        'not plan to', 'not intend', 'not going to',
        'neither nor',
    ]
    for neg_pattern in multi_word_negations:
        if before_text.endswith(neg_pattern) or (' ' + neg_pattern + ' ') in before_text or before_text.endswith(neg_pattern + ' '):
            return True

    # Word-based window check
    words_before = text[:phrase_start].split()[-window:]
    for w in reversed(words_before):
        w_clean = w.strip('.,;:!?()"\'').lower()
        if w_clean in ('not', "n't", 'no', 'never', 'neither', 'nor', 'barely', 'hardly', 'without', 'lack', 'lacking', 'failed', 'fails', 'unable'):
            return True
        if w_clean in ('did', 'does', 'do', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'could', 'should', 'can'):
            continue
        if w_clean in ("don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't", "won't", "wouldn't", "couldn't", "shouldn't", "can't", "cannot"):
            return True
        if w_clean in ('the', 'a', 'an', 'and', 'or', 'but', 'for', 'in', 'on', 'at', 'to', 'of', 'with', 'by', 'from'):
            continue
        break
    return False


# ─── Contrast Detection ─────────────────────────────────────────────────────

def _split_contrast(text: str) -> List[Tuple[str, str]]:
    """
    Split text at contrast signals.
    Returns list of (clause_text, position) tuples.
    Later clauses may deserve stronger weight.
    """
    # Find contrast signal positions
    text_lower = text.lower()
    for signal in sorted(CONTRAST_SIGNALS, key=len, reverse=True):
        idx = text_lower.find(signal)
        if idx >= 0:
            before = text[:idx].strip()
            after = text[idx + len(signal):].strip().lstrip(',:;')
            if before and after:
                return [(before, 'before'), (after, 'after')]
    return [(text, 'full')]


# ─── Event Classification ───────────────────────────────────────────────────

def _classify_events(text: str) -> List[str]:
    """Classify what types of events are mentioned in the text."""
    text_lower = text.lower()
    events = []

    # Earnings
    if any(kw in text_lower for kw in ['earnings', 'quarterly results', 'q1 results', 'q2 results', 'q3 results', 'q4 results', 'fiscal year', 'eps', 'per share']):
        events.append('EARNINGS')
    # Guidance
    if any(kw in text_lower for kw in ['guidance', 'outlook', 'forecast', 'raised guidance', 'lowered guidance', 'full-year']):
        events.append('GUIDANCE')
    # Analyst
    if any(kw in text_lower for kw in ['upgrade', 'downgrade', 'price target', 'analyst', 'initiated', 'rating', 'overweight', 'underweight', 'outperform', 'underperform']):
        events.append('ANALYST_ACTION')
    # M&A
    if any(kw in text_lower for kw in ['acquisition', 'acquire', 'merger', 'buyout', 'takeover', 'bid for']):
        events.append('M_A')
    # Regulatory
    if any(kw in text_lower for kw in ['regulatory', 'sec', 'antitrust', 'investigation', 'probe', 'compliance', 'fda']):
        events.append('REGULATORY')
    # Legal
    if any(kw in text_lower for kw in ['lawsuit', 'sued', 'legal', 'court', 'settlement', 'litigation']):
        events.append('LEGAL')
    # Product
    if any(kw in text_lower for kw in ['launch', 'unveil', 'release', 'announce', 'product', 'feature', 'update']):
        events.append('PRODUCT')
    # Contract
    if any(kw in text_lower for kw in ['contract', 'deal', 'partnership', 'agreement', 'award']):
        events.append('CONTRACT')
    # Management
    if any(kw in text_lower for kw in ['ceo', 'cfo', 'chairman', 'appoint', 'resign', 'depart', 'executive']):
        events.append('MANAGEMENT')
    # Capital return
    if any(kw in text_lower for kw in ['dividend', 'buyback', 'repurchase', 'capital return']):
        events.append('CAPITAL_RETURN')
    # Cybersecurity
    if any(kw in text_lower for kw in ['breach', 'hack', 'cyber', 'ransomware', 'data leak']):
        events.append('CYBERSECURITY')
    # Market reaction
    if any(kw in text_lower for kw in ['shares', 'stock', 'trading', 'market', 'investors']):
        events.append('MARKET_REACTION')

    return events if events else ['GENERAL']


# ─── Market Reaction vs Company Event ───────────────────────────────────────

def _detect_market_reaction(text: str) -> Optional[Tuple[float, str]]:
    """
    Detect market reaction language.
    Returns (direction, description) or None.
    direction: positive = stock price up, negative = stock price down.
    """
    text_lower = text.lower()
    for pattern, score, direction in MARKET_REACTION_PATTERNS:
        if re.search(pattern, text_lower):
            return (score, direction)
    return None


# ─── Article Sentiment Scoring ───────────────────────────────────────────────

def score_article(title: str, description: str = "") -> Dict[str, Any]:
    """
    Score a single article's sentiment.

    Returns:
        {
            "label": "positive" | "neutral" | "negative",
            "score": float (-1.0 to +1.0),
            "positive_count": int,
            "negative_count": int,
            "events": List[str],
            "matched_phrases": List[str],
            "negation_detected": bool,
            "contrast_detected": bool,
            "market_reaction": Optional[str],
            "explanation": str,
        }
    """
    text = _combine_title_desc(title, description)
    text_norm = _normalize_text(text)
    text_lower = text_norm.lower()

    if not text_norm.strip():
        return {
            "label": "neutral",
            "score": 0.0,
            "positive_count": 0,
            "negative_count": 0,
            "events": [],
            "matched_phrases": [],
            "negation_detected": False,
            "contrast_detected": False,
            "market_reaction": None,
            "explanation": "Empty text",
        }

    # ── Step 1: Check for in-line / neutral expectation phrases ──
    for pattern in IN_LINE_PHRASES:
        if re.search(pattern, text_lower):
            # "in line with expectations" = very near neutral
            return {
                "label": "neutral",
                "score": 0.05,
                "positive_count": 0,
                "negative_count": 0,
                "events": _classify_events(text_lower),
                "matched_phrases": [pattern],
                "negation_detected": False,
                "contrast_detected": False,
                "market_reaction": None,
                "explanation": f"Matched in-line phrase: {pattern}",
            }

    # ── Step 2: Detect contrast ──
    clauses = _split_contrast(text_norm)
    contrast_detected = len(clauses) > 1

    # ── Step 3: Score each clause ──
    all_scores = []
    clause_is_market_reaction = []
    matched_phrases = []
    negation_detected = False
    events = set()

    for clause_text, position in clauses:
        clause_lower = clause_text.lower()
        clause_score = 0.0
        pos_count = 0
        neg_count = 0

        # Check if this clause is primarily a market reaction
        is_mr = _detect_market_reaction(clause_lower) is not None

        # Score positive phrases
        for pattern, score, magnitude, event_type in POSITIVE_PHRASES:
            matches = list(re.finditer(pattern, clause_lower))
            for m in matches:
                is_negated = _detect_negation(clause_lower, m.start(), m.end())
                if is_negated:
                    negation_detected = True
                    clause_score += (-score * magnitude * 0.6)
                    neg_count += 1
                    matched_phrases.append(f"NEGATED: {m.group()}")
                else:
                    clause_score += (score * magnitude)
                    pos_count += 1
                    matched_phrases.append(m.group())
                    events.add(event_type)

        # Score negative phrases
        for pattern, score, magnitude, event_type in NEGATIVE_PHRASES:
            matches = list(re.finditer(pattern, clause_lower))
            for m in matches:
                is_negated = _detect_negation(clause_lower, m.start(), m.end())
                if is_negated:
                    negation_detected = True
                    clause_score += (-score * magnitude * 0.6)
                    pos_count += 1
                    matched_phrases.append(f"NEGATED: {m.group()}")
                else:
                    clause_score += (score * magnitude)
                    neg_count += 1
                    matched_phrases.append(m.group())
                    events.add(event_type)

        # Single-word fallback (only if no phrases matched)
        if pos_count + neg_count == 0:
            for word in POSITIVE_WORDS:
                m = re.search(r'\b' + re.escape(word) + r'\w*\b', clause_lower)
                if m:
                    if _detect_negation(clause_lower, m.start(), m.end()):
                        clause_score -= 0.3
                        neg_count += 1
                    else:
                        clause_score += 0.3
                        pos_count += 1
                    break
            for word in NEGATIVE_WORDS:
                m = re.search(r'\b' + re.escape(word) + r'\w*\b', clause_lower)
                if m:
                    if _detect_negation(clause_lower, m.start(), m.end()):
                        clause_score += 0.3
                        pos_count += 1
                    else:
                        clause_score -= 0.3
                        neg_count += 1
                    break

        # Apply expectation modifier
        for pattern, modifier in EXPECTATION_POSITIVE:
            if re.search(pattern, clause_lower):
                clause_score += modifier
                matched_phrases.append(f"EXPECTATION: {re.search(pattern, clause_lower).group()}")
        for pattern, modifier in EXPECTATION_NEGATIVE:
            if re.search(pattern, clause_lower):
                clause_score += modifier
                matched_phrases.append(f"EXPECTATION: {re.search(pattern, clause_lower).group()}")

        all_scores.append(clause_score)
        clause_is_market_reaction.append(is_mr)

    # ── Step 4: Combine clause scores ──
    if not all_scores:
        final_score = 0.0
    elif len(all_scores) == 1:
        final_score = all_scores[0]
    else:
        # With contrast: weight fundamental events more than market reactions
        has_mr = any(clause_is_market_reaction)
        has_fundamental = any(not mr for mr in clause_is_market_reaction)

        if has_mr and has_fundamental:
            # Fundamental event gets 70% weight, market reaction gets 30%
            fundamental_scores = [s for s, is_mr in zip(all_scores, clause_is_market_reaction) if not is_mr]
            mr_scores = [s for s, is_mr in zip(all_scores, clause_is_market_reaction) if is_mr]
            if fundamental_scores and mr_scores:
                final_score = fundamental_scores[0] * 0.7 + mr_scores[-1] * 0.3
            else:
                final_score = all_scores[0] * 0.4 + all_scores[-1] * 0.6
        else:
            # No market reaction mix: later clause gets 60% weight
            final_score = all_scores[0] * 0.4 + all_scores[-1] * 0.6

    # Normalize score to [-1, 1]
    # Use less aggressive scaling so phrase signals aren't washed out
    if abs(final_score) > 3.0:
        final_score = max(-1.0, min(1.0, final_score / 3.0))
    elif abs(final_score) > 1.5:
        final_score = max(-1.0, min(1.0, final_score / 2.0))
    else:
        final_score = max(-1.0, min(1.0, final_score * 0.7))

    # ── Step 5: Detect market reaction (separate from company event) ──
    market_reaction = _detect_market_reaction(text_lower)

    # ── Step 6: Classify ──
    total_count = pos_count + neg_count
    if final_score > 0.15:
        label = "positive"
    elif final_score < -0.15:
        label = "negative"
    else:
        label = "neutral"

    # ── Step 7: Explanation ──
    explanation_parts = []
    if matched_phrases:
        explanation_parts.append(f"Phrases: {', '.join(matched_phrases[:5])}")
    if events:
        explanation_parts.append(f"Events: {', '.join(events)}")
    if negation_detected:
        explanation_parts.append("Negation detected")
    if contrast_detected:
        explanation_parts.append("Contrast detected")
    if market_reaction:
        explanation_parts.append(f"Market reaction: {market_reaction[1]}")

    return {
        "label": label,
        "score": round(final_score, 4),
        "positive_count": pos_count,
        "negative_count": neg_count,
        "events": list(events),
        "matched_phrases": matched_phrases,
        "negation_detected": negation_detected,
        "contrast_detected": contrast_detected,
        "market_reaction": market_reaction[1] if market_reaction else None,
        "explanation": "; ".join(explanation_parts) if explanation_parts else "No strong signals",
    }


# ─── Legacy API ─────────────────────────────────────────────────────────────

def score_text_keywords(text: str) -> float:
    """Legacy: Score text from -1.0 to +1.0 based on keywords. Used by engine.py fallback."""
    result = score_article(text, "")
    return result["score"]


def is_entity_relevant(text: str, ticker: str) -> bool:
    """Check if article text is actually about the target ticker/company."""
    text_lower = text.lower()
    if ticker.lower() in text_lower:
        return True
    from typing import Dict, List
    COMPANY_ALIASES: Dict[str, List[str]] = {
        "AAPL": ["apple"], "MSFT": ["microsoft"], "NVDA": ["nvidia"],
        "GOOGL": ["google", "alphabet"], "GOOG": ["google", "alphabet"],
        "AMZN": ["amazon"], "META": ["meta", "facebook"], "TSLA": ["tesla"],
        "JPM": ["jpmorgan", "jp morgan"], "V": ["visa"],
        "JNJ": ["johnson", "j&j"], "WMT": ["walmart"],
        "PG": ["procter"], "MA": ["mastercard"], "UNH": ["unitedhealth"],
        "HD": ["home depot"], "DIS": ["disney"], "BAC": ["bank of america"],
        "XOM": ["exxon", "exxonmobil"], "PFE": ["pfizer"], "CSCO": ["cisco"],
        "NFLX": ["netflix"], "CRM": ["salesforce"], "AMD": ["advanced micro"],
        "INTC": ["intel"], "KO": ["coca-cola", "coke"], "PEP": ["pepsi"],
        "ADBE": ["adobe"], "COST": ["costco"], "NKE": ["nike"],
        "MRK": ["merck"], "ABBV": ["abbvie"], "TMO": ["thermo fisher"],
        "ACN": ["accenture"], "AVGO": ["broadcom"], "MCD": ["mcdonald"],
        "COP": ["conocophillips", "conoco"], "WFC": ["wells fargo"],
        "DHR": ["danaher"], "LIN": ["linde"], "PM": ["philip morris"],
        "TXN": ["texas instruments"], "RTX": ["raytheon"],
        "HON": ["honeywell"], "LOW": ["lowe", "lowes"], "IBM": ["ibm"],
        "QCOM": ["qualcomm"], "CAT": ["caterpillar"], "BA": ["boeing"],
        "GE": ["general electric"], "SPY": ["s&p 500"], "QQQ": ["nasdaq"],
        "GLD": ["gold"], "IWM": ["russell 2000"],
    }
    aliases = COMPANY_ALIASES.get(ticker.upper(), [])
    for alias in aliases:
        if alias.lower() in text_lower:
            return True
    return False


def analyze_text_sentiment(texts: List[str]) -> List[float]:
    """Analyze sentiment of texts - keyword-based scoring."""
    return [score_article(text, "")["score"] for text in texts]


def analyze_news_sentiment(
    news_items: List[Dict[str, Any]],
    ticker: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyze sentiment of news items.
    Returns dict with sentiment_score, sentiment_label, status, positive_count, negative_count, and scored news.

    status:
      - "sufficient": enough relevant articles to form a meaningful opinion
      - "insufficient": no relevant articles found (empty after filtering)
      - "error": provider errors (empty input)
    """
    if not news_items:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Insufficient News",
            "status": "insufficient",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "news": []
        }

    # Entity relevance filtering
    if ticker:
        relevant = [
            item for item in news_items
            if is_entity_relevant(
                item.get("title", "") + " " + item.get("full_text", "") + " " + item.get("description", ""),
                ticker,
            )
        ]
    else:
        relevant = news_items

    if not relevant:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "Insufficient News",
            "status": "insufficient",
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "news": []
        }

    scored_news = []
    for item in relevant:
        text = item.get("title", "") + " " + item.get("full_text", "")
        result = score_article(item.get("title", ""), item.get("full_text", ""))
        scored_news.append({
            **item,
            "sentiment": round(result["score"], 4),
            "sentiment_label": result["label"],
            "events": result["events"],
        })

    positive_count = sum(1 for n in scored_news if n["sentiment_label"] == "positive")
    negative_count = sum(1 for n in scored_news if n["sentiment_label"] == "negative")
    neutral_count = len(scored_news) - positive_count - negative_count

    avg_sentiment = sum(n["sentiment"] for n in scored_news) / len(scored_news) if scored_news else 0.0

    if avg_sentiment > 0.15:
        label = "Positive"
    elif avg_sentiment < -0.15:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "sentiment_score": round(avg_sentiment, 4),
        "sentiment_label": label,
        "status": "sufficient",
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": neutral_count,
        "news": scored_news,
    }
