import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getAllAllowlistedSymbols, getStockInfo } from '@/lib/stock-allowlist';
import { StockIndexClient } from './StockIndexClient';

export const metadata: Metadata = {
  title: { absolute: `Explore Stocks — Stock Research Directory | ${SITE_NAME}` },
  description: `Browse ${SITE_NAME}'s curated directory of ${getAllAllowlistedSymbols().length} major stocks. Search by ticker or company name for technical analysis, sentiment, risk, and forecast research pages.`,
  alternates: { canonical: `${SITE_URL}/stocks` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Explore Stocks | ${SITE_NAME}`,
    description: `Search ${SITE_NAME}'s curated stock research directory and open technical, sentiment, risk, and forecast research for any supported ticker.`,
    url: `${SITE_URL}/stocks`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

const POPULAR_SYMBOLS = ['aapl', 'msft', 'nvda', 'amzn', 'tsla', 'googl'];

export default function StocksPage() {
  const symbols = getAllAllowlistedSymbols();
  const stocks = symbols.map((s) => getStockInfo(s)).filter(Boolean) as NonNullable<ReturnType<typeof getStockInfo>>[];
  const popular = POPULAR_SYMBOLS.map((s) => getStockInfo(s)).filter(Boolean) as NonNullable<ReturnType<typeof getStockInfo>>[];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mt-6 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Explore Stocks</h1>
          <p className="text-muted-foreground max-w-2xl">
            A curated directory of {stocks.length} major stocks supported for full research on {SITE_NAME} — each with
            technical indicators, news sentiment, risk assessment, and model-based forecasting. Search by ticker or
            company name to open a research page.
          </p>
        </div>

        <section aria-labelledby="popular-stocks" className="mb-10">
          <h2 id="popular-stocks" className="text-lg font-semibold mb-3">Popular stocks</h2>
          <div className="flex flex-wrap gap-2">
            {popular.map(
              (info) =>
                info && (
                  <Link
                    key={info.symbol}
                    href={`/stocks/${info.symbol.toLowerCase()}`}
                    className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/20 hover:text-primary transition-all"
                  >
                    <span className="font-semibold">{info.symbol}</span>
                    <span className="text-muted-foreground ml-2">{info.name}</span>
                  </Link>
                )
            )}
          </div>
        </section>

        <StockIndexClient stocks={stocks} />
      </div>
    </div>
  );
}
