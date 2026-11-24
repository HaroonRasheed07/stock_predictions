# Canonical and Redirect Audit — Project 03

**Date:** 2026-11-24  
**Evidence:** `npm run routing:checks` 72/72; `npm run seo:regression` 39/39; `ROUTE_AND_INDEXABILITY_INVENTORY.csv`; `scripts/mock-seo-api.mjs` runtime.

## Redirect inventory

| Source | Target | Type | Status / decision |
|---|---|---|---|
| `http://www.stockvantex.com/*` | apex host | 308 | Existing canonical host redirect retained. |
| `/test-chart` | `/` | 308 | Retained; robots disallow removed so crawlers can observe redirect. Noindex fallback remains if redirect is ever removed. |
| `/stocks/:UPPERCASE` | lowercase equivalent | 308 | Retained; query strings preserved via `nextUrl.clone()`. |
| `/analysis` | — | none | Redirect removed; `/analysis` is now a real indexable hub. |
| `/stocks` directory | — | none | No legacy redirect; directory remains public and linked. |
| `/markets/stock` and tool views | — | none | Legacy workspaces remain reachable at 200; no mass stock-page redirect introduced. |

## Canonical policy

| Route group | Canonical behavior |
|---|---|
| Homepage | `https://stockvantex.com` (origin without trailing slash). |
| Core, Learn, legal, `/analysis` | Absolute self URL. |
| Stock pages | Lowercase `/stocks/{symbol}` URL, independent of `?view=` query strings. |
| Non-allowlisted researchable stock pages | Lowercase self URL with `noindex, follow`. |
| `/markets/stock/watchlist` | Self canonical added; still `noindex, follow`. |
| `/test-chart`, invalid/unknown 404s | No canonical emitted; redirect/noindex state is authoritative. |

## Findings fixed

1. `/analysis` redirect contradicted its own metadata and hub content.
2. `/test-chart` was blocked in robots while redirecting, hiding the canonical signal.
3. Watchlist inherited `/markets/stock` canonical, producing a duplicate canonical owner across two rendered URLs.
4. Legacy brand and stock-view routing assertions needed to remain intact after these changes.

## Verification

- All 107 prerendered routes were parsed for canonical tags.
- Zero duplicate canonical owners after watchlist fix.
- All public indexable routes have self-referencing canonicals.
- Runtime checks confirmed uppercase stock redirects preserve `?view=`, unknown malformed symbols 404, and non-allowlisted research pages stay 200/noindexed.
- Footer and sitemap now point to `/analysis` instead of a redirect.

## Limitations

No live redirect-chain crawl or Search Console redirect report was available. The audit reflects repository configuration and local production runtime only.
