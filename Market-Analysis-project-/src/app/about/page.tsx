import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { AboutClient } from './AboutClient';

export const metadata: Metadata = {
  title: { absolute: `About — ${SITE_NAME}` },
  description: `${SITE_NAME} brings technical analysis, market sentiment, AI-assisted forecasting and risk intelligence into one focused stock-research experience.`,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description: `${SITE_NAME} brings technical analysis, market sentiment, AI-assisted forecasting and risk intelligence into one focused stock-research experience.`,
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
