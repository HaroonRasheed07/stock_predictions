# StockVantex Content Improvement Report

**Date:** 2026-11-24
**Scope:** 100 public URLs (29 Learn, 52 stock research, 19 utility/static). All changes were made in the existing Next.js app; no URLs, navigation, calculators, data providers, or ad/analytics integrations were changed.

## 1. Priority Learn article expansion

| URL | Before (rendered words) | After | What was added |
|---|---:|---:|---|
| `/learn/technical-vs-fundamental-analysis` | 387 | 1,235 | Objectives/inputs/assumptions comparison table, explicit "when vs what/why" framing, strengths and limitations subsections, a clearly hypothetical worked example, combined-workflow guidance, 4-question FAQ, `/methodology` and research-guide links. **FAQ schema added** (previously missing). |
| `/learn/what-is-technical-analysis` | 622 | 1,121 | Three Core Assumptions, a practical reading sequence, indicator subsections with contextual links to RSI/MACD/SMA-vs-EMA/ADX/Bollinger/ATR, two extra FAQ entries, `/methodology` link. |
| `/learn/what-is-atr` | 586 | 1,211 | True Range worked example, explicit platform-simple-average vs Wilder-recursive smoothing distinction, ATR% formula and examples, ATR-based position-sizing arithmetic, key takeaways, FAQ +2, `/methodology` link. |
| `/learn/what-is-adx` | 756 | 1,120 | Full Wilder formula chain (+DM/−DM → +DI/−DI → DX → ADX), trend-strength bands, FAQ +2, and an honest note that StockVantex computes a composite 0–100 trend score rather than ADX. |
| `/learn/rsi-vs-macd` | 432 | 1,056 | Calculation comparison table, conflicting-signal scenarios, a 4-step combined workflow, FAQ +3, and tool links to technical analysis and methodology. |

All five articles now carry `FAQPage` JSON-LD where applicable, have `updatedAt: 2026-11-24`, and retain their original slugs and author byline.

## 2. Differentiation and metadata hygiene

| Item | Change | Reason |
|---|---|---|
| `/learn/stock-watchlist-guide` | Title/H1 changed from "How to Build a Stock Watchlist: A Practical Guide for Investors" to **"What Is a Stock Watchlist? A 5-Step Setup Guide"**; `updatedAt` bumped. URL unchanged. | Removed direct intent collision with `/learn/how-to-build-a-stock-watchlist` while preserving the existing beginner "what-is" body copy. Both pages now cross-link. |
| `/learn/beyond-price-predictions` | Title/H1 trimmed from 126 registry chars (142 rendered) to **"Beyond Price Predictions: Indicators, Sentiment and ML"** (68 rendered). | Severe SERP truncation risk; description untouched. |
| `/analysis` | New route `layout.tsx`: unique title "Stock Analysis Tools — Sentiment, Forecast & Technicals | StockVantex", description, canonical, OpenGraph. | Was an orphan with a duplicate homepage title and no canonical. |
| `/test-chart` | New route `layout.tsx`: unique title "Internal Test Chart | StockVantex", `robots: noindex, nofollow`; robots.txt rule fixed from `/test-chart/` to `/test-chart`. | Dev artifact must not be indexed; trailing-slash rule did not match the real URL. |
| `/markets/more` | Canonical added to existing noindex layout. | Completes canonical hygiene on the noindex utility hub. |

No navigation, footer, or URL structures were modified.

## 3. Stock research template (52 URLs)

`src/app/stocks/[symbol]/page.tsx` now renders a server-side **"Volatility & expected range"** section from the existing `overview.volatility` payload:

- 14-Day ATR and ATR as a percentage of the latest daily close.
- Expected daily range as `latest daily close ± ATR`, with the formula stated in the UI (the displayed live quote is not used as the basis).
- Relative volume and its backend classification, shown only when `available === true` and the ratio is >0.
- Annualized volatility with the documented 15–35% / >50% scoring context.
- Contextual links to `/methodology` and `/learn/what-is-atr`.
- New FAQ entry: "How volatile is {ticker} stock right now?" inside the data-present branch.

All values are read from the API snapshot; no prices, ranges, or volumes are invented. No API contract was changed.

## 4. Encoding repair

`src/lib/learn-articles.ts` contained 113 CP1252 mojibake sequences that were being emitted into 19 prerendered Learn pages (one meta description included). A one-off repair script converted all 113 sequences, left 0 unconvertible, and removed all `â`/`Ã` artifacts. Post-build extraction confirms 0 affected URLs.

## 5. Internal linking

Contextual links were added from high-authority pages to the two near-orphan Learn articles, the ADX explainer, the S&P 500 ETF explainer, `/methodology`, and across the watchlist pair. Full source/target mapping is in `INTERNAL_LINKING_REPORT.md`.

## 6. Remaining work (not silently expanded in this pass)

Post-build extraction still shows 8 Learn pages under 500 rendered words and 7 Learn pages without FAQ schema. These are scheduled with explicit acceptance criteria in `EDITORIAL_ROADMAP.csv`; adding filler or thin pages would violate the quality guardrails. `/stocks/sq` remains noindex in this build and is scheduled for a post-deploy data-state recheck.

## 7. Guardrail confirmation

- No fabricated prices, reviews, authors, rankings, impressions, clicks, or AdSense outcomes.
- No fake "Vantex Resources Ltd." page created; the query remains documented as brand confusion only.
- No paid APIs, new dependencies, ONNX/scaler changes, or backend contract changes.
- No commit, push, or deployment was performed.
