# Technical SEO Audit — Project 03

**Date:** 2026-11-24  
**Scope:** local repository audit of `E:\fyp_web\Market-Analysis-project-` and `E:\fyp_web\stock_market`; no deploy, no Search Console or live ranking/traffic verification.

## Evidence base

- Real-env `npm run build`: PASS, 124 generated pages.
- Mock-env `npm run build` + `npm run routing:checks`: PASS, 72/72 gates.
- `npm run seo:checks`: PASS, 59 assertions.
- `npm run sitemap:checks`: PASS, 64/64 gates.
- `npm run ga:checks`: PASS, 56/56 gates.
- `npm run signal:checks`: PASS, 102/102 gates.
- `npm run seo:regression`: PASS, 39/39 gates; generated `ROUTE_AND_INDEXABILITY_INVENTORY.csv` from 107 prerendered HTML files.
- `npx tsc --noEmit --incremental false`: PASS.
- `python -m pytest tests -q` (`stock_market`): PASS, 66 tests.

## Findings and decisions

| Area | Baseline finding | Decision | Verified outcome |
|---|---|---|---|
| Crawlability | `/analysis` was permanently redirected to `/markets/stock` despite having its own metadata and real hub content. | Removed redirect; made `/analysis` a canonical public route. | Runtime 200, self-canonical, unique title, one H1, WebPage JSON-LD, sitemap entry, sitewide internal link. |
| Redirect hygiene | `/test-chart` was redirected to `/` but also blocked in `robots.txt`, so crawlers could not observe the 308. | Kept 308 redirect, removed robots `Disallow: /test-chart`, retained noindex fallback in layout. | Runtime 308 to `/`; runtime robots allows the path. |
| Sitemap | `/analysis` absent; static generation otherwise pure and deterministic. | Added `/analysis` to core entries; left noindex, diagnostic and legacy workspace views out. | 64/64 sitemap gates, including backend-offline and byte-identical response checks. |
| Canonicals | `/markets/stock/watchlist` inherited `/markets/stock` canonical while noindexed. | Added self-canonical to the noindex/follow child layout. | No duplicate canonicals across 107 rendered routes. |
| Internal links | `/analysis` had zero inbound links; two Learn articles linked to non-allowlisted `/stocks/spy` and `/stocks/qqq`. | Added footer link to `/analysis`; replaced related tickers with allowlisted symbols. | `/analysis` has 105 rendered inbound anchors; no links to missing or noindexed stock pages. |
| Structured data | All JSON-LD parsed, but `/analysis` lacked page-level WebPage schema. | Added shared `WebPageJsonLd` component; used it on analysis, stock and privacy routes. | All emitted JSON-LD parses; final types include Organization, WebSite, WebPage, BreadcrumbList, FAQPage, Article, CollectionPage. |
| AdSense readiness | Static AdSense loader in root layout; privacy said “we have no advertising”; GA consent gate did not cover ads verification. | Moved loader into the existing consent gate with `afterInteractive`; aligned consent and privacy copy. | SSR has no Google ad script; loader requires effective analytics consent; no ad units enabled. |
| Metadata | No duplicate or missing title/description on indexable pages; no duplicate canonicals after watchlist fix. | Added regression gates for title/description/canonical/H1 and canonical uniqueness. | All 39 regression gates pass. |

## Indexability decisions

- **Indexable:** homepage, `/stocks`, `/about`, `/contact`, `/methodology`, `/analysis`, `/editorial-standards`, `/learn`, legal pages, 52 allowlisted stock pages and Learn articles.
- **Indexable but intentionally outside sitemap:** legacy `/markets/*` workspaces. They remain canonical and internally linked, but sitemap scope is unchanged to avoid duplicating intent with `/analysis`, `/stocks` and Learn.
- **Noindex:** `/markets/more`, `/markets/stock/watchlist`, non-allowlisted but researchable stock pages, `/test-chart` fallback and invalid/unknown 404 routes.
- **Redirect:** `/test-chart` → `/`; uppercase stock URLs → lowercase 308 preserving query strings.

## Limitations

- No live crawl, Search Console coverage/URL inspection, ranking, click, impression or traffic data was available.
- No Lighthouse/Chrome/Playwright run was performed; performance findings are build-output and injection-timing based only.
- AdSense approval, ad serving and policy compliance cannot be verified locally; no live ad unit was enabled.
- Mock backend fixtures (`/stocks/gm`, `/stocks/lyft`, `/stocks/mrna`) appear noindexed in the generated inventory; production state depends on live backend data.

## Conclusion

Project 03 changes are source-complete and locally verified. No claim is made about search rankings, organic traffic, Core Web Vitals field data or AdSense approval. A redeploy is required before production HTML reflects these changes.
