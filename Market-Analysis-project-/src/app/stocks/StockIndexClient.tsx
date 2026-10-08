'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search, Loader2, ArrowRight, SearchX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StockAllowlistEntry } from '@/lib/stock-allowlist';
import { fetchAssetSearch, type AssetInfo } from '@/lib/api';
import { isValidSymbolPath, toUrlSymbol } from '@/lib/ticker-routing';
import { TickerLogo } from '@/components/common/TickerLogo';

export function StockIndexClient({ stocks }: { stocks: StockAllowlistEntry[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState<AssetInfo[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = search
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.sector.toLowerCase().includes(search.toLowerCase())
      )
    : stocks;

  const sectors = [...new Set(stocks.map((s) => s.sector))].sort();
  const query = search.trim();
  const directSymbol = query && isValidSymbolPath(query) ? query.toUpperCase() : null;

  // When the curated list has no match, fall back to the same symbol-resolution
  // service the app uses so any valid ticker stays researchable from here.
  const needsRemote = query.length > 0 && filtered.length === 0;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRemote([]);
    setRemoteError(false);
    if (!needsRemote) {
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchAssetSearch(query, true);
        setRemote(data.slice(0, 6));
        setRemoteError(false);
      } catch {
        setRemote([]);
        setRemoteError(true);
      } finally {
        setRemoteLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [needsRemote, query]);

  const openResearch = useCallback(
    (symbol: string) => {
      router.push(`/stocks/${toUrlSymbol(symbol)}`);
    },
    [router]
  );

  const remoteNotListed = remote.filter(
    (r) => !stocks.some((s) => s.symbol.toLowerCase() === r.ticker.toLowerCase())
  );
  const showDirect =
    directSymbol !== null &&
    !stocks.some((s) => s.symbol.toLowerCase() === directSymbol.toLowerCase());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query) {
      e.preventDefault();
      if (filtered.length > 0) {
        router.push(`/stocks/${filtered[0].symbol.toLowerCase()}`);
      } else if (remoteNotListed.length > 0) {
        openResearch(remoteNotListed[0].ticker);
      } else if (directSymbol) {
        openResearch(directSymbol);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks by name, symbol, or sector..."
            aria-label="Search the stock directory"
            className="pl-10"
          />
          {remoteLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {query
            ? `${filtered.length} directory match${filtered.length === 1 ? '' : 'es'}${needsRemote ? ' — checking the wider market…' : ''}`
            : `Showing all ${stocks.length} stocks in the curated directory.`}
        </p>
      </div>

      {sectors.map((sector) => {
        const sectorStocks = filtered.filter((s) => s.sector === sector);
        if (sectorStocks.length === 0) return null;
        return (
          <div key={sector}>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">{sector}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sectorStocks.map((stock) => (
                <Link
                  key={stock.symbol}
                  href={`/stocks/${stock.symbol.toLowerCase()}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div>
                    <p className="font-bold">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">{stock.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {stock.industry}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {/* Market-wide fallback: keep every valid ticker researchable from the directory. */}
      {needsRemote && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-md font-semibold mb-3">Outside the curated directory</h2>
          {remoteNotListed.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {remoteNotListed.map((asset) => (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => openResearch(asset.ticker)}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4 text-left hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TickerLogo ticker={asset.ticker} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold">{asset.ticker}</p>
                      <p className="text-sm text-muted-foreground truncate">{asset.name}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              {!remoteLoading && !remoteError && (
                <p className="flex items-center gap-2">
                  <SearchX className="h-4 w-4 shrink-0" />
                  No stocks match “{query}”.
                </p>
              )}
              {remoteError && (
                <p>Market search is temporarily unavailable — try again shortly.</p>
              )}
              {showDirect && directSymbol && (
                <button
                  type="button"
                  onClick={() => openResearch(directSymbol)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium hover:border-primary/20 hover:text-primary transition-all"
                >
                  Research {directSymbol} anyway <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!query && (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
          This is the curated universe of {stocks.length} stocks with dedicated research pages. Want a different
          ticker? Use the search above — any symbol supported by the market data service can still be researched.
        </div>
      )}
    </div>
  );
}
