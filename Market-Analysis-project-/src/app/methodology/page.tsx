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
                <li><strong>Trend Strength</strong> — Evaluates the consistency and strength of the current price trend.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/what-is-technical-analysis" className="text-primary hover:underline">Learn more about technical analysis →</Link>
              </p>
            </section>

            {/* Sentiment Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Sentiment Analysis</h2>
              <p className="text-muted-foreground mb-4">
                Sentiment analysis evaluates the overall market mood toward a stock by analyzing financial news coverage. StockVantex processes news articles using natural language processing (NLP) to classify coverage as positive, negative, or neutral.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>News Coverage Scanning</strong> — Aggregates recent financial news headlines and articles related to each stock.</li>
                <li><strong>NLP Classification</strong> — Each article is scored for sentiment using language models trained on financial text.</li>
                <li><strong>Sentiment Score</strong> — A composite score from -1 (very negative) to +1 (very positive) representing overall mood.</li>
                <li><strong>Market Mood</strong> — A categorical label (Bullish, Bearish, Neutral) derived from the sentiment score and distribution.</li>
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
                <li><strong>Input Feature</strong> — Closing price only, normalised via MinMaxScaler over a 60-day lookback window.</li>
                <li><strong>Forecast Horizon</strong> — Fixed 10 business days ahead (2 trading weeks). While the underlying ONNX inference engine accepts a configurable range of 1 to 30 trading days, 10 trading days is the authoritative production standard across all StockVantex product views. Each day&apos;s estimate is produced recursively, using the previous day&apos;s predicted close as the next input in the 60-day lookback window.</li>
                <li><strong>Recursive Multi-Step Dynamics</strong> — The neural network predicts one step ahead. For multi-day projections, the model rolls its 60-day input forward, replacing the oldest price with its own latest prediction. Because prediction uncertainty compounds with every recursive step, forecasting beyond 10 sessions exhibits diminished statistical reliability.</li>
                <li><strong>Trading Calendar Alignment</strong> — Forecast dates strictly follow exchange business days, excluding weekends and market holidays.</li>
                <li><strong>No Confidence Intervals</strong> — The model produces point estimates only. No uncertainty bounds are generated or displayed. The projected range shown (min–max of the 10-step sequence) reflects the spread of estimates across the horizon, not a statistical confidence interval.</li>
                <li><strong>Validation Approach</strong> — The model is evaluated against held-out historical data on a walk-forward basis. Past model accuracy does not guarantee future accuracy.</li>
              </ul>
              <div className="rounded-lg bg-muted/50 p-3 mt-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Important:</strong> Forecast outputs are probabilistic estimates, not predictions. Historical model evaluation metrics (such as backtesting accuracy) describe how the model performed on past data—they do not guarantee future performance. Forecasts should be used as one input in your research, not as the basis for investment decisions.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/how-ai-stock-forecasting-works" className="text-primary hover:underline">Learn more about AI forecasting →</Link>
              </p>
            </section>

            {/* Risk Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Risk Assessment</h2>
              <p className="text-muted-foreground mb-4">
                The risk score (0–100, higher = riskier) is a weighted composite of three independently measured historical dimensions:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Daily Volatility (40%)</strong> — Annualised standard deviation of daily log-returns. Scores linearly from &lt;10% (low risk) to &gt;40% (high risk).</li>
                <li><strong>Trend Stability (30%)</strong> — Inverted trend-strength score. A consistent trend is treated as lower risk; a chaotic or reversing trend as higher risk.</li>
                <li><strong>ATR / Price Ratio (30%)</strong> — 14-day Average True Range as a percentage of current price. Scores linearly from &lt;1% (low) to &gt;5% (high).</li>
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
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Scores are recalculated from live data and are not calibrated against future returns. A high score does not indicate that a stock will rise. No backtest has been run linking score thresholds to profitable outcomes.
              </p>
            </section>

            {/* Data Sources */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Data Sources</h2>
              <p className="text-muted-foreground">
                StockVantex uses market data from Yahoo Finance and news data from multiple financial news providers. All analysis is derived from this data and the models described above. Data may be delayed and is provided for informational purposes only.
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
                  All analysis is based on historical and current market data. Past performance and historical model evaluation metrics do not guarantee future results.
                </p>
                <p>
                  Forecasts are probabilistic estimates with inherent uncertainty. Market conditions change, and models may not adapt quickly enough to unprecedented events.
                </p>
                <p>
                  Always conduct your own research and consider your personal financial situation and risk tolerance before making investment decisions.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
