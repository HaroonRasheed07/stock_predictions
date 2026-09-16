import { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import StockIndexClient from './StockIndexClient';

export const metadata: Metadata = {
  title: 'Stock Analysis',
  description: 'Browse Stock Vanta\'s stock analysis universe. Search and explore technical analysis, sentiment, and AI-powered forecasts for major US equities.',
  alternates: { canonical: `${SITE_URL}/stocks` },
  openGraph: {
    title: `Stock Analysis | ${SITE_NAME}`,
    description: 'Browse Stock Vanta\'s stock analysis universe.',
    url: `${SITE_URL}/stocks`,
  },
};

export default function StocksPage() {
  return <StockIndexClient />;
}
