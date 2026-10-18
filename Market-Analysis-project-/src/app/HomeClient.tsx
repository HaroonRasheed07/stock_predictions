'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Brain, Shield,
  ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Sparkles,
  Eye, LineChart,
  ArrowRight, Star, Newspaper,
  Compass, Layers, BookOpen, Clock, Search,
} from 'lucide-react';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { fetchHomeTicker, fetchHomeBrief, fetchHomeDiscover } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatSentimentLabel } from '@/lib/sentiment';
import { toUrlSymbol } from '@/lib/ticker-routing';
import { TickerLogo } from '@/components/common/TickerLogo';
import { StockSearch } from '@/components/common/StockSearch';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'GOOGL'];

const WHAT_YOU_GET = [
  { icon: LineChart, label: 'Technical signals', href: '/markets/stock/technical' },
  { icon: Newspaper, label: 'News sentiment', href: '/markets/stock/sentiment' },
  { icon: Brain, label: '10-day model forecast', href: '/markets/stock/forecast' },
  { icon: Shield, label: 'Risk & volatility', href: '/markets/brief' },
  { icon: Compass, label: 'Discover screeners', href: '/markets/discover' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNAL BADGE — Visual indicator for Buy/Hold/Sell signals
   ═══════════════════════════════════════════════════════════════════════════ */

function SignalBadge({ signal, compact = false }: { signal: string; compact?: boolean }) {
  const config: Record<string, { bg: string; icon: any; ariaLabel: string }> = {
    'Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp, ariaLabel: 'Buy signal' },
    'Strong Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp, ariaLabel: 'Strong buy signal' },
    'Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown, ariaLabel: 'Sell signal' },
    'Strong Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown, ariaLabel: 'Strong sell signal' },
    'Hold': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus, ariaLabel: 'Hold signal' },
  };
  const c = config[signal] || config['Hold'];
  const Icon = c.icon;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        c.bg,
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      )}
      role="status"
      aria-label={c.ariaLabel}
    >
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      {signal}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PILLAR ROW — Single evidence pillar in the brief preview
   ═══════════════════════════════════════════════════════════════════════════ */

function PillarRow({ icon: Icon, label, reading, detail, color }: {
  icon: any;
  label: string;
  reading: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-b-0">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold mt-0.5">{reading}</p>
      </div>
      <p className="text-xs text-muted-foreground text-right max-w-[45%] leading-relaxed hidden sm:block">{detail}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOMEPAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Home() {
  const router = useRouter();
  const { setSelectedTicker } = useStockStore();
  const { watchlist } = useWatchlistStore();

  const { data: tickerData } = useQuery({
    queryKey: ['home-ticker'],
    queryFn: fetchHomeTicker,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 30000;
      return false;
    },
  });

  const { data: briefData } = useQuery({
    queryKey: ['home-brief'],
    queryFn: fetchHomeBrief,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 30000;
      return false;
    },
  });

  const { data: discoverData } = useQuery({
    queryKey: ['home-discover'],
    queryFn: fetchHomeDiscover,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 30000;
      return false;
    },
  });

  useEffect(() => {
    trackEvent('homepage_view');
  }, []);

  const goToStock = (ticker: string, source: string = 'direct') => {
    trackEvent('stock_selected', { ticker, source });
    setSelectedTicker(ticker);
    router.push(`/stocks/${toUrlSymbol(ticker)}`);
  };

  const goToBrief = (ticker: string) => {
    trackEvent('brief_opened', { ticker });
    setSelectedTicker(ticker);
    router.push('/markets/brief');
  };

  const topStocks = tickerData?.topStocks || [];
  const selected = briefData?.selectedStock;
  const discover = discoverData?.discover || [];
  const marketStatus = tickerData?.marketStatus || 'Unknown';

  /* ─────────────────────────────────────────────────────────────────────────
     FEATURE CARDS DATA — "Everything you need to research a stock"
     ───────────────────────────────────────────────────────────────────────── */

  const features = [
    {
      icon: LineChart,
      title: 'Technical Analysis',
      description: 'RSI, MACD, Bollinger Bands, moving averages, and ATR — with Buy/Hold/Sell readings across timeframes.',
      indicators: ['RSI', 'MACD', 'Bollinger Bands', 'Moving Averages', 'ATR'],
      link: '/markets/stock/technical',
      color: 'from-blue-500/20 to-blue-600/10 dark:from-blue-500/15 dark:to-blue-600/5',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Newspaper,
      title: 'News Sentiment',
      description: 'News headlines scored by an NLP model as positive, neutral, or negative — tracked across sources and time.',
      indicators: ['Headline Scoring', 'Source Tracking', 'Trend Tracking', 'Catalyst Detection'],
      link: '/markets/stock/sentiment',
      color: 'from-purple-500/20 to-purple-600/10 dark:from-purple-500/15 dark:to-purple-600/5',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: Brain,
      title: 'AI Forecasting',
      description: 'LSTM point projections over a fixed 10-trading-day horizon, with the historical fit shown next to every forecast.',
      indicators: ['10-Trading-Day Horizon', 'Historical Fit', 'Recursive Projection', 'Business-Day Dates'],
      link: '/markets/stock/forecast',
      color: 'from-emerald-500/20 to-emerald-600/10 dark:from-emerald-500/15 dark:to-emerald-600/5',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Shield,
      title: 'Risk Assessment',
      description: 'Volatility, drawdown, and multi-factor risk assessment to understand downside exposure.',
      indicators: ['Volatility', 'Drawdown', 'ATR', 'Risk Score'],
      link: '/markets/brief',
      color: 'from-amber-500/20 to-amber-600/10 dark:from-amber-500/15 dark:to-amber-600/5',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     HOW IT WORKS STEPS
     ───────────────────────────────────────────────────────────────────────── */

  const howItWorks = [
    {
      step: '1',
      title: 'Search for a stock',
      description: 'Enter any ticker symbol or company name. We support hundreds of stocks and ETFs.',
    },
    {
      step: '2',
      title: 'Review multiple perspectives',
      description: 'See technical signals, news sentiment, model forecasts, and risk — each with its timeframe and data source clearly labeled.',
    },
    {
      step: '3',
      title: 'Inform your own research',
      description: 'Different timeframes and methods can disagree. Use the combined evidence to understand the full picture, not just one number.',
    },
  ];

  return (
    <div className="min-h-screen">

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION A — HERO
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden gradient-hero py-12 md:py-20 lg:py-24" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" aria-hidden="true" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Market status pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  marketStatus === 'Open' ? 'bg-success' : 'bg-muted-foreground'
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  marketStatus === 'Open' ? 'bg-success' : 'bg-muted-foreground'
                )} />
              </span>
              <span className="text-sm font-medium">
                Market {marketStatus}
              </span>
            </div>

            <h1 id="hero-heading" className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-[1.15] tracking-tight">
              Know what the signals say.{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Understand why.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              StockVantex connects technical analysis, news sentiment, a 10-trading-day model forecast, and risk assessment into one evidence-based research brief so you can see the full picture behind every stock.
            </p>

            <div className="max-w-xl mx-auto mb-5">
              <StockSearch
                label="Search stocks"
                placeholder="Search any stock ticker or company…"
                className="[&_input]:h-14 [&_input]:rounded-2xl [&_input]:bg-background/80 [&_input]:border-border/60 [&_input]:shadow-lg"
                onSelect={(t) => goToStock(t, 'search')}
              />
            </div>

            {/* What you get — first-screen product hierarchy */}
            <nav aria-label="Research tools" className="flex flex-wrap items-center justify-center gap-2 mb-5">
              {WHAT_YOU_GET.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Popular ticker shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Popular:</span>
              {POPULAR_TICKERS.map((t) => (
                <button
                  key={t}
                  onClick={() => goToStock(t, 'popular')}
                  className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                  aria-label={`Analyze ${t}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link href="/markets/brief">
                <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  View Research Brief
                </Button>
              </Link>
              <Link href="/learn">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 gap-2 w-full sm:w-auto">
                  <BookOpen className="h-4 w-4" />
                  Learn the Concepts
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION B — LIVE TICKER BAR (Market Overview)
          ═══════════════════════════════════════════════════════════════════ */}
      {topStocks.length > 0 && (
        <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-3 overflow-hidden" role="region" aria-label="Market overview ticker">
          <div className="flex space-x-8 whitespace-nowrap ticker-scroll">
            {[...topStocks.slice(0, 8), ...topStocks.slice(0, 8)].map((stock, idx) => (
              <button
                key={`${stock.symbol}-${idx}`}
                onClick={() => goToStock(stock.symbol, 'ticker_strip')}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                aria-label={`${stock.symbol} at $${stock.price.toFixed(2)}, ${stock.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(stock.changePercent).toFixed(2)}%`}
              >
                <span className="font-semibold text-sm">{stock.symbol}</span>
                <span className="text-foreground/70 text-sm">${stock.price.toFixed(2)}</span>
                <span className={cn('text-sm font-medium flex items-center gap-0.5', stock.changePercent >= 0 ? 'text-success' : 'text-destructive')}>
                  {stock.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-1.5 px-4">
            
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION C — SEE THE COMPLETE PICTURE (Research Brief Preview)
          ═══════════════════════════════════════════════════════════════════ */}
      {selected ? (
        <section className="py-10 md:py-14" aria-labelledby="complete-picture-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-6">
              <h2 id="complete-picture-heading" className="text-2xl md:text-3xl font-bold mb-2">See the Complete Picture</h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm">
                Every stock gets a Research Brief that connects technical signals, sentiment, forecasting, and risk with each evidence source clearly labeled.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-border/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TickerLogo ticker={selected.ticker} size="lg" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{selected.ticker}</h3>
                          <SignalBadge signal={selected.signal} compact />
                        </div>
                        <p className="text-2xl font-bold tracking-tight mt-1">
                          ${selected.price.toFixed(2)}
                        </p>
                        <div className={cn(
                          'flex items-center gap-1 text-sm font-medium mt-0.5',
                          selected.changePercent >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {selected.changePercent >= 0
                            ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
                          {selected.changePercent >= 0 ? '+' : ''}{selected.change.toFixed(2)} ({selected.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Score</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        selected.score >= 70 ? 'text-success' : selected.score >= 40 ? 'text-warning' : 'text-destructive'
                      )}>
                        {selected.score.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/100</p>
                    </div>
                  </div>
                </div>

                {/* Four Pillars */}
                <div className="px-5 md:px-6 py-2">
                  <PillarRow
                    icon={LineChart}
                    label="Technical"
                    reading={selected.signal}
                    detail="RSI, MACD, moving averages, and pattern analysis"
                    color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />
                  <PillarRow
                    icon={Newspaper}
                    label="Sentiment"
                    reading={formatSentimentLabel(selected.sentiment || '', selected.sentiment_status)}
                    detail="AI-scored news articles across multiple sources"
                    color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  />
                  <PillarRow
                    icon={Brain}
                    label="Forecast"
                    reading="10-trading-day model outlook"
                    detail="LSTM point estimates — not a guarantee"
                    color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  />
                  <PillarRow
                    icon={Shield}
                    label="Risk"
                    reading={`${selected.risk} · ${selected.volatility.toFixed(1)}% vol`}
                    detail="Volatility, drawdown, and multi-factor scoring"
                    color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  />
                </div>

                {/* Footer */}
                <div className="px-5 md:px-6 py-4 border-t border-border/40 bg-muted/20">
                  <div className="flex items-start gap-2 mb-3">
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Signals can disagree — and that&apos;s informative. Technical indicators, sentiment, and forecasts use different data over different time horizons. Divergence reveals a stock&apos;s complexity.
                    </p>
                  </div>
                  <button
                    onClick={() => goToBrief(selected.ticker)}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-primary font-medium hover:gap-2.5 transition-all group"
                    aria-label={`View full Research Brief for ${selected.ticker}`}
                  >
                    View Full Research Brief
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : briefData === undefined ? (
        <section className="py-10 md:py-14" aria-labelledby="complete-picture-loading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-6">
              <h2 id="complete-picture-loading" className="text-2xl md:text-3xl font-bold mb-2">See the Complete Picture</h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm">Loading real-time analysis…</p>
            </div>
            <div className="max-w-2xl mx-auto">
              <div className="h-72 rounded-2xl bg-muted/30 animate-pulse" />
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION D — EVERYTHING YOU NEED TO RESEARCH A STOCK
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="features-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
              <Layers className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="text-xs font-medium text-primary">Research Toolkit</span>
            </div>
            <h2 id="features-heading" className="text-2xl md:text-3xl font-bold mb-2">Everything You Need to Research a Stock</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Four analysis pillars, each using different data and methods. Together they reveal what no single metric can.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {features.map((feature) => (
              <Link key={feature.title} href={feature.link} className="group">
                <div className="rounded-2xl border border-border/60 bg-card p-5 h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 flex flex-col">
                  <div className={cn(
                    'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 transition-transform group-hover:scale-105',
                    feature.color
                  )}>
                    <feature.icon className={cn('h-5 w-5', feature.iconColor)} aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feature.description}</p>
                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {feature.indicators.map((ind) => (
                        <span key={ind} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          {ind}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION E — STOCKS WORTH INVESTIGATING (Discover Preview)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="discover-heading">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="discover-heading" className="text-2xl md:text-3xl font-bold">Stocks Worth Investigating</h2>
              <p className="text-muted-foreground mt-1 text-sm">Surfaced by screening for notable technical signals, momentum, and risk conditions.</p>
            </div>
            <Link href="/markets/discover" className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
              See All <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {discoverData === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : discover.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discover.slice(0, 6).map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => goToStock(stock.ticker, 'discover')}
                  className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-border/80 active:scale-[0.99] group"
                  aria-label={`Analyze ${stock.ticker}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <TickerLogo ticker={stock.ticker} size="md" />
                      <div>
                        <p className="text-sm font-semibold">{stock.ticker}</p>
                        <p className="text-lg font-bold">${stock.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-sm font-semibold',
                        stock.changePercent > 0 ? 'text-success' : stock.changePercent < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </p>
                      <SignalBadge signal={stock.signal} compact />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Technical</p>
                      <p className={cn(
                        'text-xs font-semibold mt-0.5',
                        stock.technical?.includes('Bullish') ? 'text-success' :
                        stock.technical?.includes('Bearish') ? 'text-destructive' :
                        'text-muted-foreground'
                      )}>{stock.technical || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Risk</p>
                      <p className={cn(
                        'text-xs font-semibold mt-0.5',
                        stock.risk === 'High' ? 'text-destructive' : stock.risk === 'Low' ? 'text-success' : 'text-warning'
                      )}>{stock.risk || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Score</p>
                      <p className={cn(
                        'text-xs font-semibold mt-0.5',
                        (stock.score || 0) >= 70 ? 'text-success' : (stock.score || 0) >= 40 ? 'text-warning' : 'text-destructive'
                      )}>{stock.score?.toFixed(0) || '—'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-pulse" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Building your discovery universe…</p>
              <p className="text-xs text-muted-foreground/70 mt-1">This updates as fresh data arrives.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION F — WATCHLIST PREVIEW
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="watchlist-heading">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="watchlist-heading" className="text-xl font-bold">Your Watchlist</h2>
                  <p className="text-sm text-muted-foreground">Track and revisit stocks you&apos;re researching.</p>
                </div>
              </div>

              {watchlist.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {watchlist.slice(0, 8).map((ticker) => (
                    <button
                      key={ticker}
                      onClick={() => goToStock(ticker, 'watchlist')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm hover:border-primary/20 hover:text-primary transition-all"
                    >
                      <TickerLogo ticker={ticker} size="sm" />
                      <span className="font-semibold">{ticker}</span>
                    </button>
                  ))}
                  {watchlist.length > 8 && (
                    <span className="inline-flex items-center px-3 py-2 text-sm text-muted-foreground">
                      +{watchlist.length - 8} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Your watchlist is empty. Search for a stock above and add it to your watchlist.
                </p>
              )}

              <Link href="/markets/stock/watchlist">
                <Button variant="outline" className="border-primary/30 hover:bg-primary/10 gap-2">
                  <Star className="h-4 w-4" />
                  {watchlist.length > 0 ? 'Manage Watchlist' : 'Set Up Watchlist'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION G — HOW TO USE STOCKVANTEX
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="howto-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 id="howto-heading" className="text-2xl md:text-3xl font-bold mb-2">How to Use StockVantex</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Research in three steps. No account needed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="text-base font-semibold mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 max-w-2xl mx-auto">
            <div className="rounded-xl bg-muted/50 border border-border/40 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground/80">Signals can disagree — that&apos;s informative</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Technical indicators, sentiment, and forecasts look at different data over different time horizons.
                Divergence between signals is expected and reveals the stock&apos;s complexity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION G2 — TRUST & TRANSPARENCY STRIP
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="trust-heading">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h2 id="trust-heading" className="text-xl md:text-2xl font-bold">Built for Research, Not Recommendations</h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm mt-1">
                Every page states its data source, timeframe, and limits — so you can weigh the evidence yourself.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                <Clock className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
                <h3 className="text-sm font-semibold mb-1">Transparent data</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Prices come from public market data via Yahoo Finance and may be delayed or cached. Each view labels its timeframe.
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                <Eye className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
                <h3 className="text-sm font-semibold mb-1">Honest methodology</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Forecasts are point estimates from an LSTM model. Historical fit percentages are MAPE-based and shown for transparency — not as promises.
                </p>
                <Link href="/learn/how-lstm-forecasting-works" className="text-xs text-primary hover:underline inline-block mt-2">
                  How the forecast works
                </Link>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                <Shield className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
                <h3 className="text-sm font-semibold mb-1">No investment advice</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  StockVantex is an educational research tool. Nothing on this site is a recommendation to buy or sell.
                </p>
                <Link href="/disclaimer" className="text-xs text-primary hover:underline inline-block mt-2">
                  Financial disclaimer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION H — FINAL CTA & CLOSING
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="final-cta-heading">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-6 md:p-10 text-center max-w-3xl mx-auto glow-primary">
            <h2 id="final-cta-heading" className="text-2xl md:text-3xl font-bold mb-3">
              Start Researching
            </h2>
            <p className="text-base text-muted-foreground mb-6 max-w-xl mx-auto">
              Search any ticker above, or open the stock directory to browse everything we cover.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/stocks">
                <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                  <Layers className="h-4 w-4" />
                  Browse Stock Directory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/learn">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 gap-2 w-full sm:w-auto">
                  <BookOpen className="h-4 w-4" />
                  Learn Investing Basics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
