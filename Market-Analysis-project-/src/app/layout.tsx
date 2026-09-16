import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutWrapper } from './layout-wrapper';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@/index.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Stock Vanta | AI-Powered Stock Research',
    template: '%s | Stock Vanta',
  },
  description: 'AI-powered stock research and decision intelligence with technical analysis, sentiment, forecasting, market opportunities, volatility insights and explainable stock signals.',
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
    title: 'Stock Vanta | AI-Powered Stock Research',
    description: 'AI-powered stock research and decision intelligence with technical analysis, sentiment, forecasting, market opportunities, volatility insights and explainable stock signals.',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Stock Vanta',
      },
    ],
    type: 'website',
    siteName: 'Stock Vanta',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Vanta | AI-Powered Stock Research',
    description: 'AI-powered stock research and decision intelligence with technical analysis, sentiment, forecasting, market opportunities, volatility insights and explainable stock signals.',
    images: ['/icon-512.png'],
  },
  metadataBase: new URL('https://stockvanta.vercel.app'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
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
