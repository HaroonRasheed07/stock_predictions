'use client';

import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, LineChart, MessageSquare, Activity, Star, Search, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const subPages = [
  { title: 'Stock Brief', path: '/markets/brief', icon: FileText },
  { title: 'Overview', path: '/markets/stock', icon: BarChart3 },
  { title: 'Discover', path: '/markets/discover', icon: Search },
  { title: 'Technical', path: '/markets/stock/technical', icon: LineChart },
  { title: 'Sentiment', path: '/markets/stock/sentiment', icon: MessageSquare },
  { title: 'Forecast', path: '/markets/stock/forecast', icon: Activity },
  { title: 'Watchlist', path: '/markets/stock/watchlist', icon: Star },
];

export function MarketsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Sidebar — Desktop only */}
          <aside className="hidden lg:block lg:w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Markets</h3>
                </div>
                <nav className="space-y-0.5">
                  {subPages.map((subPage) => {
                    const isActive = pathname === subPage.path;
                    const Icon = subPage.icon;
                    return (
                      <Link key={subPage.path} href={subPage.path}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'w-full justify-start gap-2 text-sm font-medium transition-colors duration-150',
                            isActive
                              ? 'bg-primary/5 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {subPage.title}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Market Status */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3 px-2">Market Status</h3>
                <div className="flex items-center gap-2 px-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  <span className="text-sm text-muted-foreground">Markets Open</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content — with bottom nav spacer on mobile */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
