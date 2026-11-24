# Sitemap Validation Report — Project 03

**Date:** 2026-11-24  
**Evidence:** `npm run sitemap:checks` → **64/64 gates passed**; `npm run seo:regression` → **39/39 gates passed**; `ROUTE_AND_INDEXABILITY_INVENTORY.csv` generated from 107 prerendered HTML files.

## Sitemap source policy

- Single handler: `src/app/sitemap.ts`.
- No `public/sitemap.xml` shadow and no duplicate handler.
- Canonical origin only: `SITE_URL` / `https://stockvantex.com`.
- No `priority`, `changeFrequency`, network calls or backend/API imports.
- Deterministic dedupe by URL followed by codepoint sort.
- Empty output when `SEO_INDEXING_ENABLED` is false.
- `<lastmod>` only for Learn articles using real `article.updatedAt`; static and stock pages omit invented dates.

## Included URL groups

| Group | Count | Notes |
|---|---:|---|
| Core pages | 11 | Homepage, `/stocks`, `/about`, `/contact`, `/methodology`, `/analysis`, `/editorial-standards`, `/learn`, `/privacy`, `/terms`, `/disclaimer`. |
| Stock research | 52 | Exact allowlist; lowercase canonical URLs only. |
| Learn articles | 29 | Every registry article; real ISO `updatedAt`. |
| **Total** | **92** | Deduplicated and sorted. |

## Excluded URL groups

- `/test-chart` — permanent redirect and noindex fallback.
- `/markets/more`, `/markets/stock/watchlist` — noindex utilities.
- `/api/*` — private runtime endpoints.
- Non-allowlisted, invalid, malformed and unknown stock URLs.
- Query-string view states such as `?view=forecast`; one canonical URL per research view.
- Legacy `/markets/*` workspaces — unchanged sitemap scope; internally linked and canonical but intentionally not listed.

## Runtime checks passed

| Check | Result |
|---|---|
| Sitemap HTTP 200 and XML content type | PASS |
| Well-formed `urlset`, sitemap 0.9 namespace, UTF-8 declaration | PASS |
| Canonical HTTPS origin and no duplicate URLs | PASS |
| No tracking parameters, hashes or query strings | PASS |
| `/stocks/aapl`, `/stocks/msft`, `/stocks/nvda` present | PASS |
| All Learn slugs present | PASS |
| Exactly 52 stock URLs matching registry | PASS |
| `lastmod` valid ISO and not future-dated | PASS |
| Stock URLs carry no artificial `lastmod` | PASS |
| Consecutive responses byte-identical | PASS |
| Zero backend API calls during sitemap fetch | PASS |
| Sitemap still 200 with backend offline | PASS |
| Robots references canonical sitemap and allows public paths | PASS |
| `/analysis` present and maps to a real public route | PASS |
| No noindex/blocked/diagnostic route listed | PASS |

## Change made in Project 03

`src/app/sitemap.ts` now includes `${SITE_URL}/analysis`. `scripts/sitemap-checks.mjs` was updated to treat `/analysis` as a known public core route and to keep `/test-chart` forbidden.

## Limitations

These are local static/runtime checks. Search Console indexing status, submitted-sitemap acceptance and live crawl stats were not available. No ranking or traffic claim is made.
