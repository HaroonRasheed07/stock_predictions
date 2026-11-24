# Financial Claim Audit

**Date:** 2026-11-24
**Scope:** public financial-trust, E-E-A-T and research-integrity claims on `https://stockvantex.com/` and in `E:\fyp_web\Market-Analysis-project-\src`.
**Verdict:** multiple material claims were unsupported by the live implementation. They have been corrected or removed in source; production will reflect them after the next deploy.

## Method

1. Fetched live homepage and methodology copy.
2. Searched source for accuracy, confidence, real-time, probabilistic, backtesting, holiday-calendar, social-data and credential claims.
3. Traced each high-risk claim to the implementing module (`api.py`, `forecast_onnx.py`, `train_lstm_test_multi.py`, `news_engine/*`, `indicators.py`, `volatility.py`, cache and market-status modules).
4. Classified each claim as supported, unsupported, or misleading without evidence.
5. Corrected public copy and recorded the changes in `/editorial-standards` and this audit.

## Material findings and actions

| Finding | Evidence | Verdict | Action |
|---|---|---|---|
| `analysis/page.tsx:21` claimed “Advanced ML models for accurate price predictions.” | No walk-forward fold results, no out-of-sample error table, no directional baseline comparison. | Unsupported | Replaced with point-estimate LSTM outlook with documented limitations. |
| `analysis/page.tsx:51` claimed “Professional-grade analytics and forecasting tools for data-driven trading decisions.” | No professional review, licensure or advisory status. | Misleading | Replaced with educational research-tool wording. |
| `analysis/page.tsx:14` claimed sentiment tracking “across news and social media.” | `news_engine/providers.py:1098-1105` has no social provider. | Unsupported | Replaced with recent financial-news sentiment and source attribution. |
| `analysis/page.tsx:35` claimed “Real-time market data.” | Cache/SWR snapshot model; UI age is cache write time. | Misleading | Replaced with cached market snapshot. |
| `TrustStrip.tsx:12` claimed “error measures” were shown. | No published error distribution/interval calibration. | Unsupported | Replaced with known validation gaps. |
| `MarketRead.tsx:57` said “Live feeds active.” | Snapshot availability, not live feed verification. | Misleading | Replaced with “Snapshot available”. |
| `format.ts:31-34` said “Data updated …”. | Value derives from cache write time. | Misleading | Relabelled “Snapshot refreshed …”. |
| `about/AboutClient.tsx:174` listed “Confidence Ranges.” | `forecast_onnx.py` returns point estimates only. | Unsupported | Replaced with “Point-Estimate Path”. |
| Forecast layout/page claimed “Probabilistic projections with confidence ranges.” | No calibrated uncertainty model. | Unsupported | Replaced with no-calibrated-interval wording. |
| Forecast page said `Historical fit (MAPE-based)` and `Overall Accuracy`. | Value is in-sample reconstruction similarity. | Misleading | Relabelled as in-sample fit proxy and historical signal hit rate. |
| Forecast page said dates exclude market holidays. | `forecast_onnx.py:147-151` uses `pd.date_range(freq="B")` only. | Invalid | Corrected to weekday steps; holidays not modeled. |
| Methodology said language models trained on financial text and walk-forward validation. | No FinBERT/NLP model in production; only small AAPL/MSFT holdout report. | Unsupported | Corrected with provider-tag/keyword fallback and validation-gap disclosure. |
| `stocks/[symbol]/page.tsx` said market data updated via live feeds. | Cached research snapshot. | Misleading | Relabelled snapshot refresh. |
| Learn article claimed outputs are probabilistic with confidence ranges. | Product emits point estimates. | Unsupported | Rewrote confidence section and key takeaways. |

## Editorial trust findings

- The About page identifies Haroon Rasheed as `AI Developer & Creator of StockVantex`; no credential was invented or upgraded.
- No correction policy, correction log, review-status table or editorial ownership page existed publicly.
- A new public `/editorial-standards` route now documents ownership, evidence standards, review status, correction intake and a dated correction log.
- Contact now routes factual corrections with subject `Correction request`.
- Footer, About, Contact and Methodology link to the editorial policy.

## Disclosure decisions

- The site is research/informational, not investment advice; disclaimer language already existed and was aligned with corrected marketing copy.
- No analyst, CFA, reviewer, editorial board, paid-data partnership, publication, independent audit or performance result was added.
- Limitations are stated adjacent to the affected claims rather than hidden only in a footer disclaimer.

## Limitations

- Live production was not deployed in this task; live HTML may still show pre-correction wording until redeploy.
- No browser visual QA, GSC recheck, ranking check, or live provider-contract verification was performed.
- No independent financial or regulatory review was obtained.
