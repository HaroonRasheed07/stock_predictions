import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Stock Brief — Multi-Layer Evidence Summary | ${SITE_NAME}` },
  description: `View ${SITE_NAME}'s stock brief: a concise evidence summary combining technical signals, sentiment, risk, and forecast for your selected stock.`,
  alternates: { canonical: `${SITE_URL}/markets/brief` },
  openGraph: {
    title: `Stock Brief | ${SITE_NAME}`,
    description: `Multi-layer stock evidence summary from ${SITE_NAME}.`,
    url: `${SITE_URL}/markets/brief`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
