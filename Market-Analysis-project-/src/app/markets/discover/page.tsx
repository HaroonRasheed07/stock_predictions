'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import {
  fetchAssetSearch,
  fetchDiscoverScan,
  type AssetInfo,
  type DiscoverStock,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Zap,
  AlertTriangle,
  Target,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TickerLogo } from '@/components/common/TickerLogo';
import { WatchlistButton } from '@/components/common/WatchlistButton';

// ─── Stock Card ────────────────────────────────────────────────────────────
function DiscoverStockCard({ data, onTap }: {
  data: DiscoverStock;
  onTap: () => void;
}) {
  const { ticker, name, price, change, changePercent, signal, risk, sentiment, score } = data;

  return (
    <button
      onClick={onTap}
      className="w-full text-left rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/80 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TickerLogo ticker={ticker} size="md" />
          <div>
            <p className="text-sm font-semibold">{ticker}</p>
            {price !== undefined && price > 0 && (
              <p className="text-lg font-bold">${price.toFixed(2)}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          {changePercent !== undefined && (
            <p className={cn(
              'text-sm font-semibold',
              changePercent > 0 ? 'text-success' : changePercent < 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </p>
          )}
          {signal && (
            <Badge
              variant="secondary"
              className={cn(
                'mt-1 text-xs font-semibold',
                signal === 'Buy' || signal === 'Strong Buy' ? 'badge-buy' :
                signal === 'Sell' || signal === 'Strong Sell' ? 'badge-sell' : 'badge-hold'
              )}
            >
              {signal}
            </Badge>
          )}
        </div>
      </div>

      {/* Compact Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Sentiment</p>
          <p className={cn(
            'text-xs font-semibold mt-0.5',
            sentiment?.includes('Positive') || sentiment === 'Bullish' ? 'text-success' :
            sentiment?.includes('Negative') || sentiment === 'Bearish' ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {sentiment?.split(' ')[0] || '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Risk</p>
          <p className={cn(
            'text-xs font-semibold mt-0.5',
            risk === 'High' ? 'text-destructive' : risk === 'Low' ? 'text-success' : 'text-warning'
          )}>
            {risk || '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Score</p>
          <p className={cn(
            'text-xs font-semibold mt-0.5',
            (score || 0) >= 70 ? 'text-success' : (score || 0) >= 40 ? 'text-warning' : 'text-destructive'
          )}>
            {score?.toFixed(0) || '—'}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Filter Chips ──────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: 'Buy' },
  { key: 'sell', label: 'Sell' },
  { key: 'strong_buy', label: 'Strong Buy' },
  { key: 'high_momentum', label: 'Momentum' },
  { key: 'low_risk', label: 'Low Risk' },
];

// ─── Main Discover Page ────────────────────────────────────────────────────
export default function DiscoverPage() {
  const router = useRouter();
  const { setSelectedTicker } = useStockStore();
  const { watchlist } = useWatchlistStore();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetInfo[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchlistTickers = watchlist.length > 0 ? watchlist : ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'JPM', 'V', 'JNJ'];

  // Single bulk endpoint instead of 10 parallel overview calls
  const { data: discoverData, isLoading } = useQuery({
    queryKey: ['discover-scan', '1y', ...watchlistTickers.slice(0, 10)],
    queryFn: () => fetchDiscoverScan(watchlistTickers.slice(0, 10), '1y'),
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const stocks = discoverData?.stocks || {};

  const filteredTickers = useMemo(() => {
    let tickers = Object.keys(stocks);

    if (filter === 'buy') {
      tickers = tickers.filter(t => ['Buy', 'Strong Buy'].includes(stocks[t]?.signal || ''));
    } else if (filter === 'sell') {
      tickers = tickers.filter(t => ['Sell', 'Strong Sell'].includes(stocks[t]?.signal || ''));
    } else if (filter === 'strong_buy') {
      tickers = tickers.filter(t => stocks[t]?.signal === 'Strong Buy');
    } else if (filter === 'high_momentum') {
      tickers = tickers.filter(t => Math.abs(stocks[t]?.changePercent || 0) > 2);
    } else if (filter === 'low_risk') {
      tickers = tickers.filter(t => stocks[t]?.risk === 'Low');
    }

    return tickers;
  }, [stocks, filter]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) { setSearchResults([]); setShowSearch(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchAssetSearch(q);
        setSearchResults(data.slice(0, 8));
        setShowSearch(true);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const openStock = (ticker: string) => {
    setSelectedTicker(ticker);
    router.push('/markets/brief');
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">Stocks that deserve your attention</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search stocks..."
          className="pl-9 h-10 text-sm bg-background border-border/60"
          onFocus={() => searchResults.length > 0 && setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
        />
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r.ticker}
                onClick={() => { openStock(r.ticker); setSearchQuery(''); setShowSearch(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <TickerLogo ticker={r.ticker} size="sm" />
                <div>
                  <p className="text-sm font-medium">{r.ticker}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
              filter === f.key
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/30'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stock Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTickers.map((ticker) => (
            <DiscoverStockCard
              key={ticker}
              data={stocks[ticker]}
              onTap={() => openStock(ticker)}
            />
          ))}
        </div>
      )}

      {filteredTickers.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No stocks match this filter</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
