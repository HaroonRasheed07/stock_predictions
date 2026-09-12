'use client';

import { useRouter } from 'next/navigation';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  TrendingUp,
  BarChart3,
  LineChart,
  MessageSquare,
  Activity,
  Settings,
  Info,
  Shield,
  Moon,
  Sun,
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

const MENU_ITEMS = [
  {
    section: 'Research',
    items: [
      { label: 'Stock Brief', desc: 'AI-powered stock intelligence', icon: TrendingUp, href: '/markets/brief' },
      { label: 'Discover', desc: 'Find opportunities', icon: BarChart3, href: '/markets/discover' },
      { label: 'Watchlist', desc: 'Monitor your stocks', icon: Star, href: '/markets/stock/watchlist' },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { label: 'Technical Analysis', desc: 'Indicators and charts', icon: LineChart, href: '/markets/stock/technical' },
      { label: 'Sentiment', desc: 'News and market mood', icon: MessageSquare, href: '/markets/stock/sentiment' },
      { label: 'Forecasting', desc: 'AI price predictions', icon: Activity, href: '/markets/stock/forecast' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { label: 'About', desc: 'About MarketPulse', icon: Info, href: '/about' },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const { watchlist } = useWatchlistStore();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">More</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {watchlist.length} stocks in watchlist
        </p>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="flex items-center justify-between w-full rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
          <div className="text-left">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground capitalize">{theme} mode</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">{theme === 'dark' ? 'Dark' : 'Light'}</Badge>
      </button>

      {/* Menu Sections */}
      {MENU_ITEMS.map((section) => (
        <div key={section.section}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            {section.section}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-3 w-full rounded-xl border border-border/60 bg-card p-3.5 shadow-sm hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">MarketPulse v1.0</p>
        <p className="text-xs text-muted-foreground">AI-Powered Stock Intelligence</p>
      </div>

      <div className="h-8" />
    </div>
  );
}
