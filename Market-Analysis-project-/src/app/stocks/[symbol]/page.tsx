import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStockInfo } from '@/lib/stock-allowlist';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import StockPageClient from './StockPageClient';
import { BreadcrumbJsonLd } from '@/components/seo/StructuredData';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateStaticParams() {
  const { getAllAllowlistedSymbols } = await import('@/lib/stock-allowlist');
  return getAllAllowlistedSymbols().map((symbol) => ({ symbol: symbol.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const info = getStockInfo(symbol);
  if (!info) return {};

  const title = `${info.symbol} Stock Analysis — Technical Signals, Sentiment & Forecast`;
  const description = `Analyze ${info.name} (${info.symbol}) with technical indicators, market sentiment, risk assessment, and Stock Vanta's model-based forecast.`;
  const canonical = `${SITE_URL}/stocks/${symbol.toLowerCase()}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
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

  if (!info) {
    notFound();
  }

  const canonical = `${SITE_URL}/stocks/${symbol.toLowerCase()}`;
  const breadcrumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Stocks', url: `${SITE_URL}/stocks` },
    { name: `${info.name} (${info.symbol})`, url: canonical },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <StockPageClient symbol={info.symbol} name={info.name} />
    </>
  );
}
