'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, TrendingUp, AlertCircle, Search, ExternalLink, Newspaper } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchSentiment, fetchAssetSearch, AssetInfo } from '@/lib/api';
import { useStockStore } from '@/store/stockStore';
import { SentimentTrend } from '@/components/analysis/SentimentTrend';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { TickerLogo } from '@/components/common/TickerLogo';
import ProfessionalSentimentChart from '@/components/ProfessionalSentimentChart';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function SentimentAnalysis() {
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const [ticker, setTicker] = useState('AAPL');
  const [inputTicker, setInputTicker] = useState('AAPL');
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

  const formatPublishedAt = (value: any) => {
    if (!value) return 'Recent';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'Recent';
    return dt.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (value: string) => {
    const t = (value || '').trim();
    if (!t) return 'N';
    const parts = t.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'N';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${first}${last}`.toUpperCase();
  };

  const { data: sentimentData, isLoading } = useQuery({
    queryKey: ['sentiment-data', ticker],
    queryFn: () => fetchSentiment(ticker),
    refetchInterval: 60000,
  });

  // ALWAYS show the search header — never block it behind a skeleton
  const headerSection = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Sentiment Analysis</h1>
          <p className="text-muted-foreground">Real-time market sentiment from news and social media for {ticker}</p>
        </div>
        <div className="flex items-center gap-2">
          <WatchlistButton ticker={ticker} />
          <div ref={searchRef} className="relative">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
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
        </div>
      </div>
    </motion.div>
  );

  // Show header + loading state for sentiment data
  if (isLoading) {
    return (
      <div className="space-y-6">
        {headerSection}
        <LoadingSkeleton type="chart" />
      </div>
    );
  }

  if (!sentimentData) {
    return (
      <div className="space-y-6">
        {headerSection}

        <Card className="glass overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <CardContent className="relative p-6">
            <p className="text-sm text-muted-foreground">No sentiment data available right now. Try another ticker.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {headerSection}

      {/* Sentiment Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                <p className="text-3xl font-bold">
                  {sentimentData?.sentiment_score ? sentimentData.sentiment_score.toFixed(2) : '0.00'}
                </p>
                <p className={`text-sm mt-1 ${sentimentData?.sentiment_label === 'Positive' ? 'text-success' :
                    sentimentData?.sentiment_label === 'Negative' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                  {sentimentData?.sentiment_label || 'Neutral'}
                </p>
              </div>
              <TrendingUp className={`h-10 w-10 ${sentimentData?.sentiment_label === 'Positive' ? 'text-success' :
                  sentimentData?.sentiment_label === 'Negative' ? 'text-destructive' : 'text-muted-foreground'
                }`} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sentiment</p>
                <p className="text-3xl font-bold">{sentimentData?.sentiment_label || 'N/A'}</p>
                <p className="text-sm text-muted-foreground mt-1">Market Mood</p>
              </div>
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">News Count</p>
                <p className="text-3xl font-bold">{sentimentData?.news?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Articles analyzed</p>
              </div>
              <AlertCircle className="h-10 w-10 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <SentimentTrend 
          data={sentimentData || null} 
          isLoading={isLoading} 
        />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Sentiment Distribution */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass relative overflow-hidden h-full min-h-[460px]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <span>Sentiment Distribution</span>
                    <Badge variant="secondary" className="font-medium">Live</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Breakdown from the latest analyzed headlines</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">Sources</div>
                  <div className="text-sm font-semibold">{sentimentData?.news?.length || 0}</div>
                </div>
              </div>
              <Separator className="mt-4 bg-border/60" />
            </CardHeader>
            <CardContent className="relative pt-2">
              {sentimentData && <ProfessionalSentimentChart data={sentimentData} />}
            </CardContent>
          </Card>
        </motion.div>

        {/* News Feed */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass relative overflow-hidden h-full min-h-[460px]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-secondary/12 via-transparent to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-primary" />
                    <span>Market News</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Latest headlines for {ticker}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{sentimentData?.news?.length || 0} items</Badge>
              </div>
              <Separator className="mt-4 bg-border/60" />
            </CardHeader>
            <CardContent className="relative pt-2">
              <ScrollArea className="h-[380px] md:h-[460px] w-full pr-4">
                <div className="space-y-3 pb-1">
                  {sentimentData?.news && sentimentData.news.map((news: any, idx: number) => (
                    <div
                      key={idx}
                      className="group rounded-xl border border-border/50 bg-background/40 p-4 shadow-sm hover:shadow-md hover:bg-muted/25 hover:border-border/80 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 mt-0.5">
                          <AvatarFallback className="text-xs font-semibold">
                            {getInitials(news.source || 'News')}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              <h4 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:underline underline-offset-4">
                                {news.title}
                              </h4>
                            </a>

                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              aria-label="Open article"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
                              {news.source || 'Unknown'}
                            </Badge>
                            <span className="text-muted-foreground">•</span>
                            <span>{formatPublishedAt(news.published_at)}</span>
                          </div>
                        </div>
                      </div>

                      <Separator className="mt-4 bg-border/50" />

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Tap to read full story</span>
                        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                  {(!sentimentData?.news || sentimentData.news.length === 0) && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                        <Newspaper className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">No recent news found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try another ticker or check again in a minute.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
