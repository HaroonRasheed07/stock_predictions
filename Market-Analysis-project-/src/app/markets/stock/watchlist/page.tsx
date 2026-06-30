'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunityScan, fetchWatchlistDefaults, OpportunityScore } from '@/lib/api';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import { Star, Plus, Trash2, TrendingUp, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WatchlistPage() {
  const { watchlist, addToWatchlist, removeFromWatchlist, setWatchlist } = useWatchlistStore();
  const [newTicker, setNewTicker] = useState('');
  const router = useRouter();

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
      addToWatchlist(newTicker.trim());
      setNewTicker('');
    }
  };

  const handleAddCategory = (categoryTickers: string[]) => {
    setWatchlist([...new Set([...watchlist, ...categoryTickers])]);
  };

  const handleRemoveTicker = (ticker: string) => {
    removeFromWatchlist(ticker);
  };

  const handleAssetClick = (ticker: string) => {
    router.push(`/markets/stock?ticker=${ticker}`);
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
      </motion.div>

      {/* Add Ticker Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass">
          <CardContent className="p-4">
            <form onSubmit={handleAddTicker} className="flex gap-2">
              <Input
                type="text"
                placeholder="Add ticker (e.g., AAPL, GC=F, EURUSD=X)"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Add Categories */}
      {defaultWatchlists?.categories && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
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
        </motion.div>
      )}

      {/* Empty State */}
      {watchlist.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
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
        </motion.div>
      )}

      {/* Watchlist with Opportunity Scores */}
      {watchlist.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
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
                      <motion.div
                        key={item.ticker}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md bg-card/50"
                        onClick={() => handleAssetClick(item.ticker)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
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
                          
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-lg font-bold">${item.price.toFixed(2)}</p>
                              <p className={`text-sm font-medium ${item.change_percent >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {item.change_percent >= 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                              </p>
                            </div>
                            
                            <div className={`px-4 py-2 rounded-lg border-2 text-center min-w-[90px] ${scoreColorClass}`}>
                              <p className="text-xl font-bold">{item.score.toFixed(0)}</p>
                              <p className="text-xs font-medium uppercase tracking-wider">{getScoreLabel(item.score)}</p>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTicker(item.ticker);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
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
        </motion.div>
      )}
    </div>
  );
}