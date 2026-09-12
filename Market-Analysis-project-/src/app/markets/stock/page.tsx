'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, BarChart3, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketOverview, fetchAssetSearch, AssetInfo } from '@/lib/api';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { OpportunityDashboard } from '@/components/dashboard/OpportunityDashboard';
import { VolatilityMonitor } from '@/components/dashboard/VolatilityMonitor';
import { RelativeVolume } from '@/components/dashboard/RelativeVolume';
import { RiskOverview } from '@/components/analysis/RiskOverview';
import { TradeConfirmation } from '@/components/analysis/TradeConfirmation';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useRef, useCallback } from 'react';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStockStore } from '@/store/stockStore';

export default function StockOverview() {
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const [inputTicker, setInputTicker] = useState('AAPL');
  const [ticker, setTicker] = useState('AAPL');
  const [suggestions, setSuggestions] = useState<AssetInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autocomplete search
  const handleSearchInput = useCallback((value: string) => {
    setInputTicker(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 1) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchAssetSearch(value.trim(), true);
        setSuggestions(results.slice(0, 8));
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setTicker(selectedTicker);
    setInputTicker(selectedTicker);
  }, [selectedTicker]);

  const handleSelectSuggestion = (asset: AssetInfo) => {
    setInputTicker(asset.ticker);
    setTicker(asset.ticker);
    setSelectedTicker(asset.ticker);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTicker.trim()) {
      const newTicker = inputTicker.toUpperCase().trim();
      setTicker(newTicker);
      setSelectedTicker(newTicker);
      setShowSuggestions(false);
    }
  };

  const [timeRange, setTimeRange] = useState('1y');

  // SINGLE combined API call instead of 7+ separate calls
  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ['market-overview', ticker, timeRange],
    queryFn: () => fetchMarketOverview(ticker, timeRange),
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 300000, // 5 minutes — keep in memory for fast back/forward
    refetchOnWindowFocus: false,
  });

  // Separate lightweight queries for data that refreshes differently — run in parallel immediately
  const watchlistTickers = overview?.watchlist && overview.watchlist.length > 0 ? overview.watchlist : [];

  const { data: opportunityData, isLoading: isLoadingOpportunities, refetch: refetchOpportunities } = useQuery({
    queryKey: ['opportunities', watchlistTickers],
    queryFn: () => import('@/lib/api').then(m => m.fetchOpportunityScan(watchlistTickers)),
    enabled: watchlistTickers.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: volatilityMonitorData, isLoading: isLoadingVolatilityMonitor, refetch: refetchVolatilityMonitor } = useQuery({
    queryKey: ['volatility-monitor', watchlistTickers],
    queryFn: () => import('@/lib/api').then(m => m.fetchVolatilityMonitor(watchlistTickers)),
    enabled: watchlistTickers.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Stock Market Overview</h1>
            <p className="text-sm text-muted-foreground">Real-time market data and analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistButton ticker={ticker} />
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearch} className="flex items-center gap-1.5">
                <Input type="text" placeholder="Search..." value={inputTicker}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => inputTicker.trim().length >= 1 && setShowSuggestions(true)}
                  className="w-28 md:w-56 h-9 text-sm bg-background border-border/60" />
                <Button type="submit" size="icon" variant="secondary" className="h-9 w-9"><Search className="h-4 w-4" /></Button>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
      <LoadingSkeleton type="card" />
    </div>
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Error loading stock data: {error.message}</p>
        <p className="text-sm text-muted-foreground mt-2">Make sure the backend server is running on port 8000</p>
      </div>
    );
  }

  const stocks = overview?.topStocks || [];
  const currentPrice = overview?.currentPrice || 0;
  const priceChange = overview?.change || 0;
  const priceChangePercent = overview?.changePercent || 0;
  const marketStatus = overview?.marketStatus || 'Unknown';

  const historicalData = overview?.data || [];
  const latestCandle = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
  const openPrice = latestCandle?.Open || 0;

  const chartData = historicalData.map((d: any) => ({
    date: new Date(d.Date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: timeRange === '1d' ? '2-digit' : undefined,
      minute: timeRange === '1d' ? '2-digit' : undefined
    }),
    close: d.Close
  })) || [];

  const sentimentLabel = overview?.sentiment?.sentiment_label || 'Neutral';
  const sentimentScore = overview?.sentiment?.sentiment_score || 0;

  const marketStats = [
    {
      title: 'Selected Stock',
      value: ticker,
      change: marketStatus,
      trend: 'up',
      icon: Activity,
      color: 'text-primary',
    },
    {
      title: 'Current Price',
      value: `$${currentPrice.toFixed(2)}`,
      change: `${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      trend: priceChange >= 0 ? 'up' : 'down',
      icon: DollarSign,
      color: priceChange >= 0 ? 'text-success' : 'text-destructive',
    },
    {
      title: 'Open Price',
      value: `$${openPrice.toFixed(2)}`,
      change: 'Today',
      trend: 'neutral',
      icon: BarChart3,
      color: 'text-secondary',
    },
    {
      title: 'Sentiment',
      value: sentimentLabel,
      change: `${(sentimentScore * 100).toFixed(0)}% Score`,
      trend: sentimentScore > 0.5 ? 'up' : 'down',
      icon: Users,
      color: sentimentLabel === 'Positive' ? 'text-success' : sentimentLabel === 'Negative' ? 'text-destructive' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold">Stock Market Overview</h1>
              <Badge variant={marketStatus === 'Open' ? 'default' : 'secondary'} className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Market {marketStatus}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Real-time market data and analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistButton ticker={ticker} />
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearch} className="flex items-center gap-1.5">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={inputTicker}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => inputTicker.trim().length >= 1 && setShowSuggestions(true)}
                  className="w-28 md:w-56 h-9 text-sm bg-background border-border/60"
                />
                <Button type="submit" size="icon" variant="secondary" className="h-9 w-9">
                  <Search className="h-4 w-4" />
                </Button>
              </form>

              {/* Autocomplete Dropdown */}
              {showSuggestions && (suggestions.length > 0 || isSearching) && (
                <div className="absolute top-full left-0 right-12 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                  {isSearching && suggestions.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Searching...
                    </div>
                  )}
                  {suggestions.map((asset) => (
                    <button
                      key={asset.ticker}
                      onClick={() => handleSelectSuggestion(asset)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <TickerLogo ticker={asset.ticker} logoUrl={asset.logo_url} size="md" />
                        <div>
                          <p className="font-semibold text-sm">{asset.ticker}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {asset.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground capitalize">
                          {asset.asset_class}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketStats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="glass hover:glow-primary transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold mb-2">{stat.value}</p>
                    <div className="flex items-center space-x-1">
                      {stat.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : stat.trend === 'down' ? (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={
                        stat.trend === 'up' ? 'text-success' :
                        stat.trend === 'down' ? 'text-destructive' :
                        'text-muted-foreground'
                      }>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-primary`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Market Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Price History - {ticker}</CardTitle>
            <div className="flex space-x-2">
              {['1d', '1m', '6m', '1y'].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === (range === '1m' ? '1mo' : range === '6m' ? '6mo' : range) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range === '1m' ? '1mo' : range === '6m' ? '6mo' : range)}
                  className="h-8 text-xs"
                >
                  {range.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  minTickGap={30}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  name="Price"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Components Grid — data from combined endpoint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <TradeConfirmation
            data={overview?.tradeConfirmation || null}
            isLoading={isLoading}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <RiskOverview
            data={overview?.risk || null}
            isLoading={isLoading}
          />
        </motion.div>
      </div>

      {/* Relative Volume */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <RelativeVolume
          data={overview?.volatility?.relative_volume}
          isLoading={isLoading}
        />
      </motion.div>

      {/* Opportunity Dashboard */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <OpportunityDashboard
          data={opportunityData?.scan_results || []}
          isLoading={isLoadingOpportunities}
          onRefresh={() => refetchOpportunities()}
          onAssetClick={(selectedTicker) => {
            setInputTicker(selectedTicker);
            setTicker(selectedTicker);
            setSelectedTicker(selectedTicker);
          }}
        />
      </motion.div>

      {/* Volatility Monitor - Collapsible */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <Accordion type="single" collapsible className="glass">
          <AccordionItem value="volatility-monitor">
            <AccordionTrigger className="px-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="font-semibold">Volatility Monitor</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <VolatilityMonitor
                data={volatilityMonitorData?.volatility_monitor || []}
                isLoading={isLoadingVolatilityMonitor}
                onRefresh={() => refetchVolatilityMonitor()}
                onAssetClick={(selectedTicker) => {
                  setInputTicker(selectedTicker);
                  setTicker(selectedTicker);
                  setSelectedTicker(selectedTicker);
                }}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>

      {/* Top Performing Stocks */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="glass">
          <CardHeader>
            <CardTitle>Top Performing Stocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stocks?.map((stock: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setInputTicker(stock.symbol);
                    setTicker(stock.symbol);
                    setSelectedTicker(stock.symbol);
                  }}
                >
                  <div className="flex items-center space-x-4">
                    <TickerLogo ticker={stock.symbol} size="lg" />
                    <div>
                      <p className="font-semibold">{stock.symbol}</p>
                      <p className="text-sm text-muted-foreground">{stock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${stock.price.toFixed(2)}</p>
                    <div className="flex items-center space-x-1">
                      {stock.change >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      <span className={stock.change >= 0 ? 'text-success' : 'text-destructive'}>
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
