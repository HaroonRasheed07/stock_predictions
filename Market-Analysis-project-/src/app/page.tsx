import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getStockInfo } from '@/lib/stock-allowlist';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Understand the Stock. Not Just the Price.` },
  description: 'AI-powered stock research combining technical analysis, news sentiment, model-based forecasting, and risk insights. Explore the full picture before deciding.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    images: ['/icon-512.png'],
    title: `${SITE_NAME} — AI Stock Research & Market Intelligence`,
    description: 'Technical analysis, news sentiment, AI forecasting, and risk insights — all in one stock research experience.',
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    images: ['/icon-512.png'],
    card: 'summary_large_image',
    title: `${SITE_NAME} — AI Stock Research & Market Intelligence`,
    description: 'Technical analysis, news sentiment, AI forecasting, and risk insights — all in one stock research experience.',
  },
};

const POPULAR_SYMBOLS = ['aapl', 'msft', 'nvda', 'amzn', 'tsla', 'googl'];

const LEARN_LINKS = [
  { href: '/learn/how-to-analyze-a-stock', label: 'How to analyze a stock' },
  { href: '/learn/what-is-technical-analysis', label: 'Technical analysis basics' },
  { href: '/learn/what-is-rsi', label: 'RSI explained' },
  { href: '/learn/what-is-stock-sentiment', label: 'News sentiment explained' },
  { href: '/learn/how-lstm-forecasting-works', label: 'How AI forecasting works' },
  { href: '/learn', label: 'All guides' },
];

export default function Home() {
  const popular = POPULAR_SYMBOLS.map((s) => getStockInfo(s)).filter(Boolean);

  return (
    <>
      <HomeClient />

      <section aria-labelledby="popular-research" className="container mx-auto px-4 pb-10 pt-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 md:p-6">
          <h2 id="popular-research" className="text-lg font-semibold mb-1">Popular stock research</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Server-rendered research snapshots with price, technicals, sentiment, risk, and model forecasts.
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {popular.map(
              (info) =>
                info && (
                  <Link
                    key={info.symbol}
                    href={`/stocks/${info.symbol.toLowerCase()}`}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm hover:border-primary/20 hover:text-primary transition-all"
                  >
                    <span className="font-semibold">{info.symbol}</span>
                    <span className="text-muted-foreground ml-2">{info.name}</span>
                  </Link>
                )
            )}
            <Link
              href="/stocks"
              aria-label="Browse all stocks in the research directory"
              className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-all"
            >
              Browse all stocks →
            </Link>
          </div>

          <h2 className="text-lg font-semibold mb-1">Learn the concepts behind the signals</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Clear, jargon-free guides on indicators, sentiment, risk, and model forecasting.
          </p>
          <div className="flex flex-wrap gap-2">
            {LEARN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/methodology"
              className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
            >
              Our methodology
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
