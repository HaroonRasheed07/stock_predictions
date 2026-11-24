# Source and Fact-Check Report

**Date:** 2026-11-24
**Method:** Editorial claims were checked against the backend implementation and the public methodology page before being written into Learn articles or stock-page UI. Historical GSC figures are treated as observations, not outcomes or achievements.

## Source hierarchy

1. Backend Python code in `E:\fyp_web\stock_market` — authoritative for platform behavior.
2. `src/app/methodology/page.tsx` — authoritative for published scoring bands.
3. `src/lib/learn-articles.ts` and rendered prerendered HTML — authoritative for what the site currently says.
4. GSC observations supplied in the project brief — used only to prioritize topics.

## Claim verification

| Claim used in content | Source checked | Result / how it is phrased |
|---|---|---|
| ATR is a 14-period **simple** average of True Range on StockVantex | `stock_market/indicators.py` (ATR helper) and `stock_market/volatility.py` | Confirmed. `what-is-atr` now explicitly separates the platform's simple rolling mean from Wilder's recursive smoothing rather than conflating them. |
| Wilder smoothing uses α = 1/14 | Wilder's standard recursive form; used by backend RSI (`ewm(com=13)`) and described in the article | Confirmed mathematically. Article presents the recursion as an educational contrast, not as a platform ATR claim. |
| RSI uses Wilder-equivalent smoothing; MACD uses 12/26/9 EMAs; no MACD histogram is computed | Backend indicator implementation and frontend type/API usage | Confirmed. Existing explainer language was preserved; no histogram feature was invented. |
| StockVantex does **not** compute ADX/DMI | Repository-wide search of `stock_market` and `src/` | Confirmed. `what-is-adx` states this directly and explains the composite trend score instead. |
| Trend score is a 0–100 composite from price vs SMA20/SMA50, SMA crossover, and MACD direction; Bullish >60, Bearish <40 | `src/app/methodology/page.tsx:138` and backend signal layer | Confirmed. ADX and stock-page copy use the documented components and bands. |
| Expected daily range = latest dataframe close ± 1 × ATR; `range_percent = (atr / close) × 100` | `stock_market/volatility.py` (`calculate_expected_range`) | Confirmed. Stock-page UI labels the basis as "latest daily close" (not the live quote) and only renders values present in the API payload. |
| `daily_volatility` is annualized daily-return std × √252 × 100 | `stock_market/volatility.py` | Confirmed. Stock-page copy says "daily returns × √252" and shows the backend value. |
| 15–35% annualized volatility is moderate; >50% is extreme | `src/app/methodology/page.tsx:140` | Confirmed. Used verbatim as scoring context, not as investment advice. |
| ATR% markers: <1% low, >5% high | `src/app/methodology/page.tsx` / scoring documentation | Confirmed. Stock-page bullets use "below the 1% low-volatility marker" / "above the 5% high-volatility marker". |
| Relative volume is conditional and has backend classification | `VolatilitySummary.relative_volume` in `src/lib/api.ts`; backend volatility payload | Confirmed. UI renders it only when `available === true`, a numeric ratio exists, and the ratio is >0 (zero-volume rows are shown as N/A). |
| Watchlist entries are local-only (no accounts) | Existing `stock-watchlist-guide` limitations and app behavior | Preserved; no account or sync claim introduced. |
| "Vantex Resources Ltd." | Repository-wide search of site source/content (excluding audit documents) | Zero matches. Documented as likely brand confusion; no page created. |

## Corrections made during this pass

- Fixed 113 mojibake sequences in `src/lib/learn-articles.ts`; post-build extraction found 0 rendered URLs with broken `â`/`Ã` characters.
- Corrected the ADX article so it no longer implies ADX is a StockVantex feature.
- Corrected the ATR article so platform simple averaging and Wilder smoothing are clearly distinguished.
- Removed a 126-character title that would have been truncated in search results.
- Fixed the robots.txt disallow rule so `/test-chart` (no trailing slash) is actually matched.

## Unverified by design

- **Search performance:** no new ranking, click, impression, or AdSense result is claimed. GSC numbers in the audit are historical observations supplied with the brief.
- **Live market values:** prerendered stock values depend on build-time API data. No static price was hardcoded into prose; `/stocks/sq` noindex is scheduled for verification after the next production deploy.
- **Hypothetical examples:** the technical-vs-fundamental worked example uses "Example Corp" and is explicitly labeled hypothetical and for learning only.
