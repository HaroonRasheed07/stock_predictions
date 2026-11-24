# Editorial Standards

**Date:** 2026-11-24
**Public route:** `/editorial-standards`

## Ownership

- StockVantex is created and maintained by Haroon Rasheed, publicly identified as `AI Developer & Creator of StockVantex` on the About page.
- He is responsible for technical explanations, indicator definitions, model descriptions, data-pipeline disclosures and corrections.
- No editorial board, licensed analyst, certified adviser, external reviewer, independent audit or credential is claimed.
- Technical claims are checked against source code and tests, not against invented external authority.

## Evidence standards

- Technical and financial claims are separated.
- Data freshness is described as snapshot refresh time, not exchange quote timestamp.
- Forecast outputs are point estimates unless a reproducible out-of-sample result supports a stronger claim.
- In-sample fit is labelled as a reconstruction proxy.
- Missing data, provider failure and insufficient news are shown as limitations.
- Educational articles distinguish general concepts from the specific StockVantex implementation.

## Review status

| Area | Status |
|---|---|
| Indicators / risk definitions | Source-documented; non-canonical variants disclosed. |
| Forecast validation | Small AAPL/MSFT holdout only; no walk-forward folds, no public error table, no baseline comparison. |
| News sentiment | Provider tags with keyword fallback; no FinBERT or social data. |
| Financial review | No independent financial or regulatory review obtained. |

## Publishing and revisions

A change is material when it alters a displayed number, formula, forecast horizon, data-source description or validation claim. Material changes are logged publicly. Routine wording/accessibility edits may not be logged individually.

## Correction intake

Email `haroon@stockvantex.com` with subject `Correction request`. Include:

1. page URL;
2. exact claim or number;
3. evidence relied on;
4. date observed.

Confirmed factual errors are corrected in place and dated in the public log. Entries are not removed to make the record appear cleaner.

## Public correction log summary

- **2026-11-24 — Public claim alignment:** removed accuracy, confidence-range, live-feed, real-time-data and trained-financial-text claims.
- **2026-11-24 — Forecast terminology:** corrected holiday-calendar language, relabelled accuracy and in-sample fit terms.
- **2026-11-24 — Validation disclosure:** disclosed absent walk-forward folds, error tables, baselines and calibrated intervals.

## Boundary

Editorial standards describe technical accountability only. They do not constitute financial advice, licensing, certification, audit or editorial independence.
