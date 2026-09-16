import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getStockInfo, getRelatedStocks, getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { StockPageClient } from './StockPageClient';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export const dynamicParams = true;

export async function generateStaticParams() {
  return getAllAllowlistedSymbols().map((symbol) => ({
    symbol: symbol.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const info = getStockInfo(symbol);
  const displayName = info?.name || symbol.toUpperCase();
  const displaySymbol = info?.symbol || symbol.toUpperCase();

  const title = { absolute: `${displaySymbol} Stock Analysis — Technical Signals, Sentiment & Forecast | ${SITE_NAME}` };
  const description = `Analyze ${displayName} (${displaySymbol}) with technical indicators, market sentiment, risk assessment, and Stock Vanta's model-based forecast.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stocks/${symbol.toLowerCase()}` },
    robots: info ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/stocks/${symbol.toLowerCase()}`,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function StockPage({ params }: PageProps) {
  const { symbol } = await params;
  const info = getStockInfo(symbol);
  const displayName = info?.name || symbol.toUpperCase();
  const displaySymbol = info?.symbol || symbol.toUpperCase();
  const related = getRelatedStocks(symbol);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${displaySymbol} Stock Analysis`,
    description: `Technical analysis, sentiment, risk assessment, and forecast for ${displayName} (${displaySymbol}).`,
    url: `${SITE_URL}/stocks/${symbol.toLowerCase()}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="mt-6 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold">{displayName} ({displaySymbol}) Stock Analysis</h1>
            </div>
            <p className="text-muted-foreground max-w-3xl">
              Explore {displayName} ({displaySymbol}) with AI-powered technical indicators, market sentiment analysis, risk assessment, and model-based price forecasting. Part of {SITE_NAME}'s research platform.
            </p>
          </div>

          <StockPageClient symbol={displaySymbol} />

          <div className="mt-8 space-y-6">
            {info && (
              <section>
                <h2 className="text-lg font-semibold mb-3">About {info.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {info.name} ({info.symbol}) operates in the {info.sector} sector, within the {info.industry} industry. This page provides technical analysis, sentiment data, and forecasting tools to help you research {info.symbol} as part of your broader investment analysis.
                </p>
              </section>
            )}

            {related.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Related Stocks</h2>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <Link
                      key={r.symbol}
                      href={`/stocks/${r.symbol.toLowerCase()}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/20 hover:shadow-sm transition-all"
                    >
                      <span className="font-semibold">{r.symbol}</span>
                      <span className="text-muted-foreground">{r.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">Analysis Methodology</h2>
              <p className="text-xs text-muted-foreground">
                Stock Vanta combines technical indicators (RSI, MACD, moving averages, Bollinger Bands, ATR), news-based sentiment analysis, and LSTM/attention-based forecasting models to generate multi-layered stock analysis.{' '}
                <Link href="/methodology" className="text-primary hover:underline">
                  Learn about our methodology
                </Link>
                .
              </p>
            </section>

            <p className="text-xs text-muted-foreground">
              Last updated: September 2026. Market data and analysis are updated regularly but may be delayed. This analysis is for informational purposes only and does not constitute investment advice.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
