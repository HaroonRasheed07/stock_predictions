import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `AI Stock Forecasting — LSTM Price Projections | ${SITE_NAME}` },
  description: `Model-based point-estimate stock outlooks on ${SITE_NAME}, with no calibrated confidence intervals.`,
  alternates: { canonical: `${SITE_URL}/markets/stock/forecast` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `AI Stock Forecasting | ${SITE_NAME}`,
    description: `LSTM-based stock price forecasting on ${SITE_NAME}.`,
    url: `${SITE_URL}/markets/stock/forecast`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function ForecastLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
