import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutWrapper } from './layout-wrapper';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { OrganizationJsonLd, WebsiteJsonLd } from '@/components/seo/StructuredData';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SEO_INDEXING_ENABLED } from '@/lib/seo';
import '@/index.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} | AI-Powered Stock Research`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  robots: SEO_INDEXING_ENABLED ? 'index, follow' : 'noindex, nofollow',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: `${SITE_NAME} | AI-Powered Stock Research`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
    type: 'website',
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | AI-Powered Stock Research`,
    description: SITE_DESCRIPTION,
    images: ['/icon-512.png'],
  },
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
      </head>
      <body>
        <div>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <LayoutWrapper>{children}</LayoutWrapper>
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </div>
      </body>
    </html>
  );
}
