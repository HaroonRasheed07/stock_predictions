'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Star, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWatchlistStore } from '@/store/watchlistStore';
import { StockSearch } from '@/components/common/StockSearch';
import { formatPct, formatPrice, changeTone } from '@/components/home/format';
import { trackEvent } from '@/lib/analytics';
import { fetchDiscoverScan, type DiscoverStock } from '@/lib/api';

async function loadQuotes(tickers: string[]): Promise<Record<string, DiscoverStock>> {
  const out: Record<string, DiscoverStock> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += 10) chunks.push(tickers.slice(i, i + 10));
  const results = await Promise.allSettled(chunks.map((c) => fetchDiscoverScan(c)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value?.stocks) Object.assign(out, r.value.stocks);
  }
  return out;
}

const SUGGESTED = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN'];

/** Section 9 — persistent watchlist (shared store with the rest of the app). */
export function WatchlistSection() {
  const watchlist = useWatchlistStore((s) => s.watchlist);
  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const [mounted, setMounted] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, DiscoverStock>>({});
  const [fetchFailed, setFetchFailed] = useState(false);
  const requestKey = useRef('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || watchlist.length === 0) return;
    const key = [...watchlist].sort().join(',');
    if (requestKey.current === key) return;
    requestKey.current = key;
    let cancelled = false;
    loadQuotes(watchlist)
      .then((rows) => {
        if (cancelled) return;
        setQuotes((prev) => ({ ...prev, ...rows }));
        setFetchFailed(Object.keys(rows).length === 0);
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, watchlist]);

  const handleAdd = (ticker: string) => {
    const t = ticker.toUpperCase();
    if (watchlist.includes(t)) return;
    addToWatchlist(t);
    trackEvent('watchlist_add', { ticker: t, source: 'homepage' });
    requestKey.current = '';
  };

  return (
    <section id="watchlist" aria-labelledby="watchlist-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 id="watchlist-heading" className="text-xl font-semibold md:text-2xl">
                Your watchlist
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved in this browser — track a few symbols and watch them across visits.
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {mounted ? `${watchlist.length} symbol${watchlist.length === 1 ? '' : 's'}` : '—'}
          </span>
        </div>

        {/* Add row */}
        <div className="mt-4 max-w-md">
          <div className="flex items-center gap-2">
            <StockSearch
              inputId="watchlist-search"
              label="Add a symbol to your watchlist"
              placeholder="Add a ticker to your watchlist…"
              onSelect={handleAdd}
              className="flex-1"
            />
          </div>
        </div>

        {!mounted ? (
          <ul className="mt-5 space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3">
                <span className="h-3 w-10 rounded bg-muted/70" />
                <span className="h-3 flex-1 rounded bg-muted/50" />
                <span className="h-3 w-14 rounded bg-muted/60" />
              </li>
            ))}
          </ul>
        ) : watchlist.length === 0 ? (
          <div className="mt-5">
            <p className="text-sm text-muted-foreground">
              No symbols tracked yet — add one above and its daily move will stay with you across visits.
            </p>
            <span className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Try a starter
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED.filter((t) => !watchlist.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-label={`Add ${t} to watchlist`}
                  onClick={() => handleAdd(t)}
                  className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {watchlist.map((t) => {
              const q = quotes[t];
              const change = q?.changePercent ?? null;
              return (
                <li
                  key={t}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-3"
                >
                  <Link href={`/stocks/${t.toLowerCase()}`} className="min-w-0 flex-1">
                    <span className="text-sm font-semibold">{t}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {q?.name || '—'}
                    </span>
                  </Link>
                  <span className="hidden w-24 text-right text-sm tabular-nums text-foreground/80 sm:block">
                    {q ? `$${formatPrice(q.price)}` : '—'}
                  </span>
                  <span className={cn('w-16 text-right text-sm font-semibold tabular-nums', changeTone(change))}>
                    {q ? formatPct(change) : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(t)}
                    aria-label={`Remove ${t} from watchlist`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {mounted && fetchFailed && watchlist.length > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Quotes are syncing for your watchlist.
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
              Syncing
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
