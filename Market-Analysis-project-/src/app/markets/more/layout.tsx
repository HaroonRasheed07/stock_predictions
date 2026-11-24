import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'More',
  robots: 'noindex, follow',
  alternates: { canonical: `${SITE_URL}/markets/more` },
};

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
