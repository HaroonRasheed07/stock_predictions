import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Analysis Methodology — How Stock Analysis Works | ${SITE_NAME}` },
  description: `Learn how ${SITE_NAME} analyzes stocks using technical indicators, sentiment analysis, LSTM forecasting, risk assessment, and opportunity scoring.`,
  alternates: { canonical: `${SITE_URL}/methodology` },
  openGraph: {
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
              Stock Vanta combines multiple analytical approaches into a single evidence-based research platform. Here is how each layer works.
            </p>
          </header>

          <div className="space-y-8">
            {/* Technical Analysis */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Technical Analysis</h2>
              <p className="text-muted-foreground mb-4">
                Technical analysis examines price movements, volume, and market data to identify patterns and trends. Stock Vanta calculates and presents several key indicators:
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
                Sentiment analysis evaluates the overall market mood toward a stock by analyzing financial news coverage. Stock Vanta processes news articles using natural language processing (NLP) to classify coverage as positive, negative, or neutral.
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
                Stock Vanta uses LSTM (Long Short-Term Memory) neural networks with attention mechanisms to generate probabilistic price forecasts. The model learns from historical price sequences and projects potential future price paths.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Model Architecture</strong> — LSTM networks with attention, designed for sequential financial data.</li>
                <li><strong>Input Features</strong> — Historical prices, volume, and derived technical indicators over a lookback window.</li>
                <li><strong>Forecast Horizon</strong> — Projects prices over a configurable future period (typically 7–30 days).</li>
                <li><strong>Confidence Intervals</strong> — Forecasts include probability ranges, not just point estimates.</li>
                <li><strong>Historical Backtesting</strong> — Models are evaluated against historical data, but past performance does not guarantee future accuracy.</li>
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
                Stock Vanta evaluates risk through multiple dimensions, combining volatility analysis, trend stability, and market conditions into a comprehensive risk profile.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Volatility Analysis</strong> — Daily and weekly volatility calculations based on historical price movement.</li>
                <li><strong>ATR-Based Expected Range</strong> — Uses ATR to estimate the expected daily trading range.</li>
                <li><strong>Risk Score</strong> — A composite score (0–100) reflecting overall risk level.</li>
                <li><strong>Risk Factors</strong> — Individual risk dimensions including volatility, trend stability, and drawdown exposure.</li>
                <li><strong>Risk Level</strong> — Categorical assessment (Low, Medium, High) based on the composite risk score.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                <Link href="/learn/how-to-analyze-stock-risk" className="text-primary hover:underline">Learn more about risk analysis →</Link>
              </p>
            </section>

            {/* Opportunity Scoring */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Opportunity Scoring</h2>
              <p className="text-muted-foreground mb-4">
                The opportunity score combines technical signals, sentiment, risk, and momentum into a single composite score (0–100) that represents the overall attractiveness of a stock as a research candidate.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Multi-Factor Composition</strong> — The score weighs technical momentum, sentiment alignment, risk-adjusted potential, and trend quality.</li>
                <li><strong>Signal Integration</strong> — Buy/Sell/Hold signals from technical analysis, sentiment, and risk assessment are combined.</li>
                <li><strong>Comparative Ranking</strong> — Scores allow comparison across different stocks within the same universe.</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                The opportunity score is an analytical tool, not a recommendation. A high score does not guarantee positive returns.
              </p>
            </section>

            {/* Data Sources */}
            <section className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="text-xl font-bold mb-3">Data Sources</h2>
              <p className="text-muted-foreground">
                Stock Vanta uses market data from Yahoo Finance and news data from multiple financial news providers. All analysis is derived from this data and the models described above. Data may be delayed and is provided for informational purposes only.
              </p>
            </section>

            {/* Limitations */}
            <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <h2 className="text-xl font-bold mb-3">Limitations & Disclaimers</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Stock Vanta is a research and analysis tool. It does not provide personalized investment advice, and its outputs should not be the sole basis for investment decisions.
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
