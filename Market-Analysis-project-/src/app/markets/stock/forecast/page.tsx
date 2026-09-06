'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { fetchForecast } from '@/lib/api';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Target, Brain, AlertTriangle, Search, AlertCircle, BarChart3, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStockStore } from '@/store/stockStore';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { fetchAssetSearch, AssetInfo } from '@/lib/api';
import { TickerLogo } from '@/components/common/TickerLogo';

interface ForecastData {
  ticker: string;
  forecast_days: number;
  results: {
    actual_prices: number[];
    predicted_historical_prices: number[];
    forecast_prices: number[];
    forecast_dates: string[];
  };
}

const TICKER_AUTOCORRECT: Record<string, string> = {
  'APPL': 'AAPL',
  'APPLE': 'AAPL',
  'MICROSOFT': 'MSFT',
  'TESLA': 'TSLA',
  'AMAZON': 'AMZN',
  'GOOGLE': 'GOOGL',
  'ALPHABET': 'GOOGL',
  'FACEBOOK': 'META',
  'NETFLIX': 'NFLX',
  'NVIDIA': 'NVDA',
  'TESAL': 'TSLA',
  'TSL': 'TSLA',
};

export default function PriceForecasting() {
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
      let newTicker = inputTicker.toUpperCase().trim();
      if (TICKER_AUTOCORRECT[newTicker]) {
        newTicker = TICKER_AUTOCORRECT[newTicker];
        setInputTicker(newTicker);
      }
      setTicker(newTicker);
      setSelectedTicker(newTicker);
      setShowSuggestions(false);
    }
  };

  const renderSearchForm = () => (
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
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
  );

  const { data: forecastData, isLoading, error, refetch } = useQuery({
    queryKey: ['price-forecast', ticker, timeRange],
    queryFn: () => fetchForecast(ticker, 10, timeRange),
    refetchInterval: 0, // Don't auto refetch often as it's heavy
    retry: 2,
    enabled: !!ticker,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
            <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM model</p>
          </div>
          {renderSearchForm()}
        </div>
      </motion.div>
      <LoadingSkeleton type="chart" />
    </div>
  );
  
  if (error) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
              <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM & Prophet models</p>
            </div>
            <div className="flex items-center space-x-2">
              <WatchlistButton ticker={ticker} />
              {renderSearchForm()}
            </div>
          </div>
        </motion.div>

        <Alert className="border-destructive">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            Failed to load forecast data. {error?.message || 'Please try again or check if the API is available.'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!forecastData) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
            <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM model</p>
          </div>
          {renderSearchForm()}
        </div>
        </motion.div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No forecast data available. Please try again or select a different ticker.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  console.log("Parsed forecastData in component:", forecastData);

  const apiStatus: string | undefined = (forecastData as any)?.status;
  const apiMeta: any = (forecastData as any)?._meta;

  const results = forecastData.results;
  const actualPrices: number[] = Array.isArray(results?.actual_prices) ? results.actual_prices : [];
  const predictedHistoricalPrices: number[] = Array.isArray(results?.predicted_historical_prices) ? results.predicted_historical_prices : [];
  const forecastPrices: number[] = Array.isArray(results?.forecast_prices) ? results.forecast_prices : [];
  const forecastDates: string[] = Array.isArray(results?.forecast_dates) ? results.forecast_dates : [];

  console.log("Chart datasets before rendering:", {
    actualPricesLength: actualPrices.length,
    predictedHistoricalPricesLength: predictedHistoricalPrices.length,
    forecastPricesLength: forecastPrices.length,
    forecastDatesLength: forecastDates.length
  });

  const historicalLength = actualPrices.length;
  const forecastLength = forecastPrices.length;

  const chartData: Array<{
    date: string;
    actual: number | null;
    predicted: number | null;
    type: 'historical' | 'forecast';
  }> = [];

  if (results) {
    // Generate historical dates (assuming daily for simplicity, going back from yesterday)
    const today = new Date();
    // Historical
    for (let i = 0; i < historicalLength; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (historicalLength - i));
      chartData.push({
        date: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: timeRange === '1d' ? '2-digit' : undefined,
          minute: timeRange === '1d' ? '2-digit' : undefined,
        }),
        actual: actualPrices[i],
        predicted: i < predictedHistoricalPrices.length ? predictedHistoricalPrices[i] : null,
        type: 'historical'
      });
    }
    // Forecast
    if (forecastDates.length > 0 && forecastPrices.length > 0) {
      forecastDates.forEach((dateStr: string, i: number) => {
        chartData.push({
          date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          actual: null,
          predicted: i < forecastPrices.length ? forecastPrices[i] : null,
          type: 'forecast'
        });
      });
    }
  }

  const currentPrice = actualPrices[historicalLength - 1] || 0;
  const futurePrices = forecastPrices;
  const avgPredicted = futurePrices.length > 0
    ? futurePrices.reduce((a: number, b: number) => a + b, 0) / futurePrices.length
    : 0;

  const priceChange = currentPrice ? ((avgPredicted - currentPrice) / currentPrice) * 100 : 0;
  const lastForecast = futurePrices[futurePrices.length - 1] || 0;
  const trend = lastForecast > currentPrice ? 'Bullish' : 'Bearish';
  
  // Calculate model accuracy on historical data
  const modelAccuracy = calculateAccuracy(actualPrices, predictedHistoricalPrices);
  
  // Calculate price volatility
  const volatility = calculateVolatility(actualPrices);
  
  // Calculate confidence based on accuracy
  const confidence = Math.min(95, Math.max(60, modelAccuracy + 10));

  const hasValidSeries =
    actualPrices.length > 0 &&
    predictedHistoricalPrices.length > 0 &&
    forecastPrices.length > 0 &&
    forecastDates.length > 0;

  if (apiStatus && apiStatus !== 'success') {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
              <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM model</p>
            </div>
            {renderSearchForm()}
          </div>
        </motion.div>

        <Alert className="border-yellow-600 bg-yellow-600/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-600">
            Forecast service status: <span className="font-semibold">{apiStatus}</span>.
            {(forecastData as any)?.detail ? ` ${(forecastData as any).detail}` : ''}
          </AlertDescription>
        </Alert>

        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!hasValidSeries) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
              <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM model</p>
            </div>
            {renderSearchForm()}
          </div>
        </motion.div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No forecast data available for this ticker/timeframe.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  

  // Show fallback warning if using generic scaler
  const isFallbackScaler = (forecastData as any)?.note === 'Using fallback scaler';

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Price Forecasting</h1>
            <p className="text-muted-foreground">AI-powered predictions for {ticker} using LSTM model</p>
          </div>
          {renderSearchForm()}
        </div>
      </motion.div>

      {/* Fallback Scaler Warning */}
      {isFallbackScaler && (
        <Alert className="border-yellow-600 bg-yellow-600/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-600">
            This ticker was not in the model's training data. Predictions use a generic scaler from similar stocks. Results should be interpreted with caution.
          </AlertDescription>
        </Alert>
      )}

      {apiMeta?.stale && (
        <Alert className="border-yellow-600 bg-yellow-600/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-600">
            Showing cached forecast due to a temporary forecasting error.
            {apiMeta?.error ? ` (${apiMeta.error})` : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                <p className="text-2xl font-bold">${currentPrice.toFixed(2)}</p>
                <Badge variant="secondary" className="mt-2">Live</Badge>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Forecast (Avg)</p>
                <p className="text-2xl font-bold">${avgPredicted.toFixed(2)}</p>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendingUp className={`h-4 w-4 ${priceChange >= 0 ? 'text-success' : 'text-destructive'}`} />
                  <span className={`text-sm ${priceChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                </div>
              </div>
              <Brain className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Model Confidence</p>
                <p className="text-2xl font-bold">{confidence.toFixed(1)}%</p>
                {confidence > 80 && (
                  <Badge variant="outline" className="mt-2 border-success text-success">
                    High
                  </Badge>
                )}
                {confidence > 70 && confidence <= 80 && (
                  <Badge variant="outline" className="mt-2 border-yellow-600 text-yellow-600">
                    Medium
                  </Badge>
                )}
                {confidence <= 70 && (
                  <Badge variant="outline" className="mt-2 border-destructive text-destructive">
                    Low
                  </Badge>
                )}
              </div>
              {confidence > 80 && <Zap className="h-8 w-8 text-success" />}
              {confidence > 70 && confidence <= 80 && <Zap className="h-8 w-8 text-yellow-600" />}
              {confidence <= 70 && <Zap className="h-8 w-8 text-destructive" />}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Trend</p>
                <p className="text-2xl font-bold">{trend}</p>
                <p className={`text-sm mt-2 ${trend === 'Bullish' ? 'text-success' : 'text-destructive'}`}>
                  {trend === 'Bullish' ? 'Upward momentum' : 'Downward correction'}
                </p>
              </div>
              <TrendingUp className={`h-8 w-8 ${trend === 'Bullish' ? 'text-success' : 'text-destructive'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Price Prediction (Next 10 Days)</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">LSTM Model</Badge>
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
            </div>
          </CardHeader>
          <CardContent>
            {historicalLength === 0 && forecastLength === 0 ? (
              <div className="flex items-center justify-center h-80 text-muted-foreground">
                No forecast data available for this ticker/timeframe
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(chartData.length / 10)}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />

                {/* Actual price */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={false}
                  name="Actual Price"
                  connectNulls
                />

                {/* Predicted price */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Predicted Price"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Model Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-secondary" />
                <span>LSTM Attention Model</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Architecture</span>
                <span className="font-semibold">LSTM + Attention</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Input Features</span>
                <span className="font-semibold">OHLCV + Indicators</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Training Period</span>
                <span className="font-semibold">2012 - 2024</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Prediction Accuracy</span>
                <span className="font-semibold text-success">{modelAccuracy.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="border-success text-success">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span>Market Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Volatility</span>
                <span className="font-semibold">{volatility.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Forecast Days</span>
                <span className="font-semibold">{forecastLength} days</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Historical Data Points</span>
                <span className="font-semibold">{historicalLength} prices</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Price Range (Forecast)</span>
                <span className="font-semibold">${Math.min(...futurePrices).toFixed(2)} - ${Math.max(...futurePrices).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-semibold text-xs">{new Date().toLocaleTimeString()}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Helper Functions
function calculateAccuracy(actual: number[], predicted: number[]): number {
  if (actual.length === 0 || predicted.length === 0) return 0;
  
  const minLen = Math.min(actual.length, predicted.length);
  let totalError = 0;
  
  for (let i = 0; i < minLen; i++) {
    const error = Math.abs((actual[i] - predicted[i]) / actual[i]);
    totalError += error;
  }
  
  const meanError = totalError / minLen;
  const accuracy = Math.max(0, (1 - meanError) * 100);
  
  return Math.min(99.99, accuracy);
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(dailyReturn);
  }
  
  // Calculate standard deviation (volatility)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Annualize volatility (assuming 252 trading days)
  return stdDev * Math.sqrt(252) * 100;
}
