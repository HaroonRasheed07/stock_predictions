# StockVantex Content Audit

**Site:** https://stockvantex.com (Next.js 15 App Router, static export of prerendered pages)
**Audit date:** 2026-11-24
**Method:** Every page's prerendered HTML (`.next/server/app/**/*.html`, 100 public URLs) was machine-extracted for title, meta description, canonical, robots, H1, rendered word count, internal in/out links, and JSON-LD types, then merged with editorial judgment columns (intent, topic, unique value, gaps, action, priority). The full machine-readable result is `CONTENT_INVENTORY.csv` (100 rows, 0 unclassified).

> Word counts are rendered words inside `<article>` where present, otherwise `<body>` — they include page chrome (TOC, related boxes, footer), so they are an upper bound on body prose. Relative comparison between pages is valid; absolute article length is slightly lower.

> This is the **baseline** audit that drove the implementation. Post-implementation measurements are in `TEST_RESULTS.md`; present-tense defect descriptions below refer to the audited snapshot, not the final state.

## 1. Scale and structure

| Segment | Pages | Notes |
|---|---|---|
| Learn articles | 29 | Informational, `Article` + `BreadcrumbList` JSON-LD on all 29 |
| Stock research pages | 52 | Allowlisted symbols, `FAQPage` JSON-LD on 51 of 52 (`/stocks/sq` lacked it at baseline), hourly revalidate |
| Utility / static | 19 | Homepage, methodology, about, legal, 5 tool hubs, `/analysis`, `/test-chart` |
| **Total** | **100** | Sitemap declares 9 core/legal + 52 stocks + 29 learn (90 URLs) |

Information architecture is sound: three clear content types, one Learn hub, one stock directory, tools under `/markets/*`. No URL-pattern conflicts or duplicate paths were found.

## 2. Metadata health

| Check | Result |
|---|---|
| Title present on all pages | PASS (100/100) |
| Meta description present | PASS (100/100, avg 141 chars; 17 over 160 chars → SERP truncation risk) |
| Canonical present | **FAIL ×3: `/analysis`, `/markets/more`, `/test-chart`** |
| Duplicate titles | **`/analysis` and `/test-chart` both render the homepage title** |
| Single H1 | **FAIL ×2: `/markets/stock/watchlist`, `/test-chart` (0 H1s)** |
| robots.txt coverage | `/test-chart` disallowed but the rule is `/test-chart/` (trailing slash) — prefix match misses the actual `/test-chart` path |
| noindex | `/markets/more`, `/markets/stock/watchlist` (intentional), `/stocks/sq` (likely transient no-data at build time — recheck after next deploy) |
| JSON-LD | `Article` 29/29 learn, `FAQPage` 72, `BreadcrumbList` 81 |
| Learn articles missing FAQ schema | 8 of 29 (no `faq` array in registry): `technical-vs-fundamental-analysis`, `how-to-analyze-a-stock`, `how-to-analyze-stock-risk`, `how-to-research-a-stock-before-buying`, `beyond-price-predictions`, `how-ai-stock-forecasting-works`, `how-news-sentiment-works`, `what-is-stock-volatility` |

**Priority findings:** `/test-chart` is an internal test page that is crawlable, orphaned, canonical-less, and duplicates the homepage title. `/analysis` (tool hub) is orphaned and canonical-less. Both are Phase E fixes.

## 3. Thin content

### 3a. Learn articles under 500 rendered words (10 of 29)

| Words | Slug | Assessment |
|---|---|---|
| 348 | how-news-sentiment-works | Thin for a "how it works" explainer |
| 355 | how-to-analyze-stock-risk | Thin vs query demand |
| **387** | **technical-vs-fundamental-analysis** | **Critical: #1 GSC-impression query (84) answered by the thinnest priority page** |
| 398 | sma-vs-ema | Thin but concept is narrow |
| 416 | what-is-stock-sentiment | Acceptable-definitional |
| 426 | how-ai-stock-forecasting-works | Thin |
| 429 | how-to-analyze-a-stock | Thin; also overlap risk (§4) |
| **432** | **rsi-vs-macd** | **Priority: needs worked conflicting-signal scenarios** |
| 441 | what-is-stock-volatility | Acceptable-definitional |
| 449 | what-are-bollinger-bands | Acceptable-definitional |

Phase C implements the 5 priority articles (`technical-vs-fundamental-analysis`, `what-is-technical-analysis`, `what-is-atr`, `what-is-adx`, `rsi-vs-macd`). The remaining thin articles are scheduled in `EDITORIAL_ROADMAP.csv` (Phase G) rather than edited in this pass, to keep changes reviewable.

### 3b. SSR-thin tool pages (expected, not defects)

`/markets/brief` (143), `/markets/discover` (109), `/markets/stock` (103), `/markets/stock/{technical,sentiment,forecast}` (104/102/105), `/markets/stock/watchlist` (95) are client-rendered tools. Low SSR text is inherent to their architecture. Exception: `/markets/brief` is the core product page and could carry a stronger unique-value intro for crawlers (P2, roadmap).

### 3c. Stock pages — NOT thin

52 pages average 840 rendered words (min 313 `/stocks/sq` — the same transient no-data symbol, max 888), all with data-grounded FAQ JSON-LD. No thin-content problem in this segment.

## 4. Overlap and cannibalization

| Pair/cluster | Severity | Decision |
|---|---|---|
| `how-to-build-a-stock-watchlist` (778w) vs `stock-watchlist-guide` (735w) | **High** — both titles literally read "How to Build a Stock Watchlist", same primary intent | Primary = `how-to-build-a-stock-watchlist`. `stock-watchlist-guide` is **differentiated** in Phase E to a "what is a watchlist / 5-step setup" beginner intent + cross-links both ways. Full consolidation (301) documented as a future option in `KEYWORD_URL_MAPPING.csv`. |
| `how-to-analyze-a-stock` (6-step framework) vs `how-to-research-a-stock-before-buying` (9-step due diligence) | Medium | Defensible intent split (analysis method vs pre-purchase process); differentiated via titles already distinct + cross-linking (Phase F). Monitor. |
| `technical-indicators-rsi-macd-moving-averages` (hub) vs `what-is-rsi` / `what-is-macd` / `sma-vs-ema` | Low | Defensible hub-and-spoke: overview intent vs individual-concept intent. Retain all. |
| `what-is-stock-sentiment` vs `how-news-sentiment-works` vs `how-to-check-stock-market-sentiment-free` | Low | Three distinct intents (what / how it works / how to check). Retain all. |

No other title or description duplicates exist (all 29 learn descriptions unique; 52 stock titles follow one deliberate template).

## 5. Internal linking (orphan analysis)

- **0 inbound links:** `/analysis`, `/test-chart` (both non-sitemap utility pages — Phase E/F), `/markets/more` (noindex hub, acceptable).
- **Near-orphan Learn articles (1 inbound):** `how-to-research-a-stock-before-buying`, `sp-500-etf-explained-voo-spy-ivv`.
- **Low inbound (2):** `how-to-build-a-stock-watchlist`, `what-is-adx`.
- **Hub-and-spoke is healthy:** every page links out to ~15 unique internal URLs (header/footer); the differentiator is *contextual in-body* links, which are sparse on many learn articles.
- **Hub underused:** `/methodology` (the trust cornerstone) receives few contextual links from learn articles that cite the same formulas.

Phase F adds contextual links: priority articles ↔ tools ↔ methodology, and rescues the two near-orphans.

## 6. GSC evidence (historical observations, not achievements)

| Query | Impressions (historical) | Landing page | Status |
|---|---|---|---|
| technical vs fundamental analysis | 84 | `/learn/technical-vs-fundamental-analysis` | Thin page → Phase C |
| what is technical analysis | 66 | `/learn/what-is-technical-analysis` | Improve → Phase C |
| Vantex Resources Ltd. forecast and analysis | 41 | none | **Brand confusion** — no page; do not create thin page; documented in mapping |
| technical analysis (head term) | 29 | mixed (learn article + tool page) | Intent split documented: informational → learn, transactional → `/markets/stock/technical` |
| ATR / average true range | 27 + 27 | `/learn/what-is-atr` | Improve → Phase C |
| ADX / average directional index | 21 | `/learn/what-is-adx` | Improve → Phase C |

## 7. Unique-value assessment (E-E-A-T lens)

**Strengths**
- Honest limitations language is systemic (forecast disclaimers, `Important Limitations` box on all learn pages, data-source timestamps, "not investment advice" everywhere).
- `/methodology` publishes real formulas (ATR% bands <1%→>5%, trend score 0–100 with bands, risk bands 35/65) — rare for this site class.
- Stock pages are genuinely data-grounded with fallbacks; no fabricated values observed.
- Author bylines present on learn articles (single real author, consistent).

**Gaps**
- Priority learn articles underdeliver vs their query demand (§3a) — the site's #1 query gets 387 words.
- The 5 priority articles rarely cite `/methodology` despite describing the same formulas.
- No FAQ block on 8 learn articles including the top-impression page.
- Title length hygiene: 12 learn titles + all 52 stock titles exceed 65 chars (brand suffix forces truncation; worst offender `beyond-price-predictions` at 142 chars).

## 8. Issue summary by priority

| Priority | Count | Items |
|---|---|---|
| P1 | 7 | 5 priority learn articles (Phase C) + `/analysis` (canonical/title/inbound) + `/test-chart` (noindex/title/canonical) |
| P2 | 62 | 52 stock pages (Phase D volatility section applies to all), watchlist overlap pair, near-orphans, `/learn`, `/methodology`, `/`, `/stocks`, `/markets/brief` |
| P3 | 26 | Remaining learn articles + tool pages — improvements captured in roadmap |
| P4 | 5 | Legal + noindex utilities — no action |

**Action counts across inventory:** Improve 15, Differentiate 1, Retain 84.
