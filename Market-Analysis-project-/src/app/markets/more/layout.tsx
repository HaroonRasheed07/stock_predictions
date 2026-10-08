import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'More',
  robots: 'noindex, follow',
};

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
