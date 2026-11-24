# News Sentiment Audit

**Date:** 2026-11-24
**Scope:** `stock_market/news_engine/*`, `news_providers.py`, `sentiment.py`, `shared_sentiment.py`, `api.py`, and public sentiment copy.

## Pipeline map

```
ticker -> company/alias resolver -> provider router
  -> provider articles -> NewsArticle normalization
  -> dedupe / relevance / age filtering
  -> provider sentiment tag or deterministic keyword score
  -> article scores + publisher diversity + source type + age
  -> SentimentSnapshot -> FastAPI -> frontend chips and Brief vote
```

## Confirmed behavior

- Progressive windows: 24h → 72h → 7d (`NEWS_PRIMARY_WINDOW_DAYS=1`, `NEWS_SECONDARY_WINDOW_DAYS=3`, `NEWS_MAX_AGE_DAYS=7`).
- Normalized articles carry id/url/title/description/publisher/published_at/provider/source_type and sentiment fields.
- Statuses include `sufficient`, `insufficient`, `no_relevant_news`, `news_unavailable`, `error`.
- Labels include `positive`, `neutral`, `negative`, `insufficient_news`, `news_unavailable`, `analysis_error`.
- Neutral band is ±0.15; the frontend shares that threshold.
- Sources include RSS, Yahoo, Google News, GDELT, Marketaux, NewsData.io, Currents, Alpha Vantage and SEC EDGAR, selected by the router.
- No social-media provider exists in `providers.py:1098-1105`.
- No FinBERT or other language model trained on financial text is used in production. A keyword lexicon is the deterministic fallback.
- Missing or insufficient news is not silently converted into bullish, neutral or Hold evidence.

## Claim corrections

- `analysis/page.tsx`: “news and social media” → “recent financial-news headlines”.
- `methodology/page.tsx`: “language models trained on financial text” → provider sentiment tags plus keyword fallback.
- Learn article: FinBERT remains a general educational example, with an explicit statement that StockVantex does not use it in production.
- Methodology now discloses alias-mapping coverage and that social data is not used.

## Integrity decisions

- Sentiment remains one research input, never investment advice.
- It contributes to the Brief’s three directional votes only when coverage is sufficient.
- News sentiment does not change the forecast model, which is price-only.
- Publisher diversity, source type and age are used in aggregation; exact proprietary weights are not presented as externally validated.

## Limitations

- No external sentiment-accuracy benchmark was run.
- Provider API keys may be unavailable locally; provider presence in code is not a service-level agreement.
- Article publication time and retrieval time are distinct; cache age must not be read as publication freshness.
- No claim is made that news sentiment predicts returns.
