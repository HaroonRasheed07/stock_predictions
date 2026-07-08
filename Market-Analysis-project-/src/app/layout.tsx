import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutWrapper } from './layout-wrapper';
import { Analytics } from '@vercel/analytics/next';
import '@/index.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Driven - Market Intelligence & Predictive Analytics',
  description: 'Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting',
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
