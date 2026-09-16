import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Discover Stocks — Find Opportunities | ${SITE_NAME}` },
  description: `Discover stocks worth investigating with ${SITE_NAME}'s screening tools. Find opportunities based on technical signals, sentiment, and risk.`,
  alternates: { canonical: `${SITE_URL}/markets/discover` },
  openGraph: {
    title: `Discover Stocks | ${SITE_NAME}`,
    description: `Find stock opportunities with ${SITE_NAME}'s screening tools.`,
    url: `${SITE_URL}/markets/discover`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
