'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useStockStore } from '@/store/stockStore';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunityScan, fetchWatchlistDefaults, OpportunityScore, AssetInfo } from '@/lib/api';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Star, Plus, Trash2, TrendingUp, Search, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAssetSearch } from '@/hooks/useAssetSearch';

export default function WatchlistPage() {
  const { watchlist, addToWatchlist, removeFromWatchlist, setWatchlist } = useWatchlistStore();
  const [newTicker, setNewTicker] = useState('');
  const assetSearch = useAssetSearch({ maxResults: 6 });
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced autocomplete search
  const handleTickerInput = useCallback((value: string) => {
    setNewTicker(value);
    assetSearch.search(value);
  }, [assetSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        assetSearch.close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [assetSearch]);

  // Fetch opportunity scores for watchlist
  const { data: opportunityData, isLoading: isLoadingOpportunities, refetch: refetchOpportunities } = useQuery({
    queryKey: ['opportunities', watchlist],
    queryFn: () => fetchOpportunityScan(watchlist),
    enabled: watchlist.length > 0,
  });

  // Fetch default watchlists by category
  const { data: defaultWatchlists } = useQuery({
    queryKey: ['watchlist-defaults'],
    queryFn: () => fetchWatchlistDefaults(),
  });

  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTicker.trim()) {
      addToWatchlist(newTicker.trim().toUpperCase());
      setNewTicker('');
      assetSearch.close();
    }
  };

  const handleSelectSuggestion = (asset: AssetInfo) => {
    addToWatchlist(asset.ticker);
    setNewTicker('');
    assetSearch.close();
  };

  const handleAddCategory = (categoryTickers: string[]) => {
    setWatchlist([...new Set([...watchlist, ...categoryTickers])]);
  };

  const handleRemoveTicker = (ticker: string) => {
    removeFromWatchlist(ticker);
  };

  const handleAssetClick = (ticker: string) => {
    useStockStore.getState().setSelectedTicker(ticker);
    router.push('/markets/stock');
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success bg-success/10 border-success/30';
    if (score >= 40) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-destructive bg-destructive/10 border-destructive/30';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Moderate';
    return 'Low';
  };

  const opportunities = opportunityData?.scan_results || [];

  return (
    <div className="space-y-6">
      <div
        className="space-y-2"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500" />
              My Watchlist
            </h1>
            <p className="text-muted-foreground">
              Track your favorite assets and their opportunity scores
            </p>
          </div>
          <Button onClick={() => refetchOpportunities()} variant="outline" size="sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Refresh Scores
          </Button>
        </div>
      </div>

      {/* Add Ticker Form */}
      <div>
          <Card className="glass">
            <CardContent className="p-4">
              <div ref={searchRef} className="relative">
                <form onSubmit={handleAddTicker} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add ticker (e.g., AAPL, GC=F, EURUSD=X)"
                    value={newTicker}
                    onChange={(e) => handleTickerInput(e.target.value)}
                    onFocus={() => newTicker.trim().length >= 1 && assetSearch.setShowResults(true)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>

                {/* Autocomplete Dropdown */}
                {assetSearch.showResults && (assetSearch.results.length > 0 || assetSearch.isSearching) && (
                  <div className="absolute top-full left-0 right-10 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    {assetSearch.isSearching && assetSearch.results.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Searching...
                      </div>
                    )}
                    {assetSearch.results.map((asset) => (
                      <button
                        key={asset.ticker}
                        onClick={() => handleSelectSuggestion(asset)}
                        className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/30 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <TickerLogo ticker={asset.ticker} logoUrl={asset.logo_url} size="sm" />
                          <div>
                            <p className="font-semibold text-sm">{asset.ticker}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {asset.name}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground capitalize">
                          {asset.asset_class}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Quick Add Categories */}
      {defaultWatchlists?.categories && (
        <div>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Quick Add by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(defaultWatchlists.categories).map(([category, tickers]) => (
                  <Button
                    key={category}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddCategory(tickers as string[])}
                    className="capitalize"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {watchlist.length === 0 && (
        <div
          className="text-center py-16"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/30 flex items-center justify-center">
            <Star className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Your watchlist is empty</h3>
          <p className="text-muted-foreground mb-6">
            Add assets to track their opportunity scores and performance
          </p>
          <div className="flex justify-center gap-4">
            {defaultWatchlists?.categories && Object.entries(defaultWatchlists.categories).slice(0, 3).map(([category, tickers]) => (
              <Button
                key={category}
                variant="outline"
                onClick={() => handleAddCategory(tickers as string[])}
                className="capitalize"
              >
                Add {category}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist with Opportunity Scores */}
      {watchlist.length > 0 && (
        <div>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Watchlist Assets ({watchlist.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOpportunities ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : opportunities.length > 0 ? (
                <div className="space-y-3">
                  {opportunities.map((item, index) => {
                    const scoreColorClass = getScoreColor(item.score);
                    return (
                      <div
                        key={item.ticker}
                        className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md bg-card/50"
                        onClick={() => handleAssetClick(item.ticker)}
                      >
                        <div className="flex items-center justify-between">
                          {/* Desktop: single row */}
                          <div className="hidden sm:flex items-center gap-4">
                            <div className="text-lg font-bold text-muted-foreground w-8">#{index + 1}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{item.ticker}</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.asset_class}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{item.name}</p>
                            </div>
                          </div>

                          {/* Mobile: compact */}
                          <div className="sm:hidden flex items-center gap-2">
                            <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{item.ticker}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {item.asset_class}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{item.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:gap-6">
                            <div className="text-right">
                              <p className="font-bold text-sm sm:text-lg">${item.price.toFixed(2)}</p>
                              <p className={`text-xs sm:text-sm font-medium ${item.change_percent >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {item.change_percent >= 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                              </p>
                            </div>

                            <div className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border-2 text-center ${scoreColorClass}`}>
                              <p className="text-base sm:text-xl font-bold">{item.score.toFixed(0)}</p>
                              <p className="text-[9px] sm:text-xs font-medium uppercase tracking-wider">{getScoreLabel(item.score)}</p>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTicker(item.ticker);
                              }}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Could not load opportunity scores</p>
                  <Button onClick={() => refetchOpportunities()} variant="outline" size="sm" className="mt-4">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
