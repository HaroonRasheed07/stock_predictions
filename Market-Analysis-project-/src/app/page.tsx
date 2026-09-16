import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — AI Stock Analysis, Signals & Market Intelligence` },
  description: 'AI-powered stock research with technical analysis, sentiment, risk metrics, and model-based forecasting. See the full picture before deciding.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE_NAME} — AI Stock Analysis & Market Intelligence`,
    description: 'AI-powered stock research with technical analysis, sentiment, risk metrics, and model-based forecasting.',
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — AI Stock Analysis & Market Intelligence`,
    description: 'AI-powered stock research with technical analysis, sentiment, risk metrics, and model-based forecasting.',
  },
};

export default function Home() {
  return <HomeClient />;
}
