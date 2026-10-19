import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getStockInfo } from '@/lib/stock-allowlist';
import {
  fetchHomeIntelligence,
  fetchMarketStatus,
  fetchDiscoverScanAll,
  fetchIndicators,
  fetchForecast,
  fetchMarketOverview,
  type HomeIntelligence,
  type MarketStatusResponse,
  type MarketOverviewResponse,
  type DiscoverStock,
  type IndicatorsResponse,
  type ForecastResponse,
} from '@/lib/api';
import {
  buildMarketRead,
  findSignalConflicts,
  findBiggestChanges,
  biggestMovers,
  sectorGroups,
  updatedAgoLabel,
} from '@/lib/home-insights';
import {
  MarketStrip,
  HeroBriefCard,
  MarketReadSection,
  SignalConflicts,
  BiggestChanges,
  SectorGrid,
  MoversGrid,
  LearnStrip,
  HowItWorks,
  TrustStrip,
  FinalCta,
} from '@/components/home/sections';
import { HomeAnalytics, HomeHeroSearch, WatchlistSection } from '@/components/home/interactive';

/** Regenerate the dashboard every 10 minutes; stale content is kept if a
 *  refresh fails — sections fall back to honest "unavailable" notes. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Know What the Signals Say. Understand Why.` },
  description: 'Evidence-based stock research combining technical analysis, news sentiment, LSTM forecasting, and risk assessment into one Research Brief. See the full picture before deciding.',
  alternates: { canonical: SITE_URL },
  keywords: ['stock research', 'technical analysis', 'stock sentiment', 'AI forecasting', 'risk assessment', 'research brief', 'market intelligence'],
  openGraph: {
    images: ['/icon-512.png'],
    title: `${SITE_NAME} — Evidence-Based Stock Research & Market Intelligence`,
    description: 'Technical analysis, news sentiment, AI forecasting, and risk assessment — connected in one Research Brief.',
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    images: ['/icon-512.png'],
    card: 'summary_large_image',
    title: `${SITE_NAME} — Evidence-Based Stock Research`,
    description: 'Technical analysis, news sentiment, AI forecasting, and risk assessment — connected in one Research Brief.',
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

/** Universe scanned for the market read / conflicts / changes / sectors /
 *  movers sections. Every ticker resolves through the live scan endpoint. */
const HOME_SCAN_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA',
  'META', 'AMD', 'JPM', 'XOM', 'JNJ', 'WMT',
];

/** Tickers that get a read-only model-path direction for the conflicts
 *  section (short period for speed; forecast UI is untouched). */
const CONFLICT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'GOOGL'];

const INDEX_TILES = [
  { ticker: '^GSPC', name: 'S&P 500' },
  { ticker: '^IXIC', name: 'Nasdaq' },
  { ticker: '^DJI', name: 'Dow Jones' },
  { ticker: '^VIX', name: 'VIX' },
];

/** Never let one failed endpoint take down the page — return null instead. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

interface HomeData {
  status: MarketStatusResponse | null;
  intel: HomeIntelligence | null;
  indices: Array<MarketOverviewResponse | null>;
  scanned: DiscoverStock[];
  indicators: Record<string, IndicatorsResponse | null>;
  forecasts: Record<string, ForecastResponse | null>;
  scanUpdatedAt?: number;
}

async function getHomeData(): Promise<HomeData> {
  const [status, intel, indices, scan, indicators, forecasts] = await Promise.all([
    safe(() => fetchMarketStatus()),
    safe(() => fetchHomeIntelligence()),
    Promise.all(INDEX_TILES.map((i) => safe(() => fetchMarketOverview(i.ticker, '1mo')))),
    safe(() => fetchDiscoverScanAll(HOME_SCAN_TICKERS, '1y')),
    Promise.all(HOME_SCAN_TICKERS.map((t) => safe(() => fetchIndicators(t, '1y')))),
    Promise.all(CONFLICT_TICKERS.map((t) => safe(() => fetchForecast(t, 10, '3mo')))),
  ]);

  const scannedMap: Record<string, DiscoverStock> = scan?.stocks ?? {};
  let scanned: DiscoverStock[] = Object.values(scannedMap);
  if (scanned.length === 0 && intel?.discover?.length) {
    scanned = intel.discover;
  }

  const indicatorsMap: Record<string, IndicatorsResponse | null> = {};
  HOME_SCAN_TICKERS.forEach((t, i) => { indicatorsMap[t] = indicators[i]; });
  const forecastsMap: Record<string, ForecastResponse | null> = {};
  CONFLICT_TICKERS.forEach((t, i) => { forecastsMap[t] = forecasts[i]; });

  return {
    status,
    intel,
    indices,
    scanned,
    indicators: indicatorsMap,
    forecasts: forecastsMap,
    scanUpdatedAt: scan?._cache_meta?.updated_at,
  };
}

export default async function Home() {
  const { status, intel, indices, scanned, indicators, forecasts, scanUpdatedAt } = await getHomeData();

  const conflicts = findSignalConflicts(scanned, forecasts);
  const read = buildMarketRead(scanned, indicators, conflicts.length);
  const changes = findBiggestChanges(scanned, indicators, 8);
  const movers =
    scanned.length > 0
      ? biggestMovers(scanned, 6)
      : (intel?.topStocks ?? [])
          .slice(0, 6)
          .map((s) => ({ ticker: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent }));
  const groups = sectorGroups(scanned);

  const statusLabel = status?.label
    ? `${status.label} · ET`
    : intel
      ? `Market ${intel.marketStatus}`
      : null;
  const open = status ? status.status === 'open' : null;
  const updatedLabel = updatedAgoLabel(scanUpdatedAt, Date.now());

  const popular = POPULAR_SYMBOLS.map((s) => getStockInfo(s)).filter(Boolean);

  return (
    <div className="min-h-screen">
      <HomeAnalytics />

      {/* ── Market strip: status + major indices ─────────────────────────── */}
      <MarketStrip
        tiles={INDEX_TILES.map((t, i) => ({ ...t, overview: indices[i] }))}
        statusLabel={statusLabel}
        open={open}
        updatedLabel={updatedLabel}
      />

      {/* ── Hero: headline + live search + sample brief ──────────────────── */}
      <section className="relative overflow-hidden gradient-hero py-12 md:py-16 lg:py-20" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" aria-hidden="true" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-3 text-center lg:text-left">
              <h1 id="hero-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-[1.15] tracking-tight">
                Know what the signals say.{' '}
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Understand why.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-foreground/70 mb-7 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                StockVantex connects technical analysis, news sentiment, a 10-trading-day model forecast, and risk
                assessment into one evidence-based research brief so you can see the full picture behind every stock.
              </p>

              <HomeHeroSearch />

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mt-6">
                <Link
                  href="/markets/brief"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-7 py-3 text-base font-medium text-white hover:opacity-90 transition-opacity"
                >
                  View Research Brief
                </Link>
                <Link
                  href="/learn"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 px-7 py-3 text-base font-medium hover:bg-primary/10 transition-colors"
                >
                  Learn the Concepts
                </Link>
              </div>
            </div>

            <div className="lg:col-span-2 w-full">
              <HeroBriefCard brief={intel ? { selectedStock: intel.selectedStock } : null} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Research dashboard sections ──────────────────────────────────── */}
      <MarketReadSection read={read} />
      <SignalConflicts items={conflicts} />
      <BiggestChanges items={changes} />
      <WatchlistSection />
      <SectorGrid groups={groups} />
      <MoversGrid rows={movers} />
      <LearnStrip />
      <HowItWorks />
      <TrustStrip />
      <FinalCta />

      {/* ── Popular stock research + learn links (server-rendered) ───────── */}
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
    </div>
  );
}
