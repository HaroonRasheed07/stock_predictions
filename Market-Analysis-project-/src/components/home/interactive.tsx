'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Star, Plus, ArrowRight, LineChart, Newspaper, Brain, Shield } from 'lucide-react';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { StockSearch } from '@/components/common/StockSearch';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { toUrlSymbol } from '@/lib/ticker-routing';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'GOOGL'];
const SUGGESTED_TICKERS = ['META', 'AMD', 'JPM', 'XOM', 'JNJ'];

const WHAT_YOU_GET = [
  { icon: LineChart, label: 'Technical signals', href: '/markets/stock/technical' },
  { icon: Newspaper, label: 'News sentiment', href: '/markets/stock/sentiment' },
  { icon: Brain, label: '10-day model forecast', href: '/markets/stock/forecast' },
  { icon: Shield, label: 'Risk & volatility', href: '/markets/brief' },
];

/** Fires the single required homepage_view event (gtag lives in analytics.ts). */
export function HomeAnalytics() {
  useEffect(() => {
    trackEvent('homepage_view');
  }, []);
  return null;
}

function useGoToStock() {
  const router = useRouter();
  const { setSelectedTicker } = useStockStore();
  return (ticker: string, source = 'direct') => {
    trackEvent('stock_selected', { ticker, source });
    setSelectedTicker(ticker);
    router.push(`/stocks/${toUrlSymbol(ticker)}`);
  };
}

/**
 * Hero search block: shared StockSearch + "/" keyboard shortcut + research
 * tool chips + popular ticker shortcuts (all with tracked navigation).
 */
export function HomeHeroSearch() {
  const goToStock = useGoToStock();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
      }
      const input = wrapRef.current?.querySelector('input');
      if (input) {
        e.preventDefault();
        input.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={wrapRef}>
      <div className="max-w-xl mx-auto mb-5">
        <StockSearch
          label="Search stocks"
          placeholder="Search any stock ticker or company…"
          className="[&_input]:h-14 [&_input]:rounded-2xl [&_input]:bg-background/80 [&_input]:border-border/60 [&_input]:shadow-lg"
          onSelect={(t) => goToStock(t, 'search')}
        />
      </div>

      <nav aria-label="Research tools" className="flex flex-wrap items-center justify-center gap-2 mb-5">
        {WHAT_YOU_GET.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
          >
            <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Popular:</span>
        {POPULAR_TICKERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => goToStock(t, 'popular')}
            className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
            aria-label={`Analyze ${t}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Link that records stock_selected with a source before navigating. */
export function TrackedLink({
  href,
  ticker,
  source,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  ticker?: string;
  source: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const { setSelectedTicker } = useStockStore();
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        if (ticker) {
          trackEvent('stock_selected', { ticker, source });
          setSelectedTicker(ticker);
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Opens the research brief the way the old client hero did (tracked). */
export function BriefOpenButton({ ticker }: { ticker: string }) {
  const router = useRouter();
  const { setSelectedTicker } = useStockStore();
  return (
    <button
      type="button"
      onClick={() => {
        trackEvent('brief_opened', { ticker });
        setSelectedTicker(ticker);
        router.push('/markets/brief');
      }}
      className="w-full flex items-center justify-center gap-1.5 text-sm text-primary font-medium hover:gap-2.5 transition-all group"
      aria-label={`View full Research Brief for ${ticker}`}
    >
      View Full Research Brief
      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}

/**
 * Watchlist preview — stays browser-saved (zustand persist), no accounts.
 * Suggested chips offer one-click adds for stocks not yet on the list.
 */
export function WatchlistSection() {
  const goToStock = useGoToStock();
  const { watchlist, addToWatchlist, isInWatchlist } = useWatchlistStore();
  const suggestions = SUGGESTED_TICKERS.filter((t) => !isInWatchlist(t)).slice(0, 5);

  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="watchlist-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 id="watchlist-heading" className="text-xl font-bold">Your Watchlist</h2>
                <p className="text-sm text-muted-foreground">
                  Saved in this browser — track and revisit stocks you&apos;re researching. No account needed.
                </p>
              </div>
            </div>

            {watchlist.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {watchlist.slice(0, 8).map((ticker) => (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => goToStock(ticker, 'watchlist')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm hover:border-primary/20 hover:text-primary transition-all"
                  >
                    <TickerLogo ticker={ticker} size="sm" />
                    <span className="font-semibold">{ticker}</span>
                  </button>
                ))}
                {watchlist.length > 8 && (
                  <span className="inline-flex items-center px-3 py-2 text-sm text-muted-foreground">
                    +{watchlist.length - 8} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Your watchlist is empty. Search for a stock above, or add one of the suggestions below.
              </p>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5 pb-4 border-b border-border/40">
                <span className="text-xs text-muted-foreground">Suggested:</span>
                {suggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      addToWatchlist(t);
                      trackEvent('stock_selected', { ticker: t, source: 'watchlist' });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                    aria-label={`Add ${t} to watchlist`}
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    {t}
                  </button>
                ))}
              </div>
            )}

            <Link href="/markets/stock/watchlist">
              <Button variant="outline" className="border-primary/30 hover:bg-primary/10 gap-2">
                <Star className="h-4 w-4" />
                {watchlist.length > 0 ? 'Manage Watchlist' : 'Set Up Watchlist'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
