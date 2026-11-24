# SEO Regression Test Report — Project 03

**Date:** 2026-11-24  
**Command:** `npm run seo:regression` → **39 passed, 0 failed**.

## Purpose

`scripts/seo-regression.mjs` converts the Project 03 audit findings into repeatable static and runtime gates. It runs against the existing `.next` production build and generates the route inventory deliverable.

## Static gates

| Gate group | Coverage |
|---|---|
| Routing configuration | `/analysis` no longer redirected; `/test-chart` still permanently redirected. |
| Robots | `/test-chart` not disallowed; `/api/` still disallowed. |
| Sitemap and links | `/analysis` in sitemap and footer. |
| Canonicals | Watchlist self-canonical; no duplicate canonical owner across rendered routes. |
| AdSense | No static loader in root layout; loader mounted inside consent gate; privacy copy aligned. |
| Structured data | Shared WebPage component exists and is used by `/analysis`. |
| Internal links | Learn related tickers use allowlisted symbols only. |
| Rendered HTML | Titles, descriptions, canonicals and one H1 on all indexable routes; all JSON-LD parses. |
| Link graph | No missing rendered-route links, no links to noindexed stock pages, `/analysis` has inbound links, no sitemap-listed indexable orphan. |

## Runtime gates

- Production server on port 3216 with `scripts/mock-seo-api.mjs` on port 8787.
- `/analysis` → 200, self-canonical, one H1, WebPage JSON-LD.
- `/test-chart` → 308 to `/`.
- Runtime robots allows `/test-chart` redirect.
- Runtime sitemap includes `/analysis`.
- SSR homepage contains no static AdSense tag.
- `/stocks/msft` and `/learn/what-is-rsi` → 200, self-canonical, parseable JSON-LD.

## Inventory output

- Parses all `.next/server/app/**/*.html` files.
- Writes `E:\fyp_web\ROUTE_AND_INDEXABILITY_INVENTORY.csv`.
- Final run wrote 107 route rows with observed status, indexability, sitemap membership, canonical, H1 count, metadata, robots, JSON-LD types and inbound/outbound link counts.

## Full verification set

| Command | Result |
|---|---|
| `python -m pytest tests -q` | 66 passed |
| `npx tsc --noEmit --incremental false` | PASS |
| `npm run lint` | PASS with known warnings |
| Real-env `npm run build` | PASS, 124 pages |
| Mock-env build + `npm run routing:checks` | 72/72 |
| `npm run seo:checks` | PASS, 59 assertions |
| `npm run sitemap:checks` | 64/64 |
| `npm run ga:checks` | 56/56 |
| `npm run signal:checks` | 102/102 |
| `npm run seo:regression` | 39/39 |

## Adjustments made during verification

- `scripts/seo-checks.mjs` now accepts component-based WebPage JSON-LD emission.
- `scripts/sitemap-checks.mjs` now recognizes `/analysis` as a public core sitemap route while still forbidding `/test-chart`.
- Regression canonical check allows the homepage's canonical origin form without a trailing slash.
- Regression noindex-link check excludes self-referential anchors on noindexed stock fixture pages.

## Limitations

The script verifies local source, local rendered HTML and local runtime behavior. It does not connect to Search Console, verify live deployment, measure rankings/traffic, run Lighthouse or confirm AdSense approval.
