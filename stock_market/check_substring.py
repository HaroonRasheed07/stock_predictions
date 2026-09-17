"""Check for substring false-positive risks in phrase patterns."""
import sys, re
sys.path.insert(0, r'E:\fyp_web')
from shared_sentiment import NEGATIVE_PHRASES, POSITIVE_PHRASES

test_texts = [
    'analysts issued research notes on the company',
    'the company issued a statement',
    'board issued new guidelines',
    'trading volume was higher than average today',
]

for text in test_texts:
    text_lower = text.lower()
    for pattern, score, mag, event in NEGATIVE_PHRASES:
        m = re.search(pattern, text_lower)
        if m:
            start, end = m.start(), m.end()
            before = text_lower[start-1:start] if start > 0 else ' '
            after = text_lower[end:end+1] if end < len(text_lower) else ' '
            is_word = not before.isalnum() and not after.isalnum()
            if not is_word:
                print(f'SUBSTRING: pattern="{pattern}" match="{m.group()}" in "{text}"')
    for pattern, score, mag, event in POSITIVE_PHRASES:
        m = re.search(pattern, text_lower)
        if m:
            start, end = m.start(), m.end()
            before = text_lower[start-1:start] if start > 0 else ' '
            after = text_lower[end:end+1] if end < len(text_lower) else ' '
            is_word = not before.isalnum() and not after.isalnum()
            if not is_word:
                print(f'SUBSTRING: pattern="{pattern}" match="{m.group()}" in "{text}"')
