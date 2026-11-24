# Test Results

**Date:** 2026-11-24
**Environment:** local Next.js 15.5.9 production build, Node 22.20.0, Windows PowerShell. Backend-dependent runtime checks used `scripts/mock-seo-api.mjs`; the final production build and inventory extraction used `.env.local`.

## Commands and outcomes

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 TypeScript errors (`tsconfig.tsbuildinfo` reverted after check). |
| `npm run lint` | PASS — 0 errors. Pre-existing warnings/notices remain: `next lint` deprecation, missing Next ESLint plugin, module-type notice, and one `react-hooks/exhaustive-deps` warning at `src/app/markets/discover/page.tsx:150` (file untouched). |
| `npm run build` (real env) | PASS — compiled and prerendered 123 pages, including 52 stock pages and 29 Learn pages; no errors in the final rerun. |
| Mock-env `npm run build` + `npm run routing:checks` | PASS — **72/72 routing gates**; build ran with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8787` and the mock API server active. |
| `npm run seo:checks` | PASS — all SEO quality gates. |
| `npm run sitemap:checks` | PASS — **62/62** sitemap/robots gates. |
| `npm run ga:checks` | PASS — **56/56** GA4/consent gates. |
| `npm run signal:checks` | PASS — **102/102** signal-behavior gates. |
| Post-build HTML extraction + content verification | PASS — **33/33** content assertions via a temporary script outside the repo (`C:\Users\PMLS\AppData\Local\Temp\opencode\verify-content.mjs`); the script is intentionally not committed |

**Routing note:** the supported runtime path rebuilds with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8787` while `scripts/mock-seo-api.mjs` is running, then executes the repository's routing gates; all 72 passed. An initial mock-env build without the mock server logged repeated `ECONNREFUSED 127.0.0.1:8787` during static generation (the build still completed via fallbacks) and was discarded. A real-backend runtime routing attempt was not rerun in this final pass because the previously observed 15s timeout at `scripts/routing-checks.mjs:150` for `/stocks/lyft` (line 214) remains the known limitation; routing is therefore reported as passed only on the documented mock-env path.

## Post-build content verification

| Check | Result |
|---|---|
| Public URLs extracted | 100 |
| Missing canonical on indexable pages | 0 |
| Indexable pages without exactly one H1 | 0 |
| Duplicate titles | 0 |
| Mojibake (`â`/`Ã`) in rendered metadata | 0 |
| `/analysis` canonical/title | `https://stockvantex.com/analysis`; unique "Stock Analysis Tools — Sentiment, Forecast & Technicals | StockVantex" |
| `/test-chart` | unique title; `noindex, nofollow`; robots.txt disallows `/test-chart` |
| Watchlist titles | primary unchanged; secondary now "What Is a Stock Watchlist? A 5-Step Setup Guide" |
| `beyond-price-predictions` rendered title length | 68 chars (was 142) |
| Priority article word counts | technical-vs 1,235; technical-analysis 1,121; ATR 1,211; ADX 1,122; RSI-vs-MACD 1,056 |
| Stock pages | 52; 313 / 965 / 1,011 min / avg / max rendered words |
| Volatility section | rendered in stock HTML; ATR article + methodology anchors present; volatility FAQ present |
| Cross-links | all targeted source→target anchors found in prerendered HTML |
| Noindex routes | `/markets/more`, `/markets/stock/watchlist`, `/stocks/sq`, `/test-chart` |

`/test-chart` and `/markets/stock/watchlist` intentionally have no H1 and are noindex; their H1 exemption is verified rather than treated as a defect. `/stocks/sq` remains noindex in this build and is recorded in `EDITORIAL_ROADMAP.csv` for a post-deploy data-state recheck.

## Remaining backlog found by verification

- 8 Learn pages remain under 500 rendered words.
- 7 Learn pages still lack `FAQPage` JSON-LD.
- `/analysis` still has 0 inbound links; adding a nav/footer link was outside the allowed change scope (roadmap R09).

These are deliberately deferred to `EDITORIAL_ROADMAP.csv`; no thin pages or filler copy were added to make metrics look better.

## Manual verification performed

- Inspected rendered HTML for exact metadata, canonical, robots meta, H1 counts, JSON-LD types, and specific internal anchors.
- Compared rendered post-build counts against the baseline inventory.
- Checked robots.txt source rule against the actual `/test-chart` URL.
- Reviewed `git status`/`git diff --stat`; no commit, push, or deploy was performed.
- No browser visual QA, live GSC recheck, or performance/ranking validation was performed in this environment; no such claim is made.

---

## Project 02 verification (2026-11-24)

### Commands and outcomes

| Command | Result |
|---|---|
| `python -m pytest tests -q` (`stock_market`) | PASS — **66 passed**; only pre-existing FastAPI `on_event` deprecation warning. |
| `python -m pytest tests/test_project02_integrity.py -q` | PASS — **8 passed** new integrity tests. |
| `npx tsc --noEmit` | PASS — 0 TypeScript errors (`tsconfig.tsbuildinfo` reverted after check). |
| `npm run lint` | PASS — 0 errors; pre-existing warnings/notices remain, including `src/app/markets/discover/page.tsx:150`. |
| `npm run build` (real env) | PASS — compiled and prerendered **124 pages** (new `/editorial-standards` route); no errors. |
| Mock-env `npm run build` + `npm run routing:checks` | PASS — **72/72** routing gates; mock API server active at `127.0.0.1:8787`. |
| `npm run seo:checks` | PASS — all gates, including 8 new financial-trust assertions (editorial route, footer/sitemap links, removed accuracy/confidence/trained-model claims, disclosed walk-forward and interval gaps). |
| `npm run sitemap:checks` | PASS — **63/63** gates (new `/editorial-standards` route included). |
| `npm run ga:checks` | PASS — **56/56** gates. |
| `npm run signal:checks` | PASS — **102/102** gates. |
| Post-build rendered-HTML spot check | PASS — `Editorial Standards &amp; Corrections` 1 hit, `In-sample fit proxy` 2 hits, `no calibrated confidence intervals` 2 hits, `Snapshot refreshed` 57 hits. Legacy phrases appear only in the editorial correction log, not in marketing copy. |

### New integrity tests

- Volatility cache is scoped to a data snapshot, not only a ticker label.
- Relative volume is rounded to two decimals without positional-argument misuse.
- Non-finite trend components fall back to neutral.
- Forecast pipeline rejects non-finite and non-positive outputs.
- Signal evidence ignores zero-price rows.
- Trade confirmation handles an empty indicator frame.
- Monte Carlo paths remain strictly positive.

### Limitations

- Real-env `npm run routing:checks` was not used because the known 15s timeout at `scripts/routing-checks.mjs:150` for `/stocks/lyft` remains; the documented mock-env path passed 72/72.
- No browser visual QA, live GSC recheck, ranking check, performance measurement, provider re-fetch or independent model validation was performed.
- No deploy was performed; live site HTML remains pre-correction until redeploy.

---

## Project 03 verification (2026-11-24)

### Commands and outcomes

| Command | Result |
|---|---|
| `python -m pytest tests -q` (`stock_market`) | PASS — **66 passed**; only pre-existing FastAPI `on_event` deprecation warning. |
| `npx tsc --noEmit --incremental false` | PASS — 0 TypeScript errors. |
| `npm run lint` | PASS — 0 errors; pre-existing warnings/notices remain, including `src/app/markets/discover/page.tsx:150`. |
| `npm run build` (real env) | PASS — compiled and generated **124 pages**. |
| Mock-env `npm run build` + `npm run routing:checks` | PASS — **72/72 routing gates** with `scripts/mock-seo-api.mjs` active before build. |
| `npm run seo:checks` | PASS — **59 assertions**. |
| `npm run sitemap:checks` | PASS — **64/64 gates**. |
| `npm run ga:checks` | PASS — **56/56 gates**; SSR pages contain zero Google tags pre-consent. |
| `npm run signal:checks` | PASS — **102/102 gates**. |
| `npm run seo:regression` | PASS — **39/39 gates**; wrote root `ROUTE_AND_INDEXABILITY_INVENTORY.csv` with 107 route rows. |

### Project 03 specific checks

| Check | Result |
|---|---|
| `/analysis` runtime | 200, self-canonical, one H1, WebPage JSON-LD, sitemap entry, 105 rendered inbound anchors. |
| `/test-chart` runtime | 308 to `/`; robots no longer disallows the path. |
| Duplicate canonicals across 107 rendered routes | 0. |
| Indexable rendered routes missing title/description/canonical or H1 | 0. |
| Invalid JSON-LD blocks | 0. |
| Internal links to missing rendered routes | 0. |
| Internal links to noindexed stock pages | 0. |
| Sitemap-listed indexable routes with zero inbound links | 0. |
| Static AdSense loader in SSR | Removed; loader is consent-gated with `afterInteractive`. |
| Stock routing | Uppercase 308 lowercase with query preserved; malformed/unknown 404; non-allowlisted 200/noindexed. |

### Corrections made to gates during verification

- `scripts/seo-checks.mjs` accepts component-based WebPage JSON-LD emission.
- `scripts/sitemap-checks.mjs` recognizes `/analysis` as a public core route and still forbids `/test-chart`.
- Regression canonical check accepts the homepage's origin-form canonical.
- Regression noindex-link check excludes self-referential anchors on noindexed stock fixture pages.

### Limitations

- No browser visual QA, Lighthouse run, Chrome trace, field Core Web Vitals, Search Console recheck, ranking/traffic check or live AdSense console verification was performed.
- Real-env runtime routing was not rerun because the previously observed timeout at `scripts/routing-checks.mjs:150` for `/stocks/lyft` remains; the supported mock-env path passed 72/72.
- No deploy was performed; live HTML remains pre-Project-03 until redeploy.

