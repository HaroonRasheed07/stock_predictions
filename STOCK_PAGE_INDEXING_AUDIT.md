# Stock Page Indexing Audit — Project 03

**Date:** 2026-11-24  
**Evidence:** `npm run routing:checks` 72/72; `npm run sitemap:checks` 64/64; `npm run seo:regression` 39/39; `ROUTE_AND_INDEXABILITY_INVENTORY.csv`.

## Inventory of stock URL states

| URL pattern | HTTP state | Index directive | Canonical | Sitemap |
|---|---|---|---|---|
| `/stocks/{allowlisted}` | 200 | `index, follow` | Lowercase self URL | Yes, 52 URLs |
| `/stocks/{UPPERCASE}` | 308 | Redirect | Lowercase target | No |
| `/stocks/{valid-pattern, non-allowlisted, backend has data}` | 200 | `noindex, follow` | Lowercase self URL | No |
| `/stocks/{valid-pattern, unknown in backend}` | 404 | noindex fallback | None | No |
| `/stocks/bad!sym` or malformed | 404 | noindex fallback | None | No |
| `/stocks/spy`, `/stocks/qqq` links | Removed from Learn related tickers | — | — | — |

## Correctness checks

- Exactly 52 allowlisted symbols remain in `src/lib/stock-allowlist.ts`.
- Sitemap contains exactly 52 stock URLs, all lowercase and allowlisted.
- Uppercase URLs 308 to lowercase and preserve query strings such as `?view=forecast`.
- No redirect sends `/stocks` or all stock pages elsewhere.
- Research tab state stays in query strings; canonical excludes `?view=`.
- Server-rendered snapshot, breadcrumb, FAQ/AEO block and internal Learn links remain present.
- WebPage JSON-LD is now emitted through the shared `WebPageJsonLd` component with `dateModified` only from a real snapshot timestamp.
- Non-allowlisted researchable pages are noindexed rather than silently hidden or mass-redirected.
- Invalid/unknown pages return genuine 404s rather than soft-200 indexable pages.

## Mock backend fixtures

`scripts/mock-seo-api.mjs` exposes `LYFT`, `F`, `GM` and `MRNA` as extra known symbols for routing tests. Their generated pages appear in the inventory as `noindex, follow`. This is expected test behavior; production state depends on live backend data.

## Risks and limitations

- Live provider data availability can change whether a valid-pattern symbol is 404 or noindexed; this is data-dependent by design.
- No live crawl, Search Console URL inspection or index coverage report was available.
- No ranking or traffic benefit is claimed.

## Conclusion

Stock-page routing, canonicalization, noindex logic and sitemap membership passed all local gates. No mass redirect or fabricated stock URL was introduced.
