'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useStockStore } from '@/store/stockStore';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  fetchDiscoverScanAll,
  fetchOpportunityScanAll,
  fetchWatchlistDefaults,
  fetchAssetSearch,
  type AssetInfo,
  type OpportunityScore,
} from '@/lib/api';
import { TickerLogo } from '@/components/common/TickerLogo';
import {
  getSentimentColorClass,
  formatSentimentLabel,
  type SentimentStatus,
} from '@/lib/sentiment';
import { cn } from '@/lib/utils';
import { Star, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Row Model ──────────────────────────────────────────────────────────────
// One row per watchlist ticker, always present — never dropped when a backend
// scan fails for an individual symbol.

interface WatchlistRow {
  ticker: string;
  name: string;
  assetClass?: string;
  price?: number;
  changePercent?: number;
  technical?: string;
  risk?: string;
  sentiment?: string;
  sentimentStatus?: SentimentStatus;
  score?: number;
  hasData: boolean;
}

// ─── Canonical display helpers (mirror HomeClient / Discover) ───────────────

const technicalClass = (technical?: string) =>
  technical?.includes('Bullish')
    ? 'text-success'
    : technical?.includes('Bearish')
      ? 'text-destructive'
      : 'text-muted-foreground';

const riskClass = (risk?: string) =>
  risk === 'High'
    ? 'text-destructive'
    : risk === 'Low'
      ? 'text-success'
      : risk === 'Medium'
        ? 'text-warning'
        : 'text-muted-foreground';

const scoreClass = (score?: number) =>
  score === undefined
    ? 'text-muted-foreground'
    : score >= 70
      ? 'text-success'
      : score >= 40
        ? 'text-warning'
        : 'text-destructive';

const changeClass = (change?: number) =>
  change === undefined || change === 0
    ? 'text-muted-foreground'
    : change > 0
      ? 'text-success'
      : 'text-destructive';

// Deterministic formatting (no locale) so SSR and client always agree.
const fmtPrice = (value?: number) => {
  if (!value || !Number.isFinite(value)) return '—';
  const [whole, decimals] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${grouped}.${decimals}`;
};

const fmtPct = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const openStock = (ticker: string) => {
  useStockStore.getState().setSelectedTicker(ticker);
};

// ─── Shared pieces ──────────────────────────────────────────────────────────

function SignalCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-xs font-semibold leading-tight', className)}>{value}</p>
    </div>
  );
}

function SignalsGrid({ row }: { row: WatchlistRow }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
      <SignalCell label="Technical" value={row.technical || '—'} className={technicalClass(row.technical)} />
      <SignalCell label="Risk" value={row.risk || '—'} className={riskClass(row.risk)} />
      <SignalCell
        label="Score"
        value={row.score !== undefined ? row.score.toFixed(0) : '—'}
        className={scoreClass(row.score)}
      />
    </div>
  );
}

function SignalsSkeletonGrid() {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
    </div>
  );
}

function UnavailableNote() {
  return (
    <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
      Data temporarily unavailable
    </p>
  );
}

function SentimentValue({ row, className }: { row: WatchlistRow; className?: string }) {
  return (
    <span
      className={cn(
        'text-xs font-semibold',
        getSentimentColorClass(row.sentiment || '', row.sentimentStatus),
        className
      )}
    >
      {formatSentimentLabel(row.sentiment || '', row.sentimentStatus)}
    </span>
  );
}

// ─── Mobile / tablet card (< lg) ───────────────────────────────────────────

function WatchlistCard({
  row,
  isFetching,
  onRemove,
}: {
  row: WatchlistRow;
  isFetching: boolean;
  onRemove: (ticker: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:border-border/80 hover:shadow-md">
      <Link
        href="/markets/stock"
        onClick={() => openStock(row.ticker)}
        className="block rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <TickerLogo ticker={row.ticker} size="md" className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{row.ticker}</p>
                {row.assetClass && row.assetClass !== 'stock' && (
                  <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] capitalize">
                    {row.assetClass}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{row.name}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold tabular-nums">{fmtPrice(row.price)}</p>
            <p className={cn('text-xs font-semibold tabular-nums', changeClass(row.changePercent))}>
              {fmtPct(row.changePercent)}
            </p>
          </div>
        </div>

        {row.hasData ? (
          <SignalsGrid row={row} />
        ) : isFetching ? (
          <SignalsSkeletonGrid />
        ) : (
          <UnavailableNote />
        )}

        <span className="sr-only">Open full analysis for {row.ticker}</span>
      </Link>

      <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 pb-3 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Sentiment
          </span>
          <SentimentValue row={row} className="truncate" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${row.ticker} from watchlist`}
          onClick={() => onRemove(row.ticker)}
          className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

// ─── Desktop table (≥ lg) ───────────────────────────────────────────────────

function WatchlistTable({
  rows,
  isFetching,
  onRemove,
}: {
  rows: WatchlistRow[];
  isFetching: boolean;
  onRemove: (ticker: string) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm lg:block">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">
          Watchlist assets with rank, symbol, price, daily change, technical signal, risk, opportunity
          score, sentiment and actions
        </caption>
        <thead>
          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-10 px-3 py-2.5 font-medium">
              <span className="sr-only">Rank</span>
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Symbol
            </th>
            <th scope="col" className="w-28 px-3 py-2.5 text-right font-medium">
              Price
            </th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">
              Day
            </th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">
              Technical
            </th>
            <th scope="col" className="w-24 px-3 py-2.5 font-medium">
              Risk
            </th>
            <th scope="col" className="w-16 px-3 py-2.5 text-right font-medium">
              Score
            </th>
            <th scope="col" className="hidden w-28 px-3 py-2.5 font-medium xl:table-cell">
              Sentiment
            </th>
            <th scope="col" className="w-14 px-3 py-2.5 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.ticker}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2.5 align-middle text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="px-3 py-2.5 align-middle">
                <Link
                  href="/markets/stock"
                  onClick={() => openStock(row.ticker)}
                  className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TickerLogo ticker={row.ticker} size="sm" className="shrink-0" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{row.ticker}</span>
                      {row.assetClass && row.assetClass !== 'stock' && (
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] capitalize">
                          {row.assetClass}
                        </Badge>
                      )}
                    </span>
                    {row.hasData ? (
                      <span className="block truncate text-xs text-muted-foreground">{row.name}</span>
                    ) : isFetching ? (
                      <Skeleton className="mt-1 h-3 w-24" />
                    ) : (
                      <span className="block truncate text-xs text-destructive/80">
                        Data temporarily unavailable
                      </span>
                    )}
                  </span>
                  <span className="sr-only">Open full analysis for {row.ticker}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right align-middle font-semibold tabular-nums">
                {fmtPrice(row.price)}
              </td>
              <td
                className={cn(
                  'px-3 py-2.5 text-right align-middle font-medium tabular-nums',
                  changeClass(row.changePercent)
                )}
              >
                {fmtPct(row.changePercent)}
              </td>
              <td className={cn('px-3 py-2.5 align-middle font-medium', technicalClass(row.technical))}>
                {row.technical || '—'}
              </td>
              <td className={cn('px-3 py-2.5 align-middle font-medium', riskClass(row.risk))}>
                {row.risk || '—'}
              </td>
              <td
                className={cn(
                  'px-3 py-2.5 text-right align-middle font-semibold tabular-nums',
                  scoreClass(row.score)
                )}
              >
                {row.score !== undefined ? row.score.toFixed(0) : '—'}
              </td>
              <td className="hidden px-3 py-2.5 align-middle xl:table-cell">
                <SentimentValue row={row} className="block truncate" />
              </td>
              <td className="px-3 py-2.5 text-right align-middle">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.ticker} from watchlist`}
                  onClick={() => onRemove(row.ticker)}
                  className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Skeletons (match final geometry to avoid layout shift) ─────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="ml-auto h-5 w-20" />
          <Skeleton className="ml-auto h-3.5 w-12" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 w-11 rounded-md" />
      </div>
    </div>
  );
}

function ListSkeletons() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm lg:block">
        <div className="border-b border-border/60 px-3 py-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/40 px-3 py-3 last:border-0">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Card className="glass">
        <CardContent className="p-4">
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
      <ListSkeletons />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const { watchlist, addToWatchlist, removeFromWatchlist, setWatchlist } = useWatchlistStore();
  const [newTicker, setNewTicker] = useState('');
  const [suggestions, setSuggestions] = useState<AssetInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [freshnessLabel, setFreshnessLabel] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zustand persist rehydrates from localStorage on the client only, so the
  // first client render can differ from server HTML. Render a skeleton until
  // mounted to keep hydration clean.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounced autocomplete search
  const handleTickerInput = useCallback((value: string) => {
    setNewTicker(value);
    setShowSuggestions(true);
    setActiveIndex(-1);

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
        setSuggestions(results.slice(0, 6));
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
        setActiveIndex(-1);
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

  // Bulk scans (chunked helpers keep within backend per-request caps)
  const discoverQuery = useQuery({
    queryKey: ['watchlist-scan', 'discover', watchlist],
    queryFn: () => fetchDiscoverScanAll(watchlist),
    enabled: watchlist.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: keepPreviousData,
  });

  const opportunityQuery = useQuery({
    queryKey: ['watchlist-scan', 'opportunity', watchlist],
    queryFn: () => fetchOpportunityScanAll(watchlist),
    enabled: watchlist.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: keepPreviousData,
  });

  // Fetch default watchlists by category
  const { data: defaultWatchlists } = useQuery({
    queryKey: ['watchlist-defaults'],
    queryFn: () => fetchWatchlistDefaults(),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const categories: Record<string, string[]> | undefined = defaultWatchlists?.categories;
  const hasCategories = Boolean(categories && Object.keys(categories).length > 0);

  const discoverStocks = useMemo(() => discoverQuery.data?.stocks ?? {}, [discoverQuery.data]);
  const opportunities = useMemo(
    () => opportunityQuery.data?.scan_results ?? [],
    [opportunityQuery.data]
  );
  const oppByTicker = useMemo(() => {
    const map = new Map<string, OpportunityScore>();
    for (const item of opportunities) map.set(item.ticker, item);
    return map;
  }, [opportunities]);

  // One row per watchlist ticker: opportunity ranking first (score desc),
  // then any watchlist tickers the opportunity scan could not return.
  const rows = useMemo<WatchlistRow[]>(() => {
    const watchSet = new Set(watchlist);
    const ranked = Array.from(oppByTicker.values())
      .filter((item) => watchSet.has(item.ticker))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const buildRow = (ticker: string): WatchlistRow => {
      const discover = discoverStocks[ticker];
      const opportunity = oppByTicker.get(ticker);
      return {
        ticker,
        name: discover?.name || opportunity?.name || ticker,
        assetClass: opportunity?.asset_class,
        price: discover?.price ?? opportunity?.price,
        changePercent: discover?.changePercent ?? opportunity?.change_percent,
        technical: discover?.technical,
        risk: discover?.risk,
        sentiment: discover?.sentiment,
        sentimentStatus: discover?.sentiment_status,
        score: opportunity?.score ?? discover?.score,
        hasData: Boolean(discover || opportunity),
      };
    };

    const seen = new Set<string>();
    const built: WatchlistRow[] = [];
    for (const item of ranked) {
      seen.add(item.ticker);
      built.push(buildRow(item.ticker));
    }
    for (const ticker of watchlist) {
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      built.push(buildRow(ticker));
    }
    return built;
  }, [watchlist, discoverStocks, oppByTicker]);

  // Freshness from server cache metadata (computed client-side only)
  const updatedAt = Math.max(
    discoverQuery.data?._cache_meta?.updated_at ?? 0,
    opportunityQuery.data?._cache_meta?.updated_at ?? 0
  );

  useEffect(() => {
    if (!updatedAt) {
      setFreshnessLabel('');
      return;
    }
    const tick = () => {
      const minutes = Math.max(0, Math.floor((Date.now() / 1000 - updatedAt) / 60));
      setFreshnessLabel(minutes < 1 ? 'Updated just now' : `Updated ${minutes}m ago`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [updatedAt]);

  const isFetchingAny = discoverQuery.isFetching || opportunityQuery.isFetching;
  const discoverDown = discoverQuery.isError && !discoverQuery.data;
  const opportunityDown = opportunityQuery.isError && !opportunityQuery.data;
  const hasError = discoverDown || opportunityDown;
  const initialLoading =
    !discoverQuery.data &&
    !opportunityQuery.data &&
    (discoverQuery.isPending || opportunityQuery.isPending);

  const errorMessage =
    discoverDown && opportunityDown
      ? 'Market data could not be loaded.'
      : discoverDown
        ? 'Technical, risk and sentiment signals are temporarily unavailable.'
        : 'Opportunity scores are temporarily unavailable.';

  const handleRetry = () => {
    if (discoverDown) void discoverQuery.refetch();
    if (opportunityDown) void opportunityQuery.refetch();
  };

  const handleRefresh = () => {
    void discoverQuery.refetch();
    void opportunityQuery.refetch();
  };

  const suggestionsOpen = showSuggestions && (isSearching || suggestions.length > 0);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < suggestions.length) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
    }
  };

  function handleSelectSuggestion(asset: AssetInfo) {
    addToWatchlist(asset.ticker);
    setNewTicker('');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    searchInputRef.current?.focus();
  }

  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const value = newTicker.trim();
    if (!value) return;
    addToWatchlist(value);
    setNewTicker('');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleAddCategory = (categoryTickers: string[]) => {
    setWatchlist([...new Set([...watchlist, ...categoryTickers])]);
  };

  const handleRemoveTicker = (ticker: string) => {
    removeFromWatchlist(ticker);
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  if (!mounted) return <PageSkeleton />;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Star className="h-6 w-6 text-yellow-500 md:h-7 md:w-7" aria-hidden="true" />
            My Watchlist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {watchlist.length} {watchlist.length === 1 ? 'asset' : 'assets'} tracked
            {freshnessLabel && <span> · {freshnessLabel}</span>}
          </p>
        </div>
        {watchlist.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetchingAny}
            aria-busy={isFetchingAny}
            className="h-10 shrink-0 md:h-9"
          >
            <RefreshCw
              className={cn('h-4 w-4', isFetchingAny && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>
        )}
      </div>

      {/* Add ticker */}
      <Card className="glass">
        <CardContent className="p-4">
          <div ref={searchRef} className="relative">
            <form onSubmit={handleAddTicker} aria-label="Add ticker to watchlist" className="flex gap-2">
              <Input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded={suggestionsOpen}
                aria-controls={suggestionsOpen ? 'watchlist-suggestions' : undefined}
                aria-autocomplete="list"
                aria-activedescendant={
                  suggestionsOpen && activeIndex >= 0 ? `watchlist-option-${activeIndex}` : undefined
                }
                aria-label="Ticker symbol to add"
                placeholder="Add ticker (e.g., AAPL, GC=F, EURUSD=X)"
                autoComplete="off"
                value={newTicker}
                onChange={(e) => handleTickerInput(e.target.value)}
                onFocus={() => newTicker.trim().length >= 1 && setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                className="h-11 flex-1 md:h-10"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Add ticker"
                className="h-11 w-11 md:h-10 md:w-10"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>

            {/* Autocomplete Dropdown */}
            {suggestionsOpen && (
              <div
                id="watchlist-suggestions"
                role="listbox"
                aria-label="Ticker suggestions"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[50vh] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card shadow-xl"
              >
                {isSearching && suggestions.length === 0 && (
                  <div role="presentation" className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                      aria-hidden="true"
                    />
                    Searching...
                  </div>
                )}
                {suggestions.map((asset, index) => (
                  <button
                    key={asset.ticker}
                    id={`watchlist-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelectSuggestion(asset)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border-b border-border/30 px-4 py-3 text-left transition-colors last:border-0',
                      activeIndex === index ? 'bg-muted/60' : 'hover:bg-muted/50'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <TickerLogo ticker={asset.ticker} logoUrl={asset.logo_url} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{asset.ticker}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {asset.name}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {asset.asset_class}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Add Categories */}
      {hasCategories && (
        <Card className="glass">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick add by category
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categories!).map(([category, tickers]) => (
                <Button
                  key={category}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddCategory(tickers)}
                  className="h-10 capitalize"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watchlist */}
      <section aria-label="Watchlist assets" className="space-y-3">
        {hasError && watchlist.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{errorMessage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Retry
            </Button>
          </div>
        )}

        {watchlist.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card px-4 py-12 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
              <Star className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="mb-1.5 text-lg font-semibold">Add your first stock</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Track price, technical signal, risk, score and sentiment for the assets you care about.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Button onClick={focusSearch} className="h-11">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a stock
              </Button>
              {hasCategories &&
                Object.entries(categories!)
                  .slice(0, 3)
                  .map(([category, tickers]) => (
                    <Button
                      key={category}
                      variant="outline"
                      onClick={() => handleAddCategory(tickers)}
                      className="h-11 capitalize"
                    >
                      Add {category}
                    </Button>
                  ))}
            </div>
          </div>
        ) : initialLoading ? (
          <ListSkeletons />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map((row) => (
                <WatchlistCard
                  key={row.ticker}
                  row={row}
                  isFetching={isFetchingAny}
                  onRemove={handleRemoveTicker}
                />
              ))}
            </div>
            <WatchlistTable rows={rows} isFetching={isFetchingAny} onRemove={handleRemoveTicker} />
          </>
        )}
      </section>
    </div>
  );
}
