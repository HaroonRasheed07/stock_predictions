import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'My Watchlist',
  robots: 'noindex, follow',
  alternates: { canonical: `${SITE_URL}/markets/stock/watchlist` },
};

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
