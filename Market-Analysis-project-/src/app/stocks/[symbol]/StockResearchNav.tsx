'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { normalizeStockView, type StockView } from '@/lib/ticker-routing';
import { cn } from '@/lib/utils';

interface NavItem {
  view: StockView;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'technical', label: 'Technical Analysis' },
  { view: 'sentiment', label: 'News Sentiment' },
  { view: 'risk', label: 'Risk Analysis' },
  { view: 'forecast', label: 'AI Forecast' },
];

function viewHref(symbol: string, view: StockView): string {
  const base = `/stocks/${symbol}`;
  return view === 'overview' ? base : `${base}?view=${view}#analysis`;
}

function NavLinks({ symbol, activeView }: { symbol: string; activeView: StockView | null }) {
  return (
    <nav aria-label="Research views" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex w-max min-w-full items-center gap-1 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          return (
            <li key={item.view}>
              <Link
                href={viewHref(symbol, item.view)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * View navigation for `/stocks/[symbol]`. The selected view lives in the URL
 * (`?view=`), so it is shareable and survives refresh; the URL always wins over
 * persisted state. Render inside a Suspense boundary with
 * `<StockResearchNavFallback>` as the fallback so the links exist in the
 * server-rendered HTML before hydration.
 */
export function StockResearchNav({ symbol }: { symbol: string }) {
  const searchParams = useSearchParams();
  const activeView = normalizeStockView(searchParams.get('view'));
  return <NavLinks symbol={symbol} activeView={activeView} />;
}

/** Server-rendered link list (no active state) used as the Suspense fallback. */
export function StockResearchNavFallback({ symbol }: { symbol: string }) {
  return <NavLinks symbol={symbol} activeView={null} />;
}
