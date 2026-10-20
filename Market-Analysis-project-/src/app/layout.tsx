import { Inter, Bricolage_Grotesque, Figtree } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutWrapper } from './layout-wrapper';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AnalyticsConsent } from '@/components/common/AnalyticsConsent';
import { OrganizationJsonLd, WebsiteJsonLd } from '@/components/seo/StructuredData';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SEO_INDEXING_ENABLED } from '@/lib/seo';
import '@/index.css';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} | Evidence-Based Stock Research`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  robots: SEO_INDEXING_ENABLED ? 'index, follow' : 'noindex, nofollow',
  openGraph: {
    title: `${SITE_NAME} | Evidence-Based Stock Research`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og-cover.png',
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
    type: 'website',
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Evidence-Based Stock Research`,
    description: SITE_DESCRIPTION,
    images: ['/og-cover.png'],
  },
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} ${figtree.variable}`}
    >
      <head>
        {/* Workaround for vercel/next.js#62332: next/font preloads are not
            emitted, so the latin subsets are preloaded manually (content-hashed
            filenames from the font pipeline). */}
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/_next/static/media/e4af272ccee01ff0-s.p.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/_next/static/media/9d5a263311222317-s.p.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/_next/static/media/de42cfb9a3b980ae-s.p.woff2" />
        {/* Pre-paint theme: stored choice wins; otherwise follow the system
            setting before first paint (FOUC-free). Mirrors the zustand
            persist shape stored under 'insightforge-theme'. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var dark=true;try{var raw=localStorage.getItem('insightforge-theme');var t=raw?(JSON.parse(raw).state||{}).theme:null;if(t==='light'||t==='dark'){dark=t==='dark';}else{dark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:true;}}catch(e){try{dark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:true;}catch(e2){dark=true;}}document.documentElement.classList.toggle('dark',dark);try{if(localStorage.getItem('sv-analytics-consent')||(navigator.globalPrivacyControl===true)){document.documentElement.setAttribute('data-sv-hide-consent','');}}catch(e3){}})();",
          }}
        />
        <OrganizationJsonLd />
        <WebsiteJsonLd />
      </head>
      <body>
        <div>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AnalyticsConsent />
            <LayoutWrapper>{children}</LayoutWrapper>
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </div>
      </body>
    </html>
  );
}
