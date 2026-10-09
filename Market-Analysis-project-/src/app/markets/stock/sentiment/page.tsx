'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, TrendingUp, AlertCircle, AlertTriangle, Search, ExternalLink, Newspaper } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchSentiment, fetchAssetSearch, AssetInfo } from '@/lib/api';
import { useStockStore } from '@/store/stockStore';
import { parseTickerParam } from '@/lib/ticker-routing';
import { getSentimentColorClass, getSentimentScoreColorClass, formatSentimentLabel } from '@/lib/sentiment';
import { SentimentTrend } from '@/components/analysis/SentimentTrend';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { TickerLogo } from '@/components/common/TickerLogo';
import ProfessionalSentimentChart from '@/components/ProfessionalSentimentChart';
import { CompanyFilings } from './CompanyFilings';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function SentimentAnalysis() {
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const [ticker, setTicker] = useState(selectedTicker);
  const [inputTicker, setInputTicker] = useState(selectedTicker);
  const [suggestions, setSuggestions] = useState<AssetInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showAllArticles, setShowAllArticles] = useState(false);
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

  // Deep link support: /markets/stock/sentiment?ticker=MSFT
  useEffect(() => {
    const t = parseTickerParam(new URLSearchParams(window.location.search).get('ticker'));
    if (t) setSelectedTicker(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setShowAllArticles(false);
  }, [ticker]);

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
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const formatAge = (value?: string) => {
    if (!value) return '';
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return '';
    const diffMinutes = Math.floor((Date.now() - time) / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const coverageLabel = (value?: string) => {
    const key = (value || '').toUpperCase();
    if (key === 'FULL') return 'Full coverage';
    if (key === 'PARTIAL') return 'Partial coverage';
    if (key === 'INSUFFICIENT') return 'Insufficient coverage';
    return value || '';
  };

  const feedItems = (
    sentimentData?.articles && sentimentData.articles.length > 0
      ? sentimentData.articles
      : sentimentData?.news || []
  ).map((item: any, idx: number) => ({
    id: String(item.article_id ?? item.url ?? idx),
    title: item.title || '',
    url: item.url || '',
    source: item.publisher || item.source || 'Unknown',
    published_at: item.published_at,
  }));

  const initialCount = sentimentData?.initial_count ?? 10;
  const remainingArticles = feedItems.length - initialCount;
  const hasMoreArticles =
    remainingArticles > 0 && (sentimentData?.has_more_articles ?? true);
  const visibleItems =
    showAllArticles || !hasMoreArticles ? feedItems : feedItems.slice(0, initialCount);

  const relevantCount =
    sentimentData?.relevant_article_count ?? sentimentData?.news_count ?? 0;
  const showLimitedBanner =
    Boolean(sentimentData?.limited_evidence) ||
    (sentimentData?.status === 'insufficient' && relevantCount >= 1);

  const coverageText = coverageLabel(sentimentData?.coverage_status);
  const freshAge = formatAge(sentimentData?.freshest_article_at);
  const coverageLine = [coverageText, freshAge ? `Newest article: ${freshAge}` : '']
    .filter(Boolean)
    .join(' · ');

  const confidenceLabel = (sentimentData?.confidence_label || '').toLowerCase();
  const confidencePct =
    typeof sentimentData?.confidence === 'number'
      ? Math.round(sentimentData.confidence * 100)
      : null;
  const confidenceClass =
    confidenceLabel === 'high'
      ? 'bg-success/10 text-success border-success/20'
      : confidenceLabel === 'medium'
        ? 'bg-warning/10 text-warning border-warning/20'
        : 'bg-muted/50 text-muted-foreground border-border/60';

  const sourceAttributions = sentimentData?.source_attributions || [];

  // ALWAYS show the search header — never block it behind a skeleton
  const headerSection = (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2">Sentiment Analysis</h1>
          <p className="text-sm text-muted-foreground">Recent market sentiment for {ticker}</p>
        </div>
        <div className="flex items-center gap-2">
          <WatchlistButton ticker={ticker} />
          <div ref={searchRef} className="relative">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Search..."
                value={inputTicker}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => inputTicker.trim().length >= 1 && setShowSuggestions(true)}
                className="w-24 sm:w-40 md:w-56 h-8 sm:h-9 text-xs sm:text-sm bg-background border-border/60"
              />
              <Button type="submit" size="icon" variant="secondary" className="h-8 w-8 sm:h-9 sm:w-9">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {headerSection}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="glass h-[100px] sm:h-[120px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="glass h-[180px] sm:h-[200px] rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Skeleton className="glass h-[380px] sm:h-[420px] rounded-xl" />
          <Skeleton className="glass h-[380px] sm:h-[420px] rounded-xl" />
        </div>
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
    <div className="space-y-4 sm:space-y-6">
      {headerSection}

      {showLimitedBanner && (
        <Alert className="border-yellow-600 bg-yellow-600/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-600">
            Limited evidence — {relevantCount === 0
              ? 'no relevant articles'
              : `only ${relevantCount} relevant article${relevantCount === 1 ? '' : 's'}`} found in the last 24h.{' '}
            {sentimentData?.score_available === false
              ? 'Sentiment score is withheld until more coverage is available.'
              : 'Sentiment score should be treated as provisional until more coverage is available.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Sentiment Score */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        <Card className="glass">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Overall Score</p>
                <p className="text-xl sm:text-3xl font-bold">
                  {sentimentData?.score_available === false
                    ? '—'
                    : (sentimentData?.sentiment_score ? sentimentData.sentiment_score.toFixed(2) : '0.00')}
                </p>
                <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 ${getSentimentColorClass(sentimentData?.sentiment_label || '', sentimentData?.status)}`}>
                  {formatSentimentLabel(sentimentData?.sentiment_label || '', sentimentData?.status)}
                </p>
                {confidenceLabel && (
                  <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${confidenceClass}`}>
                    {confidenceLabel.charAt(0).toUpperCase() + confidenceLabel.slice(1)} confidence
                    {confidencePct !== null && <span className="opacity-70">{confidencePct}%</span>}
                  </span>
                )}
                {coverageLine && (
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{coverageLine}</p>
                )}
              </div>
              <TrendingUp className={`h-7 w-7 sm:h-10 sm:w-10 shrink-0 ${getSentimentColorClass(sentimentData?.sentiment_label || '', sentimentData?.status)}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Sentiment</p>
                <p className="text-xl sm:text-3xl font-bold">{formatSentimentLabel(sentimentData?.sentiment_label || '', sentimentData?.status)}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Market Mood</p>
              </div>
              <MessageSquare className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">News Count</p>
                <p className="text-xl sm:text-3xl font-bold">{sentimentData?.news_count ?? sentimentData?.news?.length ?? 0}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                  {(sentimentData?.status === 'news_unavailable' || sentimentData?.status === 'no_relevant_news')
                    ? 'No articles found'
                    : 'Articles analyzed'}
                </p>
              </div>
              <AlertCircle className="h-7 w-7 sm:h-10 sm:w-10 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Trend */}
      <div>
        <SentimentTrend 
          data={sentimentData || null} 
          isLoading={isLoading} 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Sentiment Distribution */}
        <div>
          <Card className="glass relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <span>News Distribution</span>
                    <Badge variant="secondary" className="font-medium">Recent</Badge>
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
              {(sentimentData?.news_count === 0 || sentimentData?.status === 'news_unavailable' || sentimentData?.status === 'no_relevant_news') ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Newspaper className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No sentiment distribution available</p>
                  <p className="text-xs text-muted-foreground mt-1">0 analyzed articles</p>
                </div>
              ) : (
                sentimentData && <ProfessionalSentimentChart data={sentimentData} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* News Feed */}
        <div>
          <Card className="glass relative overflow-hidden">
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
                <Badge variant="outline" className="shrink-0">{feedItems.length} items</Badge>
              </div>
              <Separator className="mt-4 bg-border/60" />
            </CardHeader>
            <CardContent className="relative pt-2">
              <ScrollArea className="h-[320px] sm:h-[380px] md:h-[420px] w-full pr-4">
                <div className="space-y-3 pb-1">
                  {visibleItems.map((news) => (
                    <div
                      key={news.id}
                      className="group rounded-xl border border-border/50 bg-background/40 p-3 sm:p-4 shadow-sm hover:shadow-md hover:bg-muted/25 hover:border-border/80 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 mt-0.5 shrink-0">
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
                    </div>
                  ))}
                  {(feedItems.length === 0) && (
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
              {hasMoreArticles && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setShowAllArticles((prev) => !prev)}
                >
                  {showAllArticles
                    ? 'Show less'
                    : `Show ${remainingArticles} more article${remainingArticles === 1 ? '' : 's'}`}
                </Button>
              )}
              {sourceAttributions.length > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Sources: {sourceAttributions.join(' · ')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SEC Company Filings */}
      <CompanyFilings ticker={ticker} />
    </div>
  );
}
