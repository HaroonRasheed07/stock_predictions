'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, BarChart3, Brain, Shield,
  Activity, ArrowUpRight, ArrowDownRight, Minus, Clock,
  Search, ChevronRight, AlertTriangle, Target, Sparkles,
  Layers, Eye, LineChart, PieChart,
  ArrowRight,
} from 'lucide-react';
import { useStockStore } from '@/store/stockStore';
import { fetchHomeTicker, fetchHomeBrief, fetchHomeDiscover, fetchDiscoverScan, fetchAssetSearch, AssetInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function HeroSearch({ onSelect }: { onSelect: (ticker: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchAssetSearch(q);
        setResults(data.slice(0, 8));
        setShowResults(true);
      } catch { setResults([]); }
    }, 300);
  }, []);

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search any stock ticker or company..."
          className="pl-12 h-14 text-base rounded-2xl bg-background/80 border-border/60 backdrop-blur-sm shadow-lg"
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.ticker}
              onClick={() => { onSelect(r.ticker); setQuery(''); setShowResults(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <TickerLogo ticker={r.ticker} size="sm" />
              <div>
                <p className="text-sm font-semibold">{r.ticker}</p>
                <p className="text-xs text-muted-foreground truncate">{r.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalBadge({ signal, compact = false }: { signal: string; compact?: boolean }) {
  const config: Record<string, { bg: string; icon: any }> = {
    'Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp },
    'Strong Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp },
    'Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown },
    'Strong Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown },
    'Hold': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus },
  };
  const c = config[signal] || config['Hold'];
  const Icon = c.icon;
  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full border font-semibold',
      c.bg,
      compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    )}>
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {signal}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { setSelectedTicker } = useStockStore();
  const prefersReduced = useReducedMotion();

  // ═══════════════════════════════════════════════════════════════════════
  // THREE INDEPENDENT QUERIES — start in parallel, resolve independently
  // ═══════════════════════════════════════════════════════════════════════

  // Query 1: Ticker (fastest — just top stocks + market status)
  const { data: tickerData } = useQuery({
    queryKey: ['home-ticker'],
    queryFn: fetchHomeTicker,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 8000;
      return false;
    },
  });

  // Query 2: Brief preview (independent — can be slower)
  const { data: briefData } = useQuery({
    queryKey: ['home-brief'],
    queryFn: fetchHomeBrief,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 8000;
      return false;
    },
  });

  // Query 3: Discover preview (independent — can be slower)
  const { data: discoverData } = useQuery({
    queryKey: ['home-discover'],
    queryFn: fetchHomeDiscover,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const meta = (query.state.data as any)?._cache_meta;
      if (!query.state.data || meta?.status === 'MISS' || meta?.is_stale) return 8000;
      return false;
    },
  });

  const goToStock = (ticker: string) => {
    setSelectedTicker(ticker);
    router.push('/markets/stock');
  };

  const topStocks = tickerData?.topStocks || [];
  const selected = briefData?.selectedStock;
  const discover = discoverData?.discover || [];
  const marketStatus = tickerData?.marketStatus || 'Unknown';

  // Query 3b: Enrich discover stocks with sentiment from discover/scan
  // Backend times out at 6+ tickers, so batch in groups of 5
  const discoverTickers = discover.slice(0, 6).map((s) => s.ticker);
  const batch1 = discoverTickers.slice(0, 5);
  const batch2 = discoverTickers.slice(5);
  const { data: scanData1 } = useQuery({
    queryKey: ['discover-sentiment', ...batch1],
    queryFn: () => fetchDiscoverScan(batch1, '1y'),
    enabled: batch1.length > 0,
    staleTime: 300000,
    gcTime: 600000,
  });
  const { data: scanData2 } = useQuery({
    queryKey: ['discover-sentiment', ...batch2],
    queryFn: () => fetchDiscoverScan(batch2, '1y'),
    enabled: batch2.length > 0,
    staleTime: 300000,
    gcTime: 600000,
  });

  const discoverWithSentiment = discover.map((stock) => {
    const scanStock = scanData1?.stocks?.[stock.ticker] || scanData2?.stocks?.[stock.ticker];
    return {
      ...stock,
      sentiment: stock.sentiment || scanStock?.sentiment || '',
    };
  });

  const evidenceSteps = [
    { icon: BarChart3, label: 'Technical', description: 'Indicators, momentum, and pattern recognition', link: '/markets/stock/technical' },
    { icon: Activity, label: 'Sentiment', description: 'News mood, social signals, and market context', link: '/markets/stock/sentiment' },
    { icon: Brain, label: 'Forecast', description: 'ML price projections with confidence intervals', link: '/markets/stock/forecast' },
    { icon: Shield, label: 'Risk', description: 'Volatility, drawdown, and downside exposure', link: '/markets/stock/technical' },
    { icon: Target, label: 'Decision', description: 'Evidence-scored trade confirmation', link: '/markets/brief' },
  ];

  const capabilities = [
    {
      icon: BarChart3,
      title: 'Multi-Layer Stock Brief',
      description: 'Signal, sentiment, catalysts, and risk in one concise brief.',
      link: '/markets/brief',
    },
    {
      icon: Search,
      title: 'Discover & Screen',
      description: 'Find opportunities across the market with smart filtering.',
      link: '/markets/discover',
    },
    {
      icon: LineChart,
      title: 'Technical Analysis',
      description: 'Real indicators, charts, and pattern recognition for equities.',
      link: '/markets/stock/technical',
    },
    {
      icon: Brain,
      title: 'Forecast Models',
      description: 'ML-based 10-day price projections with confidence bands.',
      link: '/markets/stock/forecast',
    },
    {
      icon: PieChart,
      title: 'Sentiment Analysis',
      description: 'News-driven sentiment scoring and mood tracking.',
      link: '/markets/stock/sentiment',
    },
    {
      icon: AlertTriangle,
      title: 'Risk Intelligence',
      description: 'Multi-factor risk assessment and real-time monitoring.',
      link: '/markets/stock/technical',
    },
  ];

  const trustPillars = [
    {
      icon: BarChart3,
      title: 'Real Market Data',
      description: 'All analysis is built on live and historical market data — not estimates.',
    },
    {
      icon: Layers,
      title: 'Multiple Evidence Layers',
      description: 'Technical, sentiment, forecast, and risk signals evaluated together.',
    },
    {
      icon: Eye,
      title: 'Explainable Analysis',
      description: 'Every brief tells you why — not just what the signal says.',
    },
    {
      icon: Clock,
      title: 'Timeframe Awareness',
      description: 'Signals are framed for short, medium, and long-term horizons.',
    },
  ];

  return (
    <div className="min-h-screen">

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO (instant render, ZERO data dependency)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden gradient-hero py-16 md:py-24 lg:py-28">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm font-medium">Live Market Data</span>
              <span className={cn(
                'text-xs ml-1 px-2 py-0.5 rounded-full font-medium',
                marketStatus === 'Open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
              )}>
                <Clock className="h-3 w-3 inline mr-1" />
                Market {marketStatus}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight">
              Research Stocks With Evidence,{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Not Guesswork.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-foreground/70 mb-8 max-w-2xl mx-auto">
              Every brief layers technical indicators, sentiment, forecast models, and risk so you can see the full picture before deciding.
            </p>

            <HeroSearch onSelect={goToStock} />

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link href="/markets/brief">
                <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  View Stock Brief
                </Button>
              </Link>
              <Link href="/markets/discover">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 gap-2 w-full sm:w-auto">
                  <Search className="h-4 w-4" />
                  Discover Stocks
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — LIVE TICKER BAR (loads independently from Query 1)
          ═══════════════════════════════════════════════════════════════════ */}
      {topStocks.length > 0 && (
        <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-3 overflow-hidden">
          <motion.div
            animate={prefersReduced ? undefined : { x: ['0%', '-50%'] }}
            transition={prefersReduced ? undefined : { duration: 30, repeat: Infinity, ease: 'linear' }}
            className="flex space-x-8 whitespace-nowrap"
          >
            {[...topStocks.slice(0, 8), ...topStocks.slice(0, 8)].map((stock, idx) => (
              <button
                key={`${stock.symbol}-${idx}`}
                onClick={() => goToStock(stock.symbol)}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <span className="font-semibold text-sm">{stock.symbol}</span>
                <span className="text-foreground/70 text-sm">${stock.price.toFixed(2)}</span>
                <span className={cn('text-sm font-medium', stock.changePercent >= 0 ? 'text-success' : 'text-destructive')}>
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </button>
            ))}
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — TODAY'S STOCK INTELLIGENCE (loads independently from Query 2)
          ═══════════════════════════════════════════════════════════════════ */}
      {selected ? (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Today&apos;s Stock Intelligence</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                A real snapshot from our engine not a recommendation, just an evidence layer.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl mx-auto"
            >
              <button
                onClick={() => goToStock(selected.ticker)}
                className="w-full text-left rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:shadow-lg hover:border-primary/20 active:scale-[0.99]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <TickerLogo ticker={selected.ticker} size="lg" />
                    <div>
                      <h3 className="text-xl font-bold">{selected.ticker}</h3>
                      <p className="text-2xl font-bold tracking-tight mt-1">
                        ${selected.price.toFixed(2)}
                      </p>
                      <div className={cn(
                        'flex items-center gap-1 text-sm font-medium mt-1',
                        selected.changePercent >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {selected.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {selected.changePercent >= 0 ? '+' : ''}{selected.change.toFixed(2)} ({selected.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <SignalBadge signal={selected.signal} />
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Shield className={cn('h-3.5 w-3.5', selected.risk === 'High' ? 'text-destructive' : selected.risk === 'Low' ? 'text-success' : 'text-warning')} />
                        <span className="text-muted-foreground">Risk:</span>
                        <span className={cn('font-medium', selected.risk === 'High' ? 'text-destructive' : selected.risk === 'Low' ? 'text-success' : 'text-warning')}>
                          {selected.risk}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Vol:</span>
                        <span className="font-medium">{selected.volatility.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Sentiment</p>
                    <p className={cn(
                      'text-xs font-semibold mt-0.5',
                      selected.sentiment?.includes('Positive') || selected.market_mood === 'Bullish' ? 'text-success' :
                      selected.sentiment?.includes('Negative') || selected.market_mood === 'Bearish' ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {selected.market_mood || selected.sentiment || '—'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Score</p>
                    <p className={cn(
                      'text-xs font-semibold mt-0.5',
                      selected.score >= 70 ? 'text-success' : selected.score >= 40 ? 'text-warning' : 'text-destructive'
                    )}>
                      {selected.score.toFixed(0)}/100
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Signal</p>
                    <p className="text-xs font-semibold mt-0.5">{selected.signal}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1 text-xs text-primary mt-4 font-medium">
                  View Full Brief <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            </motion.div>
          </div>
        </section>
      ) : briefData === undefined ? (
        /* Brief loading skeleton — only shows while Query 2 is in flight */
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Today&apos;s Stock Intelligence</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                A real snapshot from our engine not a recommendation, just an evidence layer.
              </p>
            </div>
            <div className="max-w-2xl mx-auto">
              <div className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — STOCKS WORTH INVESTIGATING (loads independently from Query 3)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-t border-border/60">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Stocks Worth Investigating</h2>
              <p className="text-muted-foreground mt-1">A daily universe based on real screening conditions.</p>
            </div>
            <Link href="/markets/discover" className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
              See All <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {discoverData === undefined ? (
            /* Discover loading skeleton — only shows while Query 3 is in flight */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : discoverWithSentiment.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discoverWithSentiment.slice(0, 6).map((stock, idx) => (
                <motion.div
                  key={stock.ticker}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => goToStock(stock.ticker)}
                    className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-border/80 active:scale-[0.99]"
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
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Sentiment</p>
                        <p className={cn(
                          'text-xs font-semibold mt-0.5',
                          stock.sentiment === 'Positive' ? 'text-success' :
                          stock.sentiment === 'Negative' ? 'text-destructive' :
                          stock.sentiment === 'Neutral' ? 'text-warning' : 'text-muted-foreground'
                        )}>{stock.sentiment || '—'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Risk</p>
                        <p className={cn(
                          'text-xs font-semibold mt-0.5',
                          stock.risk === 'High' ? 'text-destructive' : stock.risk === 'Low' ? 'text-success' : 'text-warning'
                        )}>{stock.risk || '—'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Score</p>
                        <p className={cn(
                          'text-xs font-semibold mt-0.5',
                          (stock.score || 0) >= 70 ? 'text-success' : (stock.score || 0) >= 40 ? 'text-warning' : 'text-destructive'
                        )}>{stock.score?.toFixed(0) || '—'}</p>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-pulse" />
              <p className="text-sm text-muted-foreground">Building your discovery universe…</p>
              <p className="text-xs text-muted-foreground/70 mt-1">This updates as fresh data arrives.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — ONE STOCK, MULTIPLE LAYERS (static — no data dependency)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-t border-border/60">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">One Stock, Multiple Layers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We don&apos;t give you a single number and hope. We show you every evidence layer behind the brief.
            </p>
          </motion.div>

          <div className="max-w-lg mx-auto space-y-3">
            {evidenceSteps.map((step, idx) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
              >
                <Link
                  href={step.link}
                  className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">Step {idx + 1}</span>
                      <span className="text-base font-semibold">{step.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — RESEARCH CAPABILITIES (static — no data dependency)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-t border-border/60">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Research Capabilities</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything available inside the product built around evidence and transparency.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {capabilities.map((cap, idx) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
              >
                <Link href={cap.link}>
                  <div className="rounded-2xl border border-border/60 bg-card p-6 h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 group">
                    <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <cap.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">{cap.title}</h3>
                    <p className="text-sm text-muted-foreground">{cap.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — BUILT FOR EVIDENCE (static — no data dependency)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-t border-border/60">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Built for Evidence</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Not a prediction tool. A research system that shows its work.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {trustPillars.map((pillar, idx) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                  <pillar.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — FINAL CTA (static — no data dependency)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-t border-border/60">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto glow-primary"
          >
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">
              Start With Evidence
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Search a stock and see the full brief — technical, sentiment, forecast, risk, and decision evidence in one view.
            </p>

            <div className="mb-8">
              <HeroSearch onSelect={goToStock} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/markets/brief">
                <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  View Stock Brief
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 w-full sm:w-auto">
                  How Stock Vanta Works
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
