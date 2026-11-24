# AdSense Readiness Report — Project 03

**Date:** 2026-11-24  
**Status:** engineered readiness only; no approval, ad serving or revenue claim.

## Baseline gaps

| Gap | Evidence |
|---|---|
| Static AdSense loader in root layout | `pagead2.googlesyndication.com` was present in server-rendered HTML before consent. |
| Privacy contradiction | `/privacy` said “we have no advertising” while a verification loader existed. |
| Consent scope mismatch | GA4 was consent-gated, but the AdSense loader was outside that gate. |
| No documented client ID configuration | Hard-coded publisher ID only. |

## Implemented changes

- Added `src/lib/adsense.ts` with `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and a fallback to the existing publisher verification ID.
- Removed the static AdSense script from `src/app/layout.tsx`.
- Mounted the loader from `src/components/common/AnalyticsConsent.tsx` using Next `Script` with `strategy="afterInteractive"`.
- Loader is rendered only when analytics is effectively active:
  - strict region: only after explicit grant;
  - standard region: by default until declined;
  - decline, stored opt-out or Global Privacy Control: no loader.
- Updated banner and settings dialog copy to disclose Google Analytics plus AdSense publisher verification.
- Updated `/privacy` to explain verification-only use, no ad units, no sale of personal information, Google cookie processing and decline/GPC behavior.
- Shared `WebPageJsonLd` now provides privacy page structured data consistently.

## Verification

| Check | Result |
|---|---|
| `npm run ga:checks` | PASS, 56/56; SSR pages contain zero Google tags pre-consent. |
| `npm run seo:regression` | PASS, 39/39; root layout has no static ad script; consent gate mounts it. |
| `npm run seo:checks` | PASS, 59 assertions, including privacy/contact/trust copy. |
| `npm run sitemap:checks` | PASS, 64/64. |
| Live ad request simulation | Not performed. |

## What remains manual

- Confirm the AdSense account, site ownership and publisher ID in the AdSense console.
- Complete AdSense policy, content, navigation, privacy-page and user-experience review with the account owner.
- Decide whether ad units will ever be enabled; none are placed now.
- If ad units are added later, re-run consent, layout-shift, brand-safety, privacy and performance audits.
- Confirm whether additional consent frameworks such as TCF are required for the intended markets.
- Validate live HTML, scripts and policy status after deployment.

## Honest conclusion

StockVantex is now **conditionally ready for AdSense verification from an engineering and disclosure perspective**, because the verification script is consent-gated and the privacy copy no longer contradicts it. It is **not** AdSense-approved, not serving ads, not generating ad revenue, and not verified for rich ad policy compliance. No approval or earnings claim is made.
