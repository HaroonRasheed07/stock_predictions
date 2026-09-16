'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMarketOverview } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Brain,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const ProfessionalCandlestickChart = dynamic(
  () => import('@/components/ProfessionalCandlestickChart'),
  { ssr: false }
);

function SignalBadge({ signal }: { signal: string }) {
  const config: Record<string, { bg: string; icon: any }> = {
    'Strong Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp },
    Buy: { bg: 'bg-success/8 border-success/15 text-success', icon: TrendingUp },
    Hold: { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus },
    Sell: { bg: 'bg-destructive/8 border-destructive/15 text-destructive', icon: TrendingDown },
    'Strong Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown },
  };
  const c = config[signal] || config['Hold'];
  const Icon = c.icon;
  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5', c.bg)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-sm font-semibold">{signal}</span>
    </div>
  );
}

export function StockPageClient({ symbol }: { symbol: string }) {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['market-overview', symbol, '1y'],
    queryFn: () => fetchMarketOverview(symbol, '1y'),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-full bg-muted/30 animate-pulse rounded-lg" />
        <div className="h-64 w-full bg-muted/30 animate-pulse rounded-xl" />
        <div className="h-48 w-full bg-muted/30 animate-pulse rounded-xl" />
      </div>
    );
  }

  const tradeConfirmation = overview?.tradeConfirmation;
  const sentiment = overview?.sentiment;
  const risk = overview?.risk;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="technical">Technical</TabsTrigger>
        <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
        <TabsTrigger value="risk">Risk</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {/* Price Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight">
              ${overview?.currentPrice?.toFixed(2) || '—'}
            </p>
            {overview?.change !== undefined && overview.change !== 0 && (
              <div className={cn('flex items-center gap-1 text-sm font-medium', overview.change > 0 ? 'text-success' : 'text-destructive')}>
                {overview.change > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {overview.change > 0 ? '+' : ''}{overview.change.toFixed(2)} ({overview.changePercent?.toFixed(2)}%)
              </div>
            )}
          </div>
          {tradeConfirmation && (
            <SignalBadge signal={tradeConfirmation.signal || 'Hold'} />
          )}
        </div>

        {/* Chart */}
        {overview?.data && overview.data.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <ProfessionalCandlestickChart data={overview.data} />
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tradeConfirmation && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Signal</span>
              </div>
              <p className="text-sm font-semibold">{tradeConfirmation.signal}</p>
              <p className="text-xs text-muted-foreground">{tradeConfirmation.opportunity_score}/100</p>
            </div>
          )}
          {sentiment && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Sentiment</span>
              </div>
              <p className="text-sm font-semibold">{sentiment.market_mood || sentiment.sentiment_label}</p>
            </div>
          )}
          {risk && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Risk</span>
              </div>
              <p className={cn('text-sm font-semibold', risk.risk_level === 'High' ? 'text-destructive' : risk.risk_level === 'Low' ? 'text-success' : 'text-warning')}>
                {risk.risk_level}
              </p>
            </div>
          )}
          {overview?.volatility && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Volatility</span>
              </div>
              <p className="text-sm font-semibold">{overview.volatility.daily_volatility?.toFixed(1)}%</p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="technical">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Technical Analysis — {symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View full technical analysis including RSI, MACD, moving averages, Bollinger Bands, and ATR.
            </p>
            <a href={`/markets/stock/technical`} className="text-sm text-primary hover:underline mt-2 inline-block">
              Open full technical analysis →
            </a>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sentiment">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Market Sentiment — {symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentiment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Market Mood</span>
                  <Badge variant="secondary">{sentiment.market_mood || sentiment.sentiment_label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Score</span>
                  <span className={cn('text-sm font-semibold', sentiment.sentiment_score > 0.1 ? 'text-success' : sentiment.sentiment_score < -0.1 ? 'text-destructive' : 'text-muted-foreground')}>
                    {sentiment.sentiment_score?.toFixed(2)}
                  </span>
                </div>
                {sentiment.news_impact_summary && (
                  <p className="text-xs text-muted-foreground">{sentiment.news_impact_summary}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sentiment data available.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="risk">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Assessment — {symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {risk ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk Level</span>
                  <span className={cn('text-sm font-semibold', risk.risk_level === 'High' ? 'text-destructive' : risk.risk_level === 'Low' ? 'text-success' : 'text-warning')}>
                    {risk.risk_level} ({risk.risk_score?.toFixed(0)}/100)
                  </span>
                </div>
                {risk.factors?.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.name}</span>
                    <span className="font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk data available.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
