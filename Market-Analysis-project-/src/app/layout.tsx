import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutWrapper } from './layout-wrapper';
import { Analytics } from '@vercel/analytics/next';
import '@/index.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Vanta — AI-Driven Market Intelligence',
  description: 'Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting',
  icons: {
    icon: '/logo.png',
  },
  openGraph: {
    title: 'Stock Vanta — AI-Driven Market Intelligence',
    description: 'Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Stock Vanta',
      },
    ],
    type: 'website',
    siteName: 'Stock Vanta',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Vanta — AI-Driven Market Intelligence',
    description: 'Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting',
    images: ['/logo.png'],
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
          </TooltipProvider>
        </div>
      </body>
    </html>
  );
}
