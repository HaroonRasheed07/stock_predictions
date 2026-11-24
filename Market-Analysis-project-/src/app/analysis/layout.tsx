import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { WebPageJsonLd } from '@/components/seo/StructuredData';

const description = `${SITE_NAME}'s analysis tools bring AI news sentiment, LSTM price forecasting, technical indicators (RSI, MACD, moving averages), and market overview into one focused workspace.`;

export const metadata: Metadata = {
  title: { absolute: `Stock Analysis Tools — Sentiment, Forecast & Technicals | ${SITE_NAME}` },
  description,
  alternates: { canonical: `${SITE_URL}/analysis` },
  keywords: ['stock analysis tools', 'technical analysis tool', 'stock sentiment analysis', 'ai stock forecast'],
  openGraph: {
    images: ['/icon-512.png'],
    title: `Stock Analysis Tools | ${SITE_NAME}`,
    description,
    url: `${SITE_URL}/analysis`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebPageJsonLd
        name="Stock Analysis Tools"
        url={`${SITE_URL}/analysis`}
        description={description}
      />
      {children}
    </>
  );
}
