import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getStockInfo } from '@/lib/stock-allowlist';
import { getHomeData } from '@/lib/home-data';
import { StockSearch } from '@/components/common/StockSearch';
import { MarketStrip } from '@/components/home/MarketStrip';
import { HeroBriefCard } from '@/components/home/HeroBriefCard';
import { FeatureBar } from '@/components/home/FeatureBar';
import { MarketRead } from '@/components/home/MarketRead';
import { DisagreementSection } from '@/components/home/DisagreementSection';
import { ScanTabs } from '@/components/home/ScanTabs';
import { Heatmap } from '@/components/home/Heatmap';
import { Explorer } from '@/components/home/Explorer';
import { WatchlistSection } from '@/components/home/WatchlistSection';
import { LearnTeasers } from '@/components/home/LearnTeasers';
import { TrustStrip } from '@/components/home/TrustStrip';

/** ISR — snapshot refreshed every 10 minutes; stale copy keeps serving meanwhile. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: {
    absolute: 'StockVantex – Free AI Stock Analysis: Technical, Sentiment & Forecast',
  },
  description:
    'Evidence-based stock research: technical signals, news sentiment, a 10-day model outlook, and risk — connected in one brief for every stock.',
  alternates: { canonical: SITE_URL },
  keywords: [
    'stock research',
    'technical analysis',
    'stock sentiment',
    'AI forecasting',
    'risk assessment',
    'research brief',
    'market intelligence',
  ],
  openGraph: {
    images: ['/icon-512.png'],
    title: `${SITE_NAME} – Evidence-Based Stock Research & Market Intelligence`,
    description:
      'Technical signals, news sentiment, a 10-day model outlook, and risk — connected in one Research Brief.',
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    images: ['/icon-512.png'],
    card: 'summary_large_image',
    title: `${SITE_NAME} – Evidence-Based Stock Research`,
    description:
      'Technical signals, news sentiment, a 10-day model outlook, and risk — connected in one Research Brief.',
  },
};

const POPULAR_BRIEFS = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL'];

export default async function Home() {
  const home = await getHomeData();

  return (
    <>
      {/* 1b. Market strip — indices, status, freshness */}
      <MarketStrip
        indexes={home.indexes}
        status={home.status}
        updatedMinutesAgo={home.updatedMinutesAgo}
        indicesDelayed={home.indicesDelayed}
      />

      {/* 2. Hero — heading, primary search, brief card + price chart */}
      <section id="analyze" aria-labelledby="hero-heading" className="container mx-auto px-4 pt-8 md:pt-12">
        <div className="max-w-3xl">
          <h1 id="hero-heading" className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
            StockVantex: evidence-based stock research
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Technical signals, news sentiment, a 10-day model outlook, and risk — connected in one Research
            Brief for every stock.
          </p>
        </div>

        <div className="mt-5 max-w-xl">
          <StockSearch
            inputId="hero-search"
            label="Analyze a stock by ticker or company"
            placeholder="Analyze a stock — ticker or company name…"
          />
        </div>

        <div className="mt-6">
          <HeroBriefCard
            hero={home.hero}
            chips={home.chips}
            updatedMinutesAgo={home.updatedMinutesAgo}
          />
        </div>
      </section>

      {/* 3. Feature bar */}
      <FeatureBar />

      {/* 4. Today's market read */}
      <MarketRead
        breadth={home.breadth}
        discoverAvailable={home.discoverAvailable}
        updatedMinutesAgo={home.updatedMinutesAgo}
      />

      {/* 5. Disagreement cards */}
      <DisagreementSection
        cards={home.disagreements}
        modelAvailable={home.modelAvailable}
        discoverAvailable={home.discoverAvailable}
      />

      {/* 6. Scan tabs */}
      <ScanTabs scan={home.scan} discoverAvailable={home.discoverAvailable} />

      {/* 7. Heatmap + browse-all directory link */}
      <Heatmap stocks={home.discover} available={home.discoverAvailable} />
      <section aria-label="Stock directory" className="container mx-auto -mt-4 pb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/stocks"
            aria-label="Browse all stocks in the research directory"
            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Browse all stocks
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wide">Popular briefs:</span>
            {POPULAR_BRIEFS.map((sym) => {
              const info = getStockInfo(sym);
              if (!info) return null;
              return (
                <Link
                  key={sym}
                  href={`/stocks/${info.symbol.toLowerCase()}`}
                  className="font-medium transition-colors hover:text-primary"
                >
                  {info.symbol}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Four-feature explorer */}
      <Explorer bundle={home.hero} />

      {/* 9. Watchlist */}
      <WatchlistSection />

      {/* 10/11. Learn teasers + trust framing (footer follows from the layout) */}
      <LearnTeasers />
      <TrustStrip />
    </>
  );
}
