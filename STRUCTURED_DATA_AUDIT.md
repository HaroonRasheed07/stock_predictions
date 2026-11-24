# Structured Data Audit — Project 03

**Date:** 2026-11-24  
**Evidence:** static scan, 107 prerendered HTML files parsed by `scripts/seo-regression.mjs`; runtime samples verified on `/analysis`, `/stocks/msft` and `/learn/what-is-rsi`.

## Results

| Check | Result |
|---|---|
| JSON-LD blocks parsed | All parsed; 0 invalid |
| Duplicate top-level `@type` per block | 0 |
| `@context` | `https://schema.org` |
| Global Organization/WebSite emitters | Root layout, one each per rendered route |
| Page-level types observed | Article, BreadcrumbList, CollectionPage, FAQPage, Organization, WebPage, WebSite |
| Fake reviews, ratings, prices, accuracy or confidence claims | None introduced |

## Schema inventory by route family

| Route family | Structured data |
|---|---|
| Global | Organization + WebSite from `src/components/seo/StructuredData.tsx`. |
| `/analysis` | Organization + WebSite + new WebPage block with name, URL, description, publisher and `isPartOf`. |
| `/` | Organization + WebSite + CollectionPage where applicable. |
| `/learn` hub | Organization + WebSite + CollectionPage. |
| Learn articles | Article + BreadcrumbList + FAQPage where content supports FAQ + global blocks. |
| `/stocks/{symbol}` | WebPage + BreadcrumbList + FAQPage when data exists + global blocks; optional `dateModified` from actual snapshot timestamp. |
| `/privacy` | WebPage + global blocks; now uses shared emitter. |
| Noindex/redirect utilities | Global blocks only; no unsupported page schema added. |

## Changes made

- Added reusable `WebPageJsonLd` to `src/components/seo/StructuredData.tsx`.
- Rendered it on `/analysis` via `src/app/analysis/layout.tsx`.
- Replaced the stock page inline WebPage block with the shared component, preserving URL, name, description, publisher, `isPartOf` and data-backed `dateModified`.
- Replaced the privacy inline WebPage block with the shared component.
- Updated `scripts/seo-checks.mjs` to accept component-based WebPage emission.

## Governance

Structured data remains evidence-based: no fabricated author credentials, review board, ratings, review counts, price targets, success rates or calibrated forecast intervals. FAQ blocks are used only where the rendered page contains the corresponding question and answer.

## Limitations

Structured data validity is verified syntactically and locally. Rich-result eligibility, Google interpretation and Search Console enhancement reports require deployment and live validation and are not claimed here.
