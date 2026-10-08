import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Financial Disclaimer | ${SITE_NAME}` },
  description: `Important limitations about ${SITE_NAME}'s research tools, market data, forecasts, and educational content. Not investment advice.`,
  alternates: { canonical: `${SITE_URL}/disclaimer` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Financial Disclaimer | ${SITE_NAME}`,
    description: `Important limitations about ${SITE_NAME}'s research tools, market data, forecasts, and educational content. Not investment advice.`,
    url: `${SITE_URL}/disclaimer`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function DisclaimerPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Financial Disclaimer',
    url: `${SITE_URL}/disclaimer`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Financial Disclaimer</h1>
          <p className="text-sm text-muted-foreground mb-4">Effective date: October 8, 2026</p>
          <p className="text-sm text-muted-foreground mb-8">
            Please read this disclaimer carefully. It applies to every page, tool, and output on {SITE_NAME}.
          </p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">What {SITE_NAME} provides</h2>
              <p>
                {SITE_NAME} is a research and education platform. Its features include: a stock market overview;
                watchlist tools; technical analysis (for example RSI, MACD, moving averages, support and resistance,
                and pattern indicators); news sentiment analysis; risk analysis; opportunity discovery; a stock
                research view per company; AI-assisted forecasting tools; and educational articles. These features
                are descriptions of the product. Everything below explains their limitations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Not investment advice</h2>
              <p>
                Nothing on {SITE_NAME} is personalized investment advice, financial advice, legal advice, tax advice,
                or an offer or solicitation to buy or sell any security, cryptocurrency, or other instrument. Outputs
                such as indicators, classifications, signals, scores, watchlists, and research summaries are general
                information generated from data and models. They do not take account of your personal circumstances,
                objectives, risk tolerance, or financial situation. You are solely responsible for your own decisions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">No guarantee of accuracy</h2>
              <p>
                We do not warrant that any figure, chart, score, article, or other content on the platform is
                accurate, complete, current, or error-free. Market data may be delayed, incomplete, or temporarily
                unavailable, and displayed prices can become stale. Always verify information with an independent
                source before acting on it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Forecasts and model outputs</h2>
              <p>
                Forecast outputs are statistical estimates produced by machine-learning models trained on historical
                data. All models carry inherent uncertainty, and real markets can behave in ways historical data does
                not contain. Forecasts are not statements about what will happen, are not promises of performance,
                and must not be treated as such. Past performance does not guarantee future results.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Technical indicators and signals</h2>
              <p>
                Technical indicators are mathematical transformations of historical price and volume data. They
                describe what has already happened; they do not predict future prices. Any buy, sell, or watch-style
                classification shown anywhere on the platform is a model-generated research output for education,
                not a recommendation to trade.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Sentiment analysis limitations</h2>
              <p>
                Sentiment scores are produced by automated natural-language analysis of news articles. Automated
                analysis can misread tone, satire, corrections, and context; article coverage of a company can be
                sparse or one-sided at any moment. A sentiment score reflects the sampled articles, not the full
                state of a business or market.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Risk of loss</h2>
              <p>
                Investing involves risk, including the possible loss of principal. You can lose some or all of the
                money you invest. {SITE_NAME} does not assess whether any instrument is suitable for you. Consider
                consulting a suitably qualified, independent professional before making financial decisions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Third-party data and links</h2>
              <p>
                Prices, indicators, and news are sourced from third-party providers and publishers via our backend
                service. Those providers supply the material under their own terms, and external links open websites
                we do not control. We are not responsible for third-party content, accuracy, availability, or
                practices.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">No regulatory affiliation</h2>
              <p>
                {SITE_NAME} is an independent research and education project. It is not a registered investment
                adviser, broker-dealer, or exchange, and it does not hold itself out as providing licensed advisory
                services. Nothing on the platform implies endorsement, sponsorship, or verification by any
                regulator, exchange, financial institution, or publication.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Further terms</h2>
              <p>
                Use of the platform is also governed by our{' '}
                <Link href="/terms" className="text-primary hover:underline">Terms and Conditions</Link>, which
                contain additional disclaimers and limitations of liability, and by our{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. Our{' '}
                <Link href="/methodology" className="text-primary hover:underline">Methodology</Link> page explains
                how the analysis tools work.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
              <p>
                Questions about this disclaimer can be sent through the{' '}
                <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
