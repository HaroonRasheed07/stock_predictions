'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchIndicators, fetchSentiment, fetchOpportunityScan, fetchVolatilityMonitor, fetchVolatilitySummary, fetchRiskAssessment, fetchTradeConfirmation, fetchWatchlistDefaults } from '@/lib/api';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { OpportunityDashboard } from '@/components/dashboard/OpportunityDashboard';
import { VolatilityMonitor } from '@/components/dashboard/VolatilityMonitor';
import { RelativeVolume } from '@/components/dashboard/RelativeVolume';
import { RiskOverview } from '@/components/analysis/RiskOverview';
import { TradeConfirmation } from '@/components/analysis/TradeConfirmation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from 'react';

// ...

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStockStore } from '@/store/stockStore';

export default function StockOverview() {
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const [inputTicker, setInputTicker] = useState('AAPL');
  const [ticker, setTicker] = useState('AAPL'); // Effective ticker for queries

  useEffect(() => {
    // Hydrate store after mount
    setTicker(selectedTicker);
    setInputTicker(selectedTicker);
  }, [selectedTicker]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTicker.trim()) {
      const newTicker = inputTicker.toUpperCase().trim();
      setTicker(newTicker);
      setSelectedTicker(newTicker);
    }
  };

  const [timeRange, setTimeRange] = useState('1y');

  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ['stock-indicators', ticker, timeRange],
    queryFn: () => fetchIndicators(ticker, timeRange),
    refetchInterval: 30000,
  });

  const { data: sentimentData } = useQuery({
    queryKey: ['stock-sentiment', ticker],
    queryFn: () => fetchSentiment(ticker),
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingSkeleton type="card" />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Error loading stock data: {error.message}</p>
        <p className="text-sm text-muted-foreground mt-2">Make sure the backend server is running on port 8000</p>
      </div>
    );
  }

  const stocks = apiData?.topStocks || [];
  // Use properties directly from API root
  const currentPrice = apiData?.currentPrice || 0;
  const priceChange = apiData?.change || 0;
  const priceChangePercent = apiData?.changePercent || 0;

  // Get Open Price from the latest data point
  const historicalData = apiData?.data || [];
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

  const sentimentLabel = sentimentData?.sentiment_label || 'Neutral';
  const sentimentScore = sentimentData?.sentiment_score || 0;

  const marketStats = [
    {
      title: 'Selected Stock',
      value: ticker,
      change: 'Active',
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
      color: sentimentLabel === 'Bullish' ? 'text-success' : 'text-destructive',
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Stock Market Overview</h1>
            <p className="text-muted-foreground">Real-time market data and analytics</p>
          </div>
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Enter Ticker (e.g. NVDA)"
              value={inputTicker}
              onChange={(e) => setInputTicker(e.target.value)}
              className="w-32 md:w-48 bg-background/50 backdrop-blur-sm"
            />
            <Button type="submit" size="icon" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>
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
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      <span className={stat.trend === 'up' ? 'text-success' : 'text-destructive'}>
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

      {/* Top Stocks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass">
          <CardHeader>
            <CardTitle>Top Performing Stocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stocks?.map((stock, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                      <span className="text-white font-bold">{stock.symbol.slice(0, 2)}</span>
                    </div>
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
