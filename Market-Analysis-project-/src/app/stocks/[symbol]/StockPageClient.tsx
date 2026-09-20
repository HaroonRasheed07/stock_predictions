'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '@/store/stockStore';
import {
  fetchMarketOverview,
  fetchIndicators,
  fetchForecast,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Activity, Brain, TrendingUp, TrendingDown,
  DollarSign, Shield, AlertTriangle, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile, chartMargins, xAxisConfig, yAxisConfig, tooltipStyle, CHART_HEIGHTS } from '@/lib/chartUtils';
import ProfessionalCandlestickChart from '@/components/ProfessionalCandlestickChart';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';

type Tab = 'overview' | 'technical' | 'sentiment' | 'forecast';

const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'technical', label: 'Technical', icon: Activity },
  { key: 'sentiment', label: 'Sentiment', icon: Brain },
  { key: 'forecast', label: 'Forecast', icon: Target },
];

function ErrorSection({ title, message }: { title: string; message?: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {message && <p className="text-xs text-muted-foreground/70 mt-1">{message}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewSection({ ticker }: { ticker: string }) {
  const isMobile = useIsMobile();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['market-overview', ticker, '1y'],
    queryFn: () => fetchMarketOverview(ticker, '1y'),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  if (!overview) return <ErrorSection title="Overview data unavailable" />;

  const historicalData = overview.data || [];
  const chartData = historicalData.map((d: any) => ({
    date: new Date(d.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    close: d.Close,
  }));

  const sentimentLabel = overview.sentiment?.sentiment_label || 'Neutral';
  const sentimentScore = overview.sentiment?.sentiment_score || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Price', value: `$${(overview.currentPrice || 0).toFixed(2)}`, change: `${(overview.changePercent || 0) >= 0 ? '+' : ''}${(overview.changePercent || 0).toFixed(2)}%`, positive: (overview.change || 0) >= 0 },
          { label: 'Change', value: `${(overview.change || 0) >= 0 ? '+' : ''}$${Math.abs(overview.change || 0).toFixed(2)}`, change: overview.marketStatus || '', positive: (overview.change || 0) >= 0 },
          { label: 'Sentiment', value: sentimentLabel, change: `${sentimentScore >= 0 ? '+' : ''}${sentimentScore.toFixed(2)}`, positive: sentimentScore > 0.15 },
          { label: 'Risk', value: overview.risk?.risk_level || 'N/A', change: `Score: ${overview.risk?.risk_score || 0}`, positive: overview.risk?.risk_level !== 'High' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
            <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">{stat.label}</p>
            <p className="text-base sm:text-xl font-bold mt-1">{stat.value}</p>
            <p className={cn('text-xs mt-0.5 font-medium', stat.positive ? 'text-green-500' : 'text-red-500')}>{stat.change}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Price History — {ticker}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-4">
            <ResponsiveContainer width="100%" height={isMobile ? CHART_HEIGHTS.priceHistory.mobile : CHART_HEIGHTS.priceHistory.desktop}>
              <ComposedChart data={chartData} margin={chartMargins(isMobile)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis {...xAxisConfig(isMobile, chartData.length)} />
                <YAxis {...yAxisConfig(isMobile)} domain={['auto', 'auto']} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0)}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']} />
                <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" strokeWidth={isMobile ? 1.5 : 2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trade Confirmation</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('text-2xl font-bold', overview.tradeConfirmation?.signal === 'Buy' ? 'text-green-500' : overview.tradeConfirmation?.signal === 'Sell' ? 'text-red-500' : 'text-yellow-500')}>
                {overview.tradeConfirmation?.signal || 'N/A'}
              </div>
              <Badge variant={overview.tradeConfirmation?.signal === 'Buy' ? 'default' : 'secondary'}>
                Score: {overview.tradeConfirmation?.score || 0}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{overview.tradeConfirmation?.rationale || 'Insufficient data for confirmation.'}</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Assessment</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Shield className={cn('h-6 w-6', overview.risk?.risk_level === 'High' ? 'text-red-500' : overview.risk?.risk_level === 'Low' ? 'text-green-500' : 'text-yellow-500')} />
              <div>
                <p className="text-lg font-bold">{overview.risk?.risk_level || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Score: {overview.risk?.risk_score || 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{overview.risk?.message || 'Risk assessment pending.'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TechnicalSection({ ticker }: { ticker: string }) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState('1y');

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['technical-data', ticker, timeRange],
    queryFn: () => fetchIndicators(ticker, timeRange),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  if (!apiData?.data?.length) return <ErrorSection title="Technical data unavailable" />;

  const candleData = apiData.data.map((d: any) => ({
    date: new Date(d.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
    open: d.Open, high: d.High, low: d.Low, close: d.Close, volume: d.Volume,
    rsi: d.RSI, macd: d.MACD, signal: d.Signal, upper: d.UpperBand, lower: d.LowerBand, sma20: d.SMA20, sma50: d.SMA50,
  }));

  const latest = candleData[candleData.length - 1] || {};
  const indicators = {
    rsi: typeof latest.rsi === 'number' ? latest.rsi.toFixed(2) : 'N/A',
    macd: typeof latest.macd === 'number' ? latest.macd.toFixed(2) : 'N/A',
    signal: latest.macd > latest.signal ? 'Buy' : 'Sell',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'RSI (14)', value: indicators.rsi, sub: parseFloat(indicators.rsi) > 70 ? 'Overbought' : parseFloat(indicators.rsi) < 30 ? 'Oversold' : 'Neutral', icon: Activity, color: 'text-primary' },
          { label: 'MACD', value: indicators.macd, sub: indicators.signal === 'Buy' ? 'Bullish Cross' : 'Bearish Cross', icon: TrendingUp, color: indicators.signal === 'Buy' ? 'text-green-500' : 'text-red-500' },
          { label: 'Signal', value: indicators.signal, sub: 'Momentum', icon: Target, color: indicators.signal === 'Buy' ? 'text-green-500' : 'text-red-500' },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5">{item.value}</p>
                <p className={cn('text-xs mt-0.5', item.color)}>{item.sub}</p>
              </div>
              <item.icon className={cn('h-5 w-5 sm:h-6 sm:w-6', item.color)} />
            </div>
          </div>
        ))}
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-sm sm:text-base">Candlestick Chart — {ticker}</CardTitle>
            <div className="flex gap-1 overflow-x-auto">
              {['1d', '5d', '1y', '2y'].map((range) => (
                <Button key={range} variant={timeRange === range ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange(range)} className="h-7 text-[10px] sm:text-xs px-2 shrink-0">
                  {range.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4">
          <ProfessionalCandlestickChart data={candleData} ticker={ticker} height={isMobile ? CHART_HEIGHTS.candlestick.mobile : CHART_HEIGHTS.candlestick.desktop} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Bollinger Bands</CardTitle></CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4">
          <ResponsiveContainer width="100%" height={isMobile ? CHART_HEIGHTS.bollinger.mobile : CHART_HEIGHTS.bollinger.desktop}>
            <ComposedChart data={candleData} margin={chartMargins(isMobile)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis {...xAxisConfig(isMobile, candleData.length)} />
              <YAxis {...yAxisConfig(isMobile)} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, '']} />
              <Area type="monotone" dataKey="upper" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Upper Band" />
              <Line type="monotone" dataKey="close" stroke="hsl(var(--secondary))" strokeWidth={isMobile ? 1.5 : 2} dot={false} name="Close" />
              <Area type="monotone" dataKey="lower" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Lower Band" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function SentimentSection({ ticker }: { ticker: string }) {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['market-overview', ticker, '1y'],
    queryFn: () => fetchMarketOverview(ticker, '1y'),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const sentimentData = overview?.sentiment;

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  if (!sentimentData) return <ErrorSection title="Sentiment data unavailable" />;

  const label = sentimentData.sentiment_label || sentimentData.label || 'Neutral';
  const score = sentimentData.sentiment_score || sentimentData.score || 0;
  const positive = sentimentData.positive_count || 0;
  const negative = sentimentData.negative_count || 0;
  const total = positive + negative || 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className={cn('rounded-xl border p-3 sm:p-4 bg-card/50 text-center', label === 'Positive' ? 'border-green-500/30' : 'border-border/50')}>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Positive</p>
          <p className="text-xl sm:text-3xl font-bold text-green-500 mt-1">{((positive / total) * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Overall</p>
          <p className={cn('text-xl sm:text-3xl font-bold mt-1', label === 'Positive' ? 'text-green-500' : label === 'Negative' ? 'text-red-500' : 'text-muted-foreground')}>{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Score: {score.toFixed(2)}</p>
        </div>
        <div className={cn('rounded-xl border p-3 sm:p-4 bg-card/50 text-center', label === 'Negative' ? 'border-red-500/30' : 'border-border/50')}>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Negative</p>
          <p className="text-xl sm:text-3xl font-bold text-red-500 mt-1">{((negative / total) * 100).toFixed(0)}%</p>
        </div>
      </div>

      {sentimentData.market_mood && (
        <Card className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Market Mood</p>
            <p className="text-lg font-bold">{sentimentData.market_mood}</p>
            {sentimentData.news_impact_summary && (
              <p className="text-sm text-muted-foreground mt-2">{sentimentData.news_impact_summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {sentimentData.news && sentimentData.news.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent News</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sentimentData.news.slice(0, 8).map((article: any, i: number) => (
                <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                  <p className="text-sm font-medium line-clamp-2">{article.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{article.source}</span>
                    {article.published_at && <span>· {new Date(article.published_at).toLocaleDateString()}</span>}
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ForecastSection({ ticker }: { ticker: string }) {
  const isMobile = useIsMobile();
  const { data: forecastData, isLoading } = useQuery({
    queryKey: ['price-forecast', ticker, '1y'],
    queryFn: () => fetchForecast(ticker, 10, '1y'),
    staleTime: 60000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  if (!forecastData?.results) return <ErrorSection title="Forecast data unavailable" message="The forecast model may not support this ticker yet." />;

  const { actual_prices, predicted_historical_prices, forecast_prices, forecast_dates } = forecastData.results;
  const currentPrice = actual_prices?.[actual_prices.length - 1] || 0;
  const avgPredicted = forecast_prices.length > 0 ? forecast_prices.reduce((a: number, b: number) => a + b, 0) / forecast_prices.length : 0;
  const priceChange = currentPrice ? ((avgPredicted - currentPrice) / currentPrice) * 100 : 0;
  const trend = forecast_prices[forecast_prices.length - 1] > currentPrice ? 'Bullish' : 'Bearish';

  const chartData: Array<{ date: string; actual: number | null; predicted: number | null }> = [];
  const today = new Date();
  for (let i = 0; i < (actual_prices?.length || 0); i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - ((actual_prices?.length || 0) - i));
    chartData.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual: actual_prices[i],
      predicted: i < (predicted_historical_prices?.length || 0) ? predicted_historical_prices[i] : null,
    });
  }
  if (forecast_dates && forecast_prices) {
    forecast_dates.forEach((dateStr: string, i: number) => {
      chartData.push({
        date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        actual: null,
        predicted: i < forecast_prices.length ? forecast_prices[i] : null,
      });
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Current', value: `$${currentPrice.toFixed(2)}`, icon: DollarSign },
          { label: 'Forecast Avg', value: `$${avgPredicted.toFixed(2)}`, change: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}%`, icon: Brain },
          { label: 'Trend', value: trend, icon: TrendingUp },
          { label: 'Horizon', value: `${forecast_prices.length} days`, icon: Target },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">{stat.label}</p>
            <p className="text-base sm:text-xl font-bold mt-1">{stat.value}</p>
            {stat.change && <p className={cn('text-xs mt-0.5 font-medium', priceChange >= 0 ? 'text-green-500' : 'text-red-500')}>{stat.change}</p>}
          </div>
        ))}
      </div>

      <Card className="glass">
        <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Price Forecast — Next {forecast_prices.length} Days</CardTitle></CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4">
          <ResponsiveContainer width="100%" height={isMobile ? CHART_HEIGHTS.forecast.mobile : CHART_HEIGHTS.forecast.desktop}>
            <ComposedChart data={chartData} margin={chartMargins(isMobile)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis {...xAxisConfig(isMobile, chartData.length)} />
              <YAxis {...yAxisConfig(isMobile)} domain={['auto', 'auto']} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name === 'actual' ? 'Actual' : 'Forecast']} />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} iconType="line" />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={isMobile ? 2 : 2.5} dot={false} name="actual" connectNulls />
              <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={isMobile ? 2 : 2.5} strokeDasharray="8 4" dot={false} name="predicted" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-secondary" />
            <p className="text-sm font-medium">LSTM Attention Model</p>
            <Badge variant="outline" className="text-[10px]">Active</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Predictions are based on historical OHLCV data and technical indicators. Past performance does not guarantee future results. Forecasts should be used as one input among many.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function StockPageClient({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { setSelectedTicker } = useStockStore();

  useEffect(() => {
    setSelectedTicker(symbol);
  }, [symbol, setSelectedTicker]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}</div>}>
        <div key={activeTab}>
          {activeTab === 'overview' && <OverviewSection ticker={symbol} />}
          {activeTab === 'technical' && <TechnicalSection ticker={symbol} />}
          {activeTab === 'sentiment' && <SentimentSection ticker={symbol} />}
          {activeTab === 'forecast' && <ForecastSection ticker={symbol} />}
        </div>
      </Suspense>
    </div>
  );
}
