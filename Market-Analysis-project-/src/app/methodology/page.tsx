import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Analysis Methodology — How Stock Analysis Works | ${SITE_NAME}` },
  description: `Learn how ${SITE_NAME} analyzes stocks using technical indicators, sentiment analysis, LSTM forecasting, risk assessment, and opportunity scoring.`,
  alternates: { canonical: `${SITE_URL}/methodology` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Methodology | ${SITE_NAME}`,
    description: `Learn how ${SITE_NAME} analyzes stocks using technical indicators, sentiment, forecasting, and risk assessment.`,
    url: `${SITE_URL}/methodology`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function MethodologyPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Analysis Methodology — How Stock Analysis Works`,
    description: `Learn how ${SITE_NAME} analyzes stocks using multiple evidence layers.`,
    url: `${SITE_URL}/methodology`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <header className="mt-6 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Analysis Methodology</h1>
            <p className="text-lg text-muted-foreground">
              StockVantex combines multiple analytical approaches into a single evidence-based research platform. Here is how each layer works.
            </p>
          </header>

          <div className="space-y-8">
            {/* Technical Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Technical Analysis</h2>
              <p className="text-muted-foreground mb-4">
                Technical analysis examines price movements, volume, and market data to identify patterns and trends. StockVantex calculates and presents several key indicators:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>RSI (Relative Strength Index)</strong> — Measures momentum on a 0–100 scale. Values above 70 may suggest overbought conditions; below 30 may suggest oversold.</li>
                <li><strong>MACD (Moving Average Convergence Divergence)</strong> — A trend-following momentum indicator showing the relationship between two moving averages of price.</li>
                <li><strong>Moving Averages (SMA/EMA)</strong> — Smoothed price lines that help identify trend direction over different timeframes.</li>
                <li><strong>Bollinger Bands</strong> — Volatility envelopes around price that expand and contract based on market conditions.</li>
                <li><strong>ATR (Average True Range)</strong> — Measures volatility by calculating the average range of price movement.</li>
                <li><strong>Trend Strength</strong> — Evaluates the consistency and strength of the current price trend on a 0–100 scale. Labels use the same bands as the scoring layer: Bullish above 60, Bearish below 40, Neutral in between; display colours follow those bands.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/what-is-technical-analysis" className="text-primary hover:underline">Learn more about technical analysis →</Link>
              </p>
            </section>

            {/* Sentiment Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Sentiment Analysis</h2>
              <p className="text-muted-foreground mb-4">
                Sentiment analysis summarizes automated scores of recent financial-news headlines for a company. It is not a direct measurement of investor mood or a prediction of price direction. The engine prefers provider-supplied sentiment tags and falls back to a deterministic keyword lexicon; no language model trained on financial text is used in production.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>News Coverage Scanning</strong> — Aggregates recent financial news headlines and articles related to each stock.</li>
                <li><strong>Article Scoring</strong> — Provider sentiment tags are used when available; otherwise a keyword lexicon produces an article-level score.</li>
                <li><strong>Sentiment Score</strong> — A composite score from -1 (very negative) to +1 (very positive) representing overall mood.</li>
                <li><strong>Market Mood</strong> — A categorical label (Bullish, Bearish, Neutral) derived from the sentiment score and distribution. The score label uses a neutral band of ±0.15: at or above +0.15 positive, at or below −0.15 negative, otherwise neutral. Charts and cards colour the score with the same band, so a Neutral label never shows a directional colour.</li>
                <li><strong>News Impact Summary</strong> — A brief summary of the key news factors driving current sentiment.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/what-is-stock-sentiment" className="text-primary hover:underline">Learn more about sentiment analysis →</Link>
              </p>
            </section>

            {/* Forecasting */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Price Forecasting</h2>
              <p className="text-muted-foreground mb-4">
                StockVantex uses an LSTM (Long Short-Term Memory) neural network with an attention mechanism to generate model-based price outlooks. The model is trained on historical daily closing prices and projects a sequence of price estimates over the next trading sessions.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Model Architecture</strong> — LSTM network with attention layer, serialised as an ONNX model for CPU-efficient inference.</li>
                <li><strong>Input Feature</strong> — Closing price only, scaled with MinMaxScaler and shaped into 60 close-price observations. Production uses the fitted scaler for tickers present in training; unseen tickers use a scaler fitted on the supplied history.</li>
                <li><strong>Forecast Horizon</strong> — 10 weekday steps ahead by default (configurable 1–30 in the API). Exchange holidays and half-days are not modeled, so these are approximate weekday steps rather than a verified trading calendar. Each step is produced recursively, using the previous step&apos;s predicted close as the next input in the 60-day lookback window.</li>
                <li><strong>Recursive Multi-Step Dynamics</strong> — The neural network predicts one step ahead. For multi-day projections, the model rolls its 60-day input forward, replacing the oldest price with its own latest prediction. Errors can compound with every recursive step; no calibrated uncertainty is produced or displayed.</li>
                <li><strong>Date Generation</strong> — Forecast dates use pandas business-day frequency (weekdays only). Exchange holidays and half-days are not modeled.</li>
                <li><strong>No Confidence Intervals</strong> — The model produces point estimates only. No uncertainty bounds are generated or displayed. The projected range shown (min–max of the 10-step sequence) reflects the spread of estimates across the horizon, not a statistical confidence interval.</li>
                <li><strong>Direction Convention</strong> — The Model Outlook direction compares the final modelled close against the reference price (the current price when available, otherwise the first forecast step). A change within ±0.3% is reported as Flat. This convention makes the direction reproducible and honest about the flat band; it does not imply a probability of the move occurring.</li>
                <li><strong>Validation Evidence</strong> — A small chronological holdout report exists for AAPL and MSFT only. It is not walk-forward fold validation, and no MAE/RMSE/MAPE/sMAPE table or directional baseline comparison is published; no accuracy superiority claim is made.</li>
              </ul>
              <div className="rounded-lg bg-muted/50 p-3 mt-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Important:</strong> Forecast outputs are uncalibrated point estimates, not probabilities. The displayed in-sample MAPE-based fit is a reconstruction proxy, not out-of-sample accuracy or backtested performance. No confidence intervals are produced; the 10-step min–max is only the spread of point estimates. Forecasts should be used as one input in your research, not as the basis for investment decisions.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/how-ai-stock-forecasting-works" className="text-primary hover:underline">Learn more about AI forecasting →</Link>
                {' · '}
                <Link href="/learn/beyond-price-predictions" className="text-primary hover:underline">Research framework: combining indicators, sentiment and machine learning →</Link>
              </p>
            </section>

            {/* Risk Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Risk Assessment</h2>
              <p className="text-muted-foreground mb-4">
                The risk score (0–100, higher = riskier) is a weighted composite of three independently measured historical dimensions:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Daily Volatility (40%)</strong> — Annualized standard deviation of simple daily close-to-close returns, scaled by √252. Scores linearly from &lt;10% (low risk) to &gt;40% (high risk).</li>
                <li><strong>Trend Stability (30%)</strong> — Inverted trend-strength score. A consistent trend is treated as lower risk; a chaotic or reversing trend as higher risk.</li>
                <li><strong>ATR / Price Ratio (30%)</strong> — 14-day simple-average true range as a percentage of the latest daily close. Scores linearly from &lt;1% (low) to &gt;5% (high).</li>
                <li><strong>Risk Level Thresholds</strong> — Score &lt;35 → Low; 35–65 → Medium; ≥65 → High.</li>
                <li><strong>Max Drawdown (Informational)</strong> — Peak-to-trough decline over the available history is reported separately and is not included in the composite score.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                All dimensions are calculated from historical price data. Historical risk does not fully capture future risk, including tail events, liquidity gaps, or regime changes.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/how-to-analyze-stock-risk" className="text-primary hover:underline">Learn more about risk analysis →</Link>
              </p>
            </section>

            {/* Opportunity Scoring */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Opportunity Score</h2>
              <p className="text-muted-foreground mb-4">
                The Opportunity Score (0–100) ranks a stock&apos;s research interest based on five quantitative factors. A higher score indicates more favourable momentum and sentiment conditions in the data; it is not a prediction of future returns.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Trend Strength (25% effective weight)</strong> — Derived from price vs. SMA20, price vs. SMA50, SMA crossover, and MACD direction.</li>
                <li><strong>RSI Momentum (20%)</strong> — Oversold readings (&lt;30) score positively as mean-reversion candidates; overbought (&gt;70) score negatively.</li>
                <li><strong>Volatility (20%)</strong> — Moderate annualised volatility (15–35%) is scored positively; extreme volatility (&gt;50%) scores negatively.</li>
                <li><strong>News Sentiment (20%)</strong> — Composite sentiment score from recent news articles, scaled from −20 to +20 points.</li>
                <li><strong>Relative Volume (15%)</strong> — Volume above 1.5× average amplifies the current trend signal; unavailable for assets without reliable volume data.</li>
                <li><strong>Display Bands</strong> — When the score is shown as a category (for example in screening lists), it is grouped as 70–100 strong, 40–70 moderate, below 40 weak. These are display groupings only; the underlying score is continuous and not a probability.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Scores are recalculated from the latest cached snapshot and are not calibrated against future returns. A high score does not indicate that a stock will rise. No backtest has been run linking score thresholds to profitable outcomes.
              </p>
            </section>

            {/* Research Brief Assessment */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Research Brief Assessment</h2>
              <p className="text-muted-foreground mb-4">
                The Stock Brief aggregates evidence from three directional sources and reports how well they agree, instead of collapsing everything into a single verdict:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Confirmation Signal</strong> — The technical setup signal is a weighted confirmation score combining trend (25%), RSI (15%), MACD (15%), risk (15%), volatility (10%), news sentiment (10%), and the opportunity setup (10%). A combined score above +0.18 reads Buy and below −0.18 reads Sell; when bullish and bearish components coexist the result is Mixed Evidence, and elevated risk with bearish components also produces Mixed Evidence rather than a passive Hold.</li>
                <li><strong>Three directional votes</strong> — Technical signal, news sentiment (when coverage is sufficient), and the cross-timeframe consensus (Buy/Sell/Hold; Mixed when horizons disagree) each count as one vote. Risk and forecast direction are separate assessments shown alongside and never converted into Buy or Sell.</li>
                <li><strong>Aligned</strong> — All available sources point the same way (or the data is too sparse to disagree).</li>
                <li><strong>Mixed</strong> — Sources disagree on direction (bullish and bearish votes coexist), or the backend flagged conflicting or high-risk divergent evidence.</li>
                <li><strong>Diverging</strong> — Some sources point one way while others read neutral: partial agreement only, never presented as a unanimous conclusion.</li>
                <li><strong>Missing data is honest</strong> — A source without sufficient data is excluded from the counts and listed as a limitation (for example “News sentiment is excluded”). The brief never substitutes Hold or Neutral for missing evidence, and the model&apos;s setup score is never shown as a confidence percentage.</li>
                <li><strong>Risk stays independent</strong> — Risk uses its own bands (Low below 35, Medium 35–65, High at or above 65). A High risk label does not mean Sell, and positive evidence does not cancel risk; when both appear the brief says so explicitly.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                These agreement rules are presentation conventions chosen for transparency. They have not been backtested as predictive signals, and an assessment label is not an investment recommendation.
              </p>
            </section>

            {/* Data Sources */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Data Sources</h2>
              <p className="text-muted-foreground mb-3">
                  Historical OHLCV and quote data are requested at runtime from Yahoo Finance via the yahooquery adapter, with a yfinance fallback path when needed. News comes from Google News, Yahoo Finance, GDELT, Marketaux, NewsData.io, Currents, Alpha Vantage, RSS feeds and SEC EDGAR, selected by the news provider router. Some providers require API keys and availability varies; no paid-data partnership is implied.
                </p>
                <p className="text-muted-foreground mb-3">
                  Yahoo history is flattened to Close, High, Low, Open and Volume; adjclose is mapped to Close when used. Rows with missing Close are dropped and missing Volume is recorded as 0. Inputs are not deduplicated, sorted, timezone-normalized or adjusted for corporate actions beyond the provider&apos;s own fields.
                </p>
                <p className="text-muted-foreground mb-3">
                  Responses are cached in memory and SQLite with time-based expiry. The UI&apos;s &ldquo;Snapshot refreshed&rdquo; label reflects cache write time, not the exchange quote timestamp. Market status is estimated from UTC time and a static US-holiday list; it is not an exchange feed.
                </p>
                <p className="text-muted-foreground">
                  Forecasting, technical, risk and volatility tools use daily closing prices for allowlisted symbols. News sentiment requires a company alias mapping and does not cover social media. Data may be delayed and is provided for informational purposes only.
                </p>
            </section>

            {/* Limitations */}
            <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <h2 className="text-xl font-bold mb-3">Limitations & Disclaimers</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  StockVantex is a research and analysis tool. It does not provide personalized investment advice, and its outputs should not be the sole basis for investment decisions.{' '}
                  <Link href="/disclaimer" className="text-primary hover:underline">Financial disclaimer</Link>
                </p>
                <p>
                  All analysis is based on historical and latest available market data. Past performance and historical model evaluation metrics do not guarantee future results.
                </p>
                <p>
                  Forecasts are uncalibrated point estimates with no confidence intervals. Market conditions change, and models may not adapt quickly enough to unprecedented events.
                </p>
                <p>
                  Always conduct your own research and consider your personal financial situation and risk tolerance before making investment decisions. See the{' '}
                  <Link href="/editorial-standards" className="text-primary hover:underline">editorial standards and correction log</Link>{' '}
                  for ownership, review status and correction history.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
