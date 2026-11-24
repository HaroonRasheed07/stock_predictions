# Performance Audit — Project 03

**Date:** 2026-11-24  
**Evidence:** Next.js 15.5.9 production build output, static/runtime SEO gates, source review. No Lighthouse, Chrome trace or field-CWV run was available.

## Build results

| Metric | Observed |
|---|---:|
| Generated pages | 124 |
| Prerendered HTML files inspected | 107 |
| Homepage route size / first-load JS | 23.9 kB / 138 kB |
| `/analysis` route size / first-load JS | 2.65 kB / 115 kB |
| `/stocks` route size / first-load JS | 5.39 kB / 118 kB |
| `/stocks/[symbol]` route size / first-load JS | 9.15 kB / 251 kB |
| `/markets/stock` route size / first-load JS | 13.5 kB / 265 kB |
| Shared first-load JS | 102 kB |
| Middleware | 34.4 kB |

## Revalidation and rendering

- Homepage: static with 10-minute revalidation.
- Stock research pages: SSG with 1-hour revalidation.
- Sitemap: 1-hour revalidation.
- Heavy market workspaces are client-heavy; their first-load JS is higher than content pages.
- One edge-runtime route disables static generation for that route; this is the existing region endpoint behavior, not a Project 03 regression.

## Third-party loading

| Script | Before | After |
|---|---|---|
| GA4 | Consent-gated via `@next/third-parties/google` | Unchanged. |
| AdSense verification | Static async script in root layout, present in SSR HTML | Moved into `AnalyticsConsent.tsx`, `strategy="afterInteractive"`, mounted only when analytics is effectively active. |
| SSR pre-consent Google tags | GA absent; AdSense loader present | Both absent in SSR HTML for `/`, `/stocks/msft` and `/learn/what-is-rsi`. |

## Efficiency decisions

- No new dependency, image, font, analytics SDK or polling loop was added.
- `WebPageJsonLd` replaces duplicated inline JSON-LD objects rather than adding payload.
- Sitemap generation remains pure: no network/backend calls, deterministic output.
- Region consent resolution fails closed to strict tier when country is unknown.
- No ad units are rendered, so no ad layout-shift or ad auction cost was introduced.

## Warnings

- Browserslist data is 17 months old; informational only.
- `next lint` is deprecated and the Next ESLint plugin is not detected; pre-existing configuration warning.
- `react-hooks/exhaustive-deps` warning at `src/app/markets/discover/page.tsx:150` remains pre-existing and was not touched.

## Limitations

No Lighthouse score, TTFB/INP/LCP/CLS measurement, browser trace, throttled run, CDN test or real-user Core Web Vitals data was collected. This audit reports build composition and third-party injection timing only; no performance score or CWV pass/fail claim is made.

## Conclusion

The Project 03 changes do not increase bundle weight materially and remove a static third-party ad script from SSR HTML. Live performance validation remains a deployment follow-up.
