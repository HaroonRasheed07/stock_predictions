import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Research Brief — Evidence-Based Stock Analysis | ${SITE_NAME}` },
  description: `${SITE_NAME}'s Research Brief connects technical signals, news sentiment, LSTM forecasting, and risk assessment into one evidence-based view. See signal agreement, disagreement explanations, and what to investigate next.`,
  alternates: { canonical: `${SITE_URL}/markets/brief` },
  keywords: ['stock research brief', 'technical analysis', 'stock sentiment', 'risk assessment', 'evidence-based investing'],
  openGraph: {
    images: ['/icon-512.png'],
    title: `Research Brief | ${SITE_NAME}`,
    description: 'Evidence-based stock research brief connecting technical, sentiment, forecast, and risk signals.',
    url: `${SITE_URL}/markets/brief`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
