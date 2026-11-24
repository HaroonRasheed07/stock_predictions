# Internal Link Graph Report — Project 03

**Date:** 2026-11-24  
**Evidence:** `ROUTE_AND_INDEXABILITY_INVENTORY.csv`, generated from 107 prerendered HTML files; `npm run seo:regression` 39/39. Prior Project 01 link work remains documented in `INTERNAL_LINKING_REPORT.md`.

## Baseline issues resolved

| Issue | Baseline | Fix |
|---|---|---|
| `/analysis` was a strict orphan | 0 inbound anchors; permanently redirected away | Redirect removed, self-canonical and WebPage schema added, sitewide footer link added. |
| Non-allowlisted stock links | `/learn/how-to-check-stock-market-sentiment-free` and `/learn/what-is-a-stock-market-correction` linked to `/stocks/spy` and `/stocks/qqq` | `relatedTickers` replaced with allowlisted symbols (`AAPL`, `MSFT`, `NVDA`, `AAPL`, `NVDA`). |
| Watchlist canonical duplication | `/markets/stock/watchlist` inherited `/markets/stock` canonical | Self-canonical added while retaining `noindex, follow`. |

## Post-fix graph results

| Check | Result |
|---|---:|
| Rendered routes parsed | 107 |
| Sitemap-listed indexable routes with zero inbound links | 0 |
| Internal links to missing rendered routes | 0 |
| Internal links to noindexed stock pages | 0 |
| Inbound anchors to `/analysis` | 105 |
| Duplicate canonical owners | 0 |

## Link structure

- Sitewide footer/navigation makes core routes, including `/analysis`, one click from rendered public pages.
- `/stocks` links individual research pages; stock pages link Learn content and methodology.
- Learn hub and related boxes keep article depth shallow.
- Legacy `/markets/*` workspaces remain internally linked but stay outside sitemap scope to avoid duplicate intent with `/analysis`, `/stocks` and Learn.

## Intentional noindex targets

- `/markets/stock/watchlist` is linked sitewide because it is a real product utility, but it remains `noindex, follow` with a self-canonical. This is not a canonical conflict.
- `/markets/more` remains noindex with zero inbound links.
- `/test-chart` remains a 308 redirect with zero inbound links.
- Invalid/unknown stock URLs are not linked internally and return 404.

## Interpretation

Core public pages are now reachable from sitewide navigation, Learn articles link only to supported stock research URLs, and no sitemap-listed indexable page is orphaned. No ranking, crawl-priority or traffic benefit is claimed.
