'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchIndicators, fetchTrendStrength, fetchVolatilitySummary } from '@/lib/api';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { TrendStrength } from '@/components/analysis/TrendStrength';
import { ExpectedRange } from '@/components/analysis/ExpectedRange';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { TrendingUp, Activity, Target, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStockStore } from '@/store/stockStore';
import { fetchAssetSearch, AssetInfo } from '@/lib/api';
import { TickerLogo } from '@/components/common/TickerLogo';
import ProfessionalCandlestickChart from '@/components/ProfessionalCandlestickChart';

export default function TechnicalAnalysis() {
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const [ticker, setTicker] = useState('AAPL');
  const [inputTicker, setInputTicker] = useState('AAPL');
  const [timeRange, setTimeRange] = useState('1y');
  const [suggestions, setSuggestions] = useState<AssetInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['technical-data', ticker, timeRange],
    queryFn: () => fetchIndicators(ticker, timeRange),
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: trendStrengthData, isLoading: isLoadingTrendStrength } = useQuery({
    queryKey: ['trend-strength', ticker],
    queryFn: () => fetchTrendStrength(ticker),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: volatilitySummaryData, isLoading: isLoadingVolatilitySummary } = useQuery({
    queryKey: ['volatility-summary', ticker],
    queryFn: () => fetchVolatilitySummary(ticker),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const candleData = apiData?.data?.map((d: any) => ({
    date: new Date(d.Date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: timeRange === '1d' ? '2-digit' : undefined,
      minute: timeRange === '1d' ? '2-digit' : undefined,
    }),
    open: d.Open,
    high: d.High,
    low: d.Low,
    close: d.Close,
    volume: d.Volume,
    rsi: d.RSI,
    macd: d.MACD,
    signal: d.Signal,
    upper: d.UpperBand,
    lower: d.LowerBand,
    sma20: d.SMA20,
    sma50: d.SMA50,
  })) || [];

  const latest = candleData[candleData.length - 1] || {};

  const indicators = candleData.length > 0 ? {
    rsi: typeof latest.rsi === 'number' ? latest.rsi.toFixed(2) : 'N/A',
    macd: typeof latest.macd === 'number' ? latest.macd.toFixed(2) : 'N/A',
    signal: latest.macd > latest.signal ? 'Buy' : 'Sell',
  } : null;

  if (isLoading) return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Technical Analysis</h1>
            <p className="text-muted-foreground">Advanced charting and live signals for {ticker}</p>
          </div>
          <div className="flex items-center space-x-2">
            <WatchlistButton ticker={ticker} />
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearch} className="flex items-center space-x-2">
                <Input type="text" placeholder="Search stocks, forex, futures..." value={inputTicker}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => inputTicker.trim().length >= 1 && setShowSuggestions(true)}
                  className="w-48 md:w-64 bg-background/50 backdrop-blur-sm" />
                <Button type="submit" size="icon" variant="secondary"><Search className="h-4 w-4" /></Button>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
      <LoadingSkeleton type="chart" />
    </div>
  );

  // charts use full `candleData` (no timeframe selector)
  const filteredCandleData = candleData;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Technical Analysis</h1>
            <p className="text-muted-foreground">Advanced charting and live signals for {ticker}</p>
          </div>
          <div className="flex items-center space-x-2">
            <WatchlistButton ticker={ticker} />
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearch} className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Search stocks, forex, futures..."
                  value={inputTicker}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => inputTicker.trim().length >= 1 && setShowSuggestions(true)}
                  className="w-48 md:w-64 bg-background/50 backdrop-blur-sm"
                />
                <Button type="submit" size="icon" variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
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
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{asset.name}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground capitalize">{asset.asset_class}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Indicators Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">RSI (14)</p>
                <p className="text-2xl font-bold">{indicators?.rsi}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {parseFloat(indicators?.rsi || '0') > 70 ? 'Overbought' : parseFloat(indicators?.rsi || '0') < 30 ? 'Oversold' : 'Neutral'}
                </p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">MACD</p>
                <p className="text-2xl font-bold">{indicators?.macd}</p>
                <p className="text-sm text-success mt-1">Bullish Cross</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Signal</p>
                <p className="text-2xl font-bold text-success">{indicators?.signal}</p>
                <p className="text-sm text-muted-foreground mt-1">Strong momentum</p>
              </div>
              <Target className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Strength and Expected Range */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <TrendStrength 
            data={trendStrengthData || { ticker, trend_score: 50, trend_label: 'Neutral' }} 
            isLoading={isLoadingTrendStrength} 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ExpectedRange 
            data={volatilitySummaryData?.expected_range || { current_price: 0, atr: 0, expected_high: 0, expected_low: 0, range_percent: 0 }} 
            isLoading={isLoadingVolatilitySummary} 
          />
        </motion.div>
      </div>

      {/* Professional Candlestick Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex justify-between items-center w-full">
              <CardTitle>Candlestick Chart - {ticker}</CardTitle>
              <div className="flex space-x-2">
                {['1d', '5d', '1y', '2y'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="h-8 text-xs"
                  >
                    {range.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {filteredCandleData && filteredCandleData.length > 0 ? (
              <ProfessionalCandlestickChart 
                data={filteredCandleData} 
                ticker={ticker}
                height={520}
              />
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                No candlestick data available
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Price Action & Volume Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex justify-between items-center w-full">
              <CardTitle>Price Action & Volume</CardTitle>
              <div className="flex space-x-2">
                {['1y', '2y', '3y', '5y'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="h-8 text-xs"
                  >
                    {range.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={filteredCandleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  interval={filteredCandleData.length>0? Math.floor(filteredCandleData.length / 10):0}
                />
                <YAxis
                  yAxisId="price"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="high"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="High"
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="low"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={false}
                  name="Low"
                />
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill="hsl(var(--muted))"
                  opacity={0.3}
                  name="Volume"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bollinger Bands */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex justify-between items-center w-full">
              <CardTitle>Bollinger Bands</CardTitle>
              <div className="flex space-x-2">
                {['1y', '2y', '3y', '5y'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="h-8 text-xs"
                  >
                    {range.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={filteredCandleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  interval={filteredCandleData.length>0? Math.floor(filteredCandleData.length / 10):0}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  name="Upper Band"
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={false}
                  name="Close"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  name="Lower Band"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
