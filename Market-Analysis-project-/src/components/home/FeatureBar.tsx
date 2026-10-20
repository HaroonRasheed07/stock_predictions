'use client';

import { Compass, LineChart, Newspaper, Brain } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const FEATURES = [
  {
    key: 'brief',
    icon: Compass,
    label: 'Stock Brief',
    desc: 'Price, trend, risk and outlook in one view',
    tab: 'brief',
    href: '#explore',
  },
  {
    key: 'technical',
    icon: LineChart,
    label: 'Technical',
    desc: 'RSI, MACD, ATR, bands & moving averages',
    tab: 'technical',
    href: '#explore',
  },
  {
    key: 'news',
    icon: Newspaper,
    label: 'News Sentiment',
    desc: 'Headline scoring, share bar & mood',
    tab: 'news',
    href: '#explore',
  },
  {
    key: 'forecast',
    icon: Brain,
    label: 'Forecast',
    desc: 'Direction-only outlook for the next 10 days',
    tab: 'forecast',
    href: '#explore',
  },
] as const;

/** Section 3 — feature bar; cards jump to the matching explorer tab. */
export function FeatureBar() {
  const handleFeature = (f: (typeof FEATURES)[number]) => {
    trackEvent('explorer_tab_click', { tab: f.tab, source: 'feature_bar' });
    window.dispatchEvent(new CustomEvent('sv:explore-tab', { detail: { tab: f.tab } }));
  };

  return (
    <section id="features" aria-label="Research features" className="container mx-auto px-4 pb-2 pt-8 md:pt-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <a
              key={f.key}
              href={f.href}
              onClick={() => handleFeature(f)}
              className="rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold">{f.label}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{f.desc}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
