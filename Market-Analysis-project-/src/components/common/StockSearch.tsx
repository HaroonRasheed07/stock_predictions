'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, SearchX, ArrowRight } from 'lucide-react';
import { fetchAssetSearch, type AssetInfo } from '@/lib/api';
import { isValidSymbolPath, toUrlSymbol } from '@/lib/ticker-routing';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StockSearchProps {
  /** Called instead of the default navigation when provided. */
  onSelect?: (ticker: string) => void;
  placeholder?: string;
  /** Visible/aria label for the input. */
  label?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Debounced ticker/company autocomplete backed by the same symbol-resolution
 * service the rest of the app uses (`fetchAssetSearch`). Selecting a result
 * navigates straight to that stock's research page.
 */
export function StockSearch({
  onSelect,
  placeholder = 'Search a ticker or company…',
  label = 'Search stocks',
  className,
  autoFocus,
}: StockSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = 'stock-search-results';

  const directSymbol = isValidSymbolPath(query.trim()) ? query.trim().toUpperCase() : null;
  // Offer a direct research link only when the provider returned nothing —
  // otherwise the typed ticker should already be among the remote results.
  const showDirect = Boolean(directSymbol) && results.length === 0;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    setError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 1) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchAssetSearch(value.trim(), true);
        setResults(data.slice(0, 8));
        setError(false);
      } catch {
        setResults([]);
        setError(true);
      } finally {
        setLoading(false);
        setOpen(true);
      }
    }, 300);
  }, []);

  const navigate = useCallback(
    (ticker: string) => {
      setOpen(false);
      setQuery('');
      setResults([]);
      setActiveIndex(-1);
      if (onSelect) {
        onSelect(ticker);
      } else {
        router.push(`/stocks/${toUrlSymbol(ticker)}`);
      }
    },
    [onSelect, router]
  );

  const totalOptions = results.length + (showDirect ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && totalOptions > 0) setOpen(true);
      setActiveIndex((i) => (totalOptions === 0 ? -1 : i < totalOptions - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (totalOptions === 0 ? -1 : i <= 0 ? totalOptions - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        navigate(results[activeIndex].ticker);
      } else if (showDirect && directSymbol) {
        navigate(directSymbol);
      } else if (results.length > 0) {
        navigate(results[0].ticker);
      }
    }
  };

  const showPanel = open && query.trim().length > 0 && (results.length > 0 || loading || error || showDirect);

  return (
    <div className={cn('relative w-full', className)}>
      <label htmlFor="stock-search-input" className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="stock-search-input"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          onBlur={() => {
            // Let clicks on results register before closing.
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && activeIndex < results.length ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-label={label}
          className="pl-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label="Stock search results"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-card shadow-xl"
        >
          {results.map((r, i) => (
            <button
              key={`${r.ticker}-${i}`}
              id={`${listId}-option-${i}`}
              type="button"
              role="option"
              aria-selected={activeIndex === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigate(r.ticker)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                activeIndex === i ? 'bg-muted/60' : 'hover:bg-muted/40'
              )}
            >
              <TickerLogo ticker={r.ticker} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.ticker}</p>
                <p className="truncate text-xs text-muted-foreground">{r.name}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {showDirect && directSymbol && (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === results.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigate(directSymbol)}
              onMouseEnter={() => setActiveIndex(results.length)}
              className={cn(
                'flex w-full items-center gap-3 border-t border-border/40 px-4 py-3 text-left transition-colors',
                activeIndex === results.length ? 'bg-muted/60' : 'hover:bg-muted/40'
              )}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-[10px] font-bold">
                {directSymbol.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Research {directSymbol}</p>
                <p className="truncate text-xs text-muted-foreground">Open the research page for this ticker</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}

          {!loading && !error && results.length === 0 && !showDirect && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <SearchX className="h-4 w-4 shrink-0" />
              No matches for “{query.trim()}”
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Search is temporarily unavailable. {directSymbol ? 'Press Enter to open the research page.' : 'Try again shortly.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
