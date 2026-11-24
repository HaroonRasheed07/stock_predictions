# Research Methodology

**Date:** 2026-11-24
**Status:** source-aligned summary; see `FORECAST_VALIDATION_RESULTS.md` for validation gaps.

## Data

- Historical OHLCV and quotes: Yahoo Finance via `yahooquery`, with a `yfinance` fallback in `utils.load_data()`.
- News: Google News, Yahoo Finance, GDELT, Marketaux, NewsData.io, Currents, Alpha Vantage, RSS and SEC EDGAR, selected by the news provider router.
- Missing Close rows are dropped; missing Volume is recorded as `0`. No extra dedupe/timezone/corporate-action normalization is performed.
- Cached data is labeled by snapshot refresh time, not exchange quote timestamp.
- Market status is an estimate from UTC time and a static US-holiday list, not an exchange feed.

## Technical analysis

- SMA20/SMA50, EMA20, RSI14, MACD 12/26/9, Bollinger Bands and ATR14 are computed from daily bars.
- RSI uses an EWM variant (`com=13`, `adjust=False`) rather than the canonical Wilder SMA seed; this is documented as an implementation variant.
- ATR uses a simple 14-period mean of True Range.
- Trend strength combines price vs SMA20/SMA50, SMA alignment and MACD direction into a 0–100 score.
- No ADX/DMI implementation exists; ADX Learn content is educational only.

## Volatility and risk

- Daily volatility: sample standard deviation of simple daily returns, annualized by √252.
- Expected range: latest daily close ± one ATR14; ATR% is ATR / latest daily close.
- Relative volume: latest volume / trailing average, `N/A` when volume is unavailable.
- Risk score: 40% daily volatility, 30% inverted trend stability, 30% ATR/price; bands Low <35, Medium 35–65, High ≥65.
- Max drawdown is informational and not in the composite score.

## News sentiment

- Provider sentiment tags are preferred; a deterministic keyword lexicon is the fallback.
- Scores range from −1 to +1 with a ±0.15 neutral band.
- Missing coverage yields `insufficient_news` or `news_unavailable`, never a fabricated neutral signal.
- No social data and no FinBERT/NLP model are used in production.

## Forecasting

- BiLSTM/attention LSTM trained on scaled daily closes.
- Input is 60 close-price observations; output is one next-step point estimate.
- Recursive 10-step default horizon (1–30 available via API); weekday dates only, holidays not modeled.
- Known tickers use the pre-fitted per-ticker scaler; unknown tickers use a scaler fitted on the supplied history.
- No calibrated confidence intervals or probabilities are produced.
- The displayed MAPE-derived figure is an in-sample reconstruction proxy, not out-of-sample accuracy.
- Walk-forward results, an out-of-sample error table and baseline comparisons are not published.

## Opportunity and Research Brief

- Opportunity score uses trend, RSI, volatility, news sentiment and relative volume, with display bands 40/70; it is not a probability of return.
- Brief evidence compares technical signal, sufficient news sentiment and cross-timeframe consensus as three directional votes.
- Risk and forecast direction are shown independently and are never converted into Buy/Sell.
- Missing data is listed as a limitation rather than replaced with Hold.
- All agreement rules are presentation conventions and have not been backtested as predictive signals.

## Use boundary

StockVantex is an educational research tool. Nothing here is personalized investment advice, a trade recommendation, a verified forecast probability, or a claim of audited provider quality.
