'use client';

import Link from 'next/link';
import { LineChart, Newspaper, Brain, Shield } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const FEATURES = [
  {
    key: 'technical',
    icon: LineChart,
    label: 'Technical signals',
    desc: 'RSI, MACD, moving averages & bands',
    tab: 'technical',
    href: '#explore',
  },
  {
    key: 'news',
    icon: Newspaper,
    label: 'News sentiment',
    desc: 'Headline scoring, drivers & mood',
    tab: 'news',
    href: '#explore',
  },
  {
    key: 'forecast',
    icon: Brain,
    label: '10-day forecast',
    desc: 'Model outlook with honest errors',
    tab: 'forecast',
    href: '#explore',
  },
  {
    key: 'risk',
    icon: Shield,
    label: 'Risk & volatility',
    desc: 'Risk levels, volatility & ranges',
    tab: null,
    href: '/markets/brief',
  },
] as const;

/** Section 3 — feature bar; first three jump to the matching explorer tab. */
export function FeatureBar() {
  const handleFeature = (f: (typeof FEATURES)[number]) => {
    if (!f.tab) return;
    trackEvent('explorer_tab_click', { tab: f.tab, source: 'feature_bar' });
    window.dispatchEvent(new CustomEvent('sv:explore-tab', { detail: { tab: f.tab } }));
  };

  return (
    <section id="features" aria-label="Research features" className="container mx-auto px-4 pb-2 pt-8 md:pt-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const inner = (
            <>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold">{f.label}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{f.desc}</span>
            </>
          );
          if (f.tab) {
            return (
              <a
                key={f.key}
                href={f.href}
                onClick={() => handleFeature(f)}
                className="rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card"
              >
                {inner}
              </a>
            );
          }
          return (
            <Link
              key={f.key}
              href={f.href}
              className="rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
