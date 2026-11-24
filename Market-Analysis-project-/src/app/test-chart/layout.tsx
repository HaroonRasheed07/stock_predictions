import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Internal Test Chart | ${SITE_NAME}` },
  robots: { index: false, follow: false },
};

export default function TestChartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
