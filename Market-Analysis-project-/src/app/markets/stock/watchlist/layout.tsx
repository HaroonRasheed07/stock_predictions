import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'My Watchlist',
  robots: 'noindex, follow',
};

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
