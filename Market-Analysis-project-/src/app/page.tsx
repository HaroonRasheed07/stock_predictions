'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, BarChart3, Brain, Shield, Zap,
  Activity, ArrowUpRight, ArrowDownRight, Minus, Clock,
  Search, ChevronRight, AlertTriangle, Target, Sparkles, FileText,
} from 'lucide-react';
import { useStockStore } from '@/store/stockStore';
import { fetchHomeIntelligence } from '@/lib/api';
import { cn } from '@/lib/utils';
import { TickerLogo } from '@/components/common/TickerLogo';

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

  const { data: intel, isLoading } = useQuery({
    queryKey: ['home-intelligence'],
    queryFn: fetchHomeIntelligence,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const goToStock = (ticker: string) => {
    setSelectedTicker(ticker);
    router.push('/markets/brief');
  };

  const topStocks = intel?.topStocks || [];
  const selected = intel?.selectedStock;
  const discover = intel?.discover || [];
  const alerts = intel?.alerts || [];
  const alertSummary = intel?.alertSummary;
  const marketStatus = intel?.marketStatus || 'Unknown';

  const features = [
    {
      icon: FileText,
      title: 'Stock Brief',
      description: 'AI-powered stock intelligence — signal, timeframes, catalysts, risk.',
      link: '/markets/brief',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Search,
      title: 'Discover',
      description: 'Find opportunities across the market with smart screening.',
      link: '/markets/discover',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: BarChart3,
      title: 'Technical Analysis',
      description: 'Indicators, charts, and pattern recognition for equities.',
      link: '/markets/stock/technical',
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  const capabilities = [
    {
      icon: Brain,
      title: 'AI Predictions',
      description: 'LSTM-powered 10-day price forecasts with confidence intervals',
    },
    {
      icon: Shield,
      title: 'Risk Intelligence',
      description: 'Multi-factor risk assessment with real-time monitoring',
    },
    {
      icon: Zap,
      title: 'Real-Time Signals',
      description: 'Live market event detection and alert system',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section (renders instantly, no data dependency) ──────── */}
      <section className="relative overflow-hidden gradient-hero py-16 md:py-24">
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
              {!isLoading && (
                <Badge variant={marketStatus === 'Open' ? 'default' : 'secondary'} className="text-xs ml-1">
                  <Clock className="h-3 w-3 mr-1" />
                  Market {marketStatus}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Real-time Market Intelligence &{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Predictive Analytics
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto">
              Professional-grade analytics for equities with AI-powered forecasting, sentiment analysis, and decision intelligence
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/markets/brief">
                <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8 gap-2">
                  <Sparkles className="h-5 w-5" />
                  Stock Brief
                </Button>
              </Link>
              <Link href="/markets/discover">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-lg px-8 gap-2">
                  <Search className="h-5 w-5" />
                  Discover Stocks
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Live Ticker (loads progressively) ─────────────────────────── */}
      {topStocks.length > 0 && (
        <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-4 overflow-hidden">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="flex space-x-8 whitespace-nowrap"
          >
            {[...topStocks.slice(0, 8), ...topStocks.slice(0, 8)].map((stock, idx) => (
              <button
                key={`${stock.symbol}-${idx}`}
                onClick={() => goToStock(stock.symbol)}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <span className="font-semibold">{stock.symbol}</span>
                <span className="text-foreground/70">${stock.price.toFixed(2)}</span>
                <span className={stock.changePercent >= 0 ? 'text-success' : 'text-destructive'}>
                  {stock.changePercent >= 0 ? '+' : ''}
                  {stock.changePercent.toFixed(2)}%
                </span>
              </button>
            ))}
          </motion.div>
        </div>
      )}

      {/* ─── Features Grid (static, renders instantly) ────────────────── */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Multi-Market Intelligence</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive analytics across multiple dimensions of market data
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Link href={feature.link}>
                  <Card className="card-interactive h-full group">
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Data Sections (progressive loading with section dividers) ── */}
      <div className="container mx-auto px-4 pb-8">

        {/* ─── Market Snapshot ────────────────────────────────────────── */}
        <section className="py-6 border-t border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market Snapshot</h2>
              <p className="text-xs text-muted-foreground/80 mt-0.5">What is happening across markets</p>
            </div>
            <Link href="/markets/stock" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {topStocks.slice(0, 8).map((stock, idx) => (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => goToStock(stock.symbol)}
                    className="w-full text-left rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 hover:shadow-md hover:border-border/80 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TickerLogo ticker={stock.symbol} size="sm" />
                      <span className="text-sm font-semibold">{stock.symbol}</span>
                    </div>
                    <p className="text-lg font-bold">${stock.price.toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {stock.changePercent >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className={cn(
                        'text-xs font-semibold',
                        stock.changePercent >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Quick Brief ────────────────────────────────────────────── */}
        {selected && (
          <section className="py-6 border-t border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Brief</h2>
                <p className="text-xs text-muted-foreground/80 mt-0.5">What needs your attention</p>
              </div>
              <button
                onClick={() => goToStock(selected.ticker)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Full Brief <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                onClick={() => goToStock(selected.ticker)}
                className="w-full text-left rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/20 active:scale-[0.99]"
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
              </button>
            </motion.div>
          </section>
        )}

        {/* ─── Discover Preview ───────────────────────────────────────── */}
        <section className="py-6 border-t border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Discover</h2>
              <p className="text-xs text-muted-foreground/80 mt-0.5">Stocks worth investigating</p>
            </div>
            <Link href="/markets/discover" className="text-xs text-primary hover:underline flex items-center gap-1">
              See All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : discover.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {discover.slice(0, 6).map((stock, idx) => (
                <motion.div
                  key={stock.ticker}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => goToStock(stock.ticker)}
                    className="w-full text-left rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-border/80 active:scale-[0.99]"
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
                        <p className="text-xs font-semibold mt-0.5">{stock.sentiment || '—'}</p>
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
            <div className="rounded-xl border border-border/40 bg-card/50 p-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Discovery universe is refreshing</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Check back in a moment for fresh opportunities</p>
            </div>
          )}
        </section>

        {/* ─── Watchlist Alerts ───────────────────────────────────────── */}
        {alerts.length > 0 && (
          <section className="py-6 border-t border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Alerts</h2>
                {alertSummary && alertSummary.total > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {alertSummary.total}
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => goToStock(alert.ticker)}
                    className="w-full text-left flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 hover:shadow-sm hover:border-border/80"
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      alert.severity === 'high' ? 'bg-destructive/10' :
                      alert.severity === 'medium' ? 'bg-warning/10' : 'bg-muted/50'
                    )}>
                      {alert.type === 'price_move' ? (
                        <TrendingUp className={cn('h-4 w-4', alert.direction === 'up' ? 'text-success' : 'text-destructive')} />
                      ) : alert.type === 'volume_spike' ? (
                        <Activity className="h-4 w-4 text-primary" />
                      ) : alert.type === 'rsi_extreme' ? (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      ) : (
                        <Target className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{alert.ticker}</span>
                        <Badge variant="secondary" className={cn(
                          'text-[10px]',
                          alert.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                          alert.severity === 'medium' ? 'bg-warning/10 text-warning' : ''
                        )}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.message}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Capabilities (static, renders instantly) ────────────────── */}
        <section className="py-12 border-t border-border/60">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Capabilities</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powered by cutting-edge machine learning and real-time data processing
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {capabilities.map((cap, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <cap.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
                <p className="text-muted-foreground">{cap.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── CTA Section (static) ─────────────────────────────────── */}
        <section className="py-12 border-t border-border/60">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto glow-primary"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Trading Strategy?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join traders using AI-driven market analysis for data-driven decisions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/markets/brief">
                <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8 gap-2">
                  <Sparkles className="h-5 w-5" />
                  Get Started
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-lg px-8">
                  Learn More
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
