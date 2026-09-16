import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getAllAllowlistedSymbols, getStockInfo } from '@/lib/stock-allowlist';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { StockIndexClient } from './StockIndexClient';

export const metadata: Metadata = {
  title: { absolute: `Stock Analysis — Browse AI-Powered Market Intelligence | ${SITE_NAME}` },
  description: `Browse ${SITE_NAME}'s stock analysis universe. Find AI-powered technical analysis, sentiment, forecasting, and risk metrics for major stocks.`,
  alternates: { canonical: `${SITE_URL}/stocks` },
  openGraph: {
    title: `Stock Analysis | ${SITE_NAME}`,
    description: `Browse ${SITE_NAME}'s stock analysis universe with AI-powered technical analysis, sentiment, and forecasting.`,
    url: `${SITE_URL}/stocks`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function StocksPage() {
  const symbols = getAllAllowlistedSymbols();
  const stocks = symbols.map((s) => getStockInfo(s)).filter(Boolean) as NonNullable<ReturnType<typeof getStockInfo>>[];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Stocks' }]} />

        <div className="mt-6 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Stock Analysis</h1>
          <p className="text-muted-foreground max-w-2xl">
            AI-powered analysis for major stocks. Each stock page includes technical indicators, market sentiment, risk assessment, and model-based forecasting.
          </p>
        </div>

        <StockIndexClient stocks={stocks} />
      </div>
    </div>
  );
}
