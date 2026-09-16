import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Stock Sentiment Analysis — News & Market Mood | ${SITE_NAME}` },
  description: `Analyze market sentiment for stocks using news-driven NLP scoring on ${SITE_NAME}. See bullish, bearish, and neutral sentiment breakdowns.`,
  alternates: { canonical: `${SITE_URL}/markets/stock/sentiment` },
  openGraph: {
    title: `Sentiment Analysis | ${SITE_NAME}`,
    description: `News-driven sentiment analysis for stocks on ${SITE_NAME}.`,
    url: `${SITE_URL}/markets/stock/sentiment`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function SentimentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
