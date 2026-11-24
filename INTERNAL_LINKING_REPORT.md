# Internal Linking Report

**Date:** 2026-11-24
**Scope:** Contextual links added to the Learn registry and stock research template. Navigation and footer were intentionally left unchanged.

## Baseline findings

| Issue | URLs | Baseline |
|---|---|---|
| 0 inbound links | `/analysis`, `/test-chart`, `/markets/more` | `/test-chart` and `/markets/more` are non-sitemap utilities; `/analysis` was a canonical-less orphan. |
| Near-orphan Learn articles (1 inbound) | `/learn/how-to-research-a-stock-before-buying`, `/learn/sp-500-etf-explained-voo-spy-ivv` | Both answered valid queries but were rarely reached contextually. |
| Low inbound (2) | `/learn/how-to-build-a-stock-watchlist`, `/learn/what-is-adx` | Watchlist pair also had an intent-collision problem; ADX lacked links from the technical-analysis hub. |
| Trust page underused | `/methodology` | Several Learn articles described the same formulas without pointing to the published methodology. |

## Links added / verified

| Source | Target | Type | Verification |
|---|---|---|---|
| `/learn/how-to-analyze-a-stock` | `/learn/how-to-research-a-stock-before-buying` | Related box | PASS (HTML anchor present) |
| `/learn/how-to-analyze-stock-risk` | `/learn/how-to-research-a-stock-before-buying` | Related box | Registry update + build verified |
| `/learn/technical-vs-fundamental-analysis` | `/learn/how-to-research-a-stock-before-buying` | Related box | Build verified |
| `/learn/what-is-a-stock-market-correction` | `/learn/sp-500-etf-explained-voo-spy-ivv` | In-body contextual link on "S&P 500" | PASS (HTML anchor present) |
| `/learn/how-to-build-a-stock-watchlist` | `/learn/stock-watchlist-guide` | Related box | PASS (HTML anchor present) |
| `/learn/stock-watchlist-guide` | `/learn/how-to-build-a-stock-watchlist` | Related box | PASS (HTML anchor present) |
| `/learn/what-is-technical-analysis` | `/learn/what-is-adx`, `/learn/what-is-rsi`, `/learn/what-is-macd`, `/learn/sma-vs-ema`, `/learn/what-are-bollinger-bands`, `/learn/what-is-atr` | In-body indicator subsections | PASS (ADX anchor verified; all registry links rendered) |
| `/learn/what-is-adx` | `/learn/what-is-atr`, `/methodology` | In-body + related box | Build verified |
| `/learn/what-is-technical-analysis`, `/learn/what-is-atr`, `/learn/rsi-vs-macd`, `/learn/technical-vs-fundamental-analysis` | `/methodology` and relevant tools | Tool links / in-body | PASS (ATR → methodology verified) |
| Every `/stocks/{symbol}` | `/learn/what-is-atr`, `/methodology` | New SSR volatility section | PASS on `/stocks/aapl` (template applies to all 52) |

## Implementation notes

- The Learn article template renders the full `article.relatedArticles` array at `src/app/learn/[slug]/page.tsx:507`, so related-box entries are real anchors regardless of position. `getRelatedArticles()` (which slices to 3) is used elsewhere, not for that box.
- In-body links were added only where the surrounding sentence already discusses the target concept. No link farms, exact-match stuffing, or automated cross-linking were introduced.
- The extractor caps stored `linkedInternals` at 60 anchors per page, so verification used direct HTML anchor checks for the specific relationships above rather than relying only on the inbound counter.
- `/analysis` remains 0-inbound after metadata repair because adding a footer/nav link was outside the allowed scope; it is scheduled as roadmap item R09.
- `/test-chart` is intentionally noindex/nofollow with no inbound links. `/markets/more` is noindex/follow and now has a canonical.

## Outcome

Post-build verification passed all 28 content/SEO assertions, including every cross-link listed above. Verification used a temporary script at `C:\Users\PMLS\AppData\Local\Temp\opencode\verify-content.mjs` (not committed) against extracted prerendered HTML. No URL was changed, so no redirects or migration plan were required.
