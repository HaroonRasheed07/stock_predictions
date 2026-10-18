import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, SEO_INDEXING_ENABLED } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Stock Market Overview — Indices, Movers & Research',
  description:
    'Start any stock research session from the market overview: top movers, technical signals, news sentiment, forecasts, and risk — in one workspace.',
  alternates: { canonical: `${SITE_URL}/markets/stock` },
  robots: SEO_INDEXING_ENABLED ? 'index, follow' : 'noindex, nofollow',
  openGraph: {
    title: `Stock Market Overview — ${SITE_NAME}`,
    description:
      'Top movers, technical signals, news sentiment, forecasts, and risk in one research workspace.',
    url: `${SITE_URL}/markets/stock`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
