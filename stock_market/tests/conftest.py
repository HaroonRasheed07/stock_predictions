"""Shared test setup: make stock_market + repo root importable."""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)  # stock_market
_REPO = os.path.dirname(_ROOT)  # repo root
for p in (_ROOT, _REPO):
    if p not in sys.path:
        sys.path.insert(0, p)
