# Indicator Validation Report

**Date:** 2026-11-24
**Scope:** formula review and numerical-integrity fixes for technical indicators, volatility, risk, opportunity, signal evidence and Monte Carlo simulation.

## Method

Reviewed implementations against their documented definitions and existing unit tests. Where a calculation was changed, a regression test was added in `stock_market/tests/test_project02_integrity.py`. No indicator was silently redefined to match a textbook variant.

## Formula status

| Component | Location | Status |
|---|---|---|
| SMA20 / SMA50 | `indicators.py` | Pass — rolling simple means with expected windows. |
| EMA20 | `indicators.py` | Concern — recursive EWM behavior should be described precisely if shown publicly. |
| RSI14 | `indicators.py:114-130` | Documented variant — implementation uses `ewm(com=13, min_periods=14, adjust=False)` while the adjacent doc comment describes a Wilder SMA seed. A probe produced first RSI `53.693939` vs canonical Wilder `50.0` on the same sample. Not silently changed. |
| MACD 12/26/9 | `indicators.py` | Concern — values are deterministic but should not be described as independently validated. |
| Bollinger Bands | `indicators.py` | Concern — sample/population standard-deviation convention should be explicitly documented if shown publicly. |
| ATR14 | `volatility.py:72-100` | Simple rolling mean of True Range; documented as such. |
| ADX / DMI | none found | Not implemented. Any ADX article is educational, not a claim that the platform computes ADX. |
| Daily volatility | `volatility.py` | Sample standard deviation of simple daily returns, annualized by √252. Methodology corrected from “log returns”. |
| Risk score | `risk.py` | 40% volatility / 30% inverted trend / 30% ATR-price; bands 35/65 unchanged. |
| Opportunity score | `opportunity.py` | Five-factor score with display bands 40/70; unchanged. |
| Signal evidence | `signal_history.py` | Historical rule-based hit rates; labeled as historical hit rate, not model accuracy. |

## Defects fixed

1. **Volatility cache collision** — `get_volatility_summary()` keys now include a data fingerprint so different snapshots cannot share cached results when ticker labels are omitted.
2. **Relative-volume rounding** — `safe_float(rel_vol, 2)` incorrectly used the second positional argument as a default; now `safe_float(round(rel_vol, 2))`.
3. **Trend-score infinite values** — `calculate_trend_strength()` converts components to float and rejects non-finite values, returning neutral `50.0`.
4. **Signal-evidence zero prices** — all four historical backtests skip entries where Close is zero/non-finite, preventing divide-by-zero/infinite returns.
5. **Trade confirmation empty indicator frame** — now returns `Insufficient data for confirmation` instead of indexing an empty dataframe.
6. **Monte Carlo negative prices** — pure `simulate_price_paths()` helper clamps simulated returns above `-0.999`; Streamlit simulation now uses it.

## Tests added

`stock_market/tests/test_project02_integrity.py` covers:

- snapshot-scoped volatility cache;
- two-decimal relative volume;
- infinite trend component rejection;
- non-finite and non-positive forecast output rejection;
- zero-price signal evidence;
- empty indicator-frame trade confirmation;
- strictly positive Monte Carlo paths.

Full backend result: **66 passed** (`python -m pytest tests -q`), with only the pre-existing FastAPI `on_event` deprecation warning.

## Limitations

- RSI/MACD/EMA/Bollinger conventions were disclosed, not rewritten; changing them would alter historical outputs and require a separate product decision.
- No canonical-library differential test suite was added for every indicator.
- No claim is made that technical indicators predict returns.
