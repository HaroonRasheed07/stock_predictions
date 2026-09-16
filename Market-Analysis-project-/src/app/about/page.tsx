import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { AboutClient } from './AboutClient';

export const metadata: Metadata = {
  title: { absolute: 'About Stock Vanta — AI-Powered Market Intelligence' },
  description: `Learn about ${SITE_NAME}, an AI-powered stock research platform that combines technical analysis, sentiment, forecasting, and risk assessment into evidence-based stock briefs.`,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description: `Learn about ${SITE_NAME}, an AI-powered stock research platform combining technical analysis, sentiment, and forecasting.`,
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <>
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />
        </div>
      </div>
      <AboutClient />
    </>
  );
}
