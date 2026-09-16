import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Stock Technical Analysis — RSI, MACD & Indicators | ${SITE_NAME}` },
  description: `Analyze stocks with technical indicators including RSI, MACD, moving averages, Bollinger Bands, and ATR on ${SITE_NAME}.`,
  alternates: { canonical: `${SITE_URL}/markets/stock/technical` },
  openGraph: {
    title: `Technical Analysis | ${SITE_NAME}`,
    description: `Technical analysis with RSI, MACD, and more on ${SITE_NAME}.`,
    url: `${SITE_URL}/markets/stock/technical`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function TechnicalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
