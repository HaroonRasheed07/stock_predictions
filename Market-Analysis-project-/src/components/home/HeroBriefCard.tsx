'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Minus, Newspaper,
  Shield, Brain, ArrowDownRight, ArrowUpRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Button } from '@/components/ui/button';
import { formatPct, formatPrice, formatUpdated, changeTone } from '@/components/home/format';
import { HeroAreaChart } from '@/components/home/HeroAreaChart';
import { trackEvent } from '@/lib/analytics';
import { deriveOutlook, type ModelOutlook } from '@/lib/model-outlook';
import { getStockInfo } from '@/lib/stock-allowlist';
import {
  fetchMarketOverview,
  fetchIndicators,
  fetchForecast,
  fetchSentiment,
  type MarketOverviewResponse,
  type IndicatorsResponse,
  type ForecastResponse,
  type EnhancedSentiment,
} from '@/lib/api';
import type { HeroBundle } from '@/lib/home-data';
import { normalizeOverviewSentiment } from '@/lib/overview-sentiment';

type ChipData = { ticker: string; name: string; price: number; changePercent: number };

function Rail({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral' | 'muted';
}) {
  const tones = {
    positive: 'border-success/30 bg-success/10 text-success',
    negative: 'border-destructive/30 bg-destructive/10 text-destructive',
    neutral: 'border-border/60 bg-muted/50 text-foreground/80',
    muted: 'border-border/60 bg-muted/40 text-muted-foreground',
  };
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', tones[tone])}>
      <span aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide !text-foreground/70">{label}</span>
        <span className="block truncate text-xs font-bold !text-foreground">{value}</span>
      </span>
    </div>
  );
}

function outlookWord(o: ModelOutlook | null): string {
  if (!o) return '—';
  return o.direction === 'up' ? 'Model up' : o.direction === 'down' ? 'Model down' : 'Model flat';
}
function outlookTone(o: ModelOutlook | null): 'positive' | 'negative' | 'neutral' | 'muted' {
  if (!o) return 'muted';
  return o.direction === 'up' ? 'positive' : o.direction === 'down' ? 'negative' : 'neutral';
}
function trendTone(label: string): 'positive' | 'negative' | 'neutral' | 'muted' {
  const l = (label || '').toLowerCase();
  if (l.includes('bull')) return 'positive';
  if (l.includes('bear')) return 'negative';
  if (l.includes('up')) return 'positive';
  if (l.includes('down')) return 'negative';
  return 'neutral';
}
function sentimentTone(label: string): 'positive' | 'negative' | 'neutral' | 'muted' {
  const l = (label || '').toLowerCase();
  if (l.includes('positive') || l.includes('bull')) return 'positive';
  if (l.includes('negative') || l.includes('bear')) return 'negative';
  if (l.includes('neutral')) return 'neutral';
  return 'muted';
}
function riskTone(level: string): 'positive' | 'negative' | 'neutral' | 'muted' {
  const l = (level || '').toLowerCase();
  if (l === 'low') return 'positive';
  if (l === 'high') return 'negative';
  if (l === 'medium' || l === 'moderate') return 'neutral';
  return 'muted';
}

/** Computed from the four rails shown above: do they lean the same way? */
function signalNote(
  trend: string,
  sentiment: string,
  outlook: ModelOutlook | null,
  risk: string
): string {
  const dirs: number[] = [];
  const t = (trend || '').toLowerCase();
  if (t.includes('bull') || t.includes('up')) dirs.push(1);
  else if (t.includes('bear') || t.includes('down')) dirs.push(-1);
  const s = (sentiment || '').toLowerCase();
  if (s.includes('positive') || s.includes('bull')) dirs.push(1);
  else if (s.includes('negative') || s.includes('bear')) dirs.push(-1);
  if (outlook?.direction === 'up') dirs.push(1);
  else if (outlook?.direction === 'down') dirs.push(-1);
  const r = (risk || '').toLowerCase();
  if (r === 'low') dirs.push(1);
  else if (r === 'high') dirs.push(-1);

  const up = dirs.filter((d) => d === 1).length;
  const down = dirs.filter((d) => d === -1).length;
  const suffix = 'Evidence, not advice — compare the pipelines before you decide.';
  if (dirs.length < 2) {
    return `Evidence, not advice: trend, sentiment, risk and the model outlook come from separate pipelines — ${suffix}`;
  }
  if (up > 0 && down > 0) {
    return `Signals disagree: ${up} point up, ${down} point down. ${suffix}`;
  }
  const lean = up > 0 ? 'up' : 'down';
  return `Signals agree: ${Math.max(up, down)} of ${dirs.length} point ${lean}. ${suffix}`;
}

async function loadBundle(ticker: string, chips: ChipData[]): Promise<HeroBundle> {
  const [overview, indicators, forecast, sentiment] = await Promise.allSettled([
    fetchMarketOverview(ticker, '6mo'),
    fetchIndicators(ticker, '1y'),
    fetchForecast(ticker, 10, '1y'),
    fetchSentiment(ticker),
  ]);
  const ov = overview.status === 'fulfilled' ? overview.value : null;
  const ind = indicators.status === 'fulfilled' ? indicators.value : null;
  const fc = forecast.status === 'fulfilled' ? forecast.value : null;
  const se = sentiment.status === 'fulfilled' ? sentiment.value : null;
  return {
    ticker,
    name: getStockInfo(ticker)?.name || ticker,
    overview: ov,
    indicators: ind,
    forecast: fc,
    sentiment: se ?? normalizeOverviewSentiment(ov?.sentiment),
    outlook: deriveOutlook(fc, ov?.currentPrice ?? null),
    discover: null,
    delayed: !ov,
  };
}

/** Section 2 — featured brief card + hero chart + rotating ticker chips. */
export function HeroBriefCard({
  hero,
  chips,
  updatedMinutesAgo,
}: {
  hero: HeroBundle;
  chips: ChipData[];
  updatedMinutesAgo: number | null;
}) {
  const [bundle, setBundle] = useState<HeroBundle>(hero);
  const [switching, setSwitching] = useState(false);

  const overview = bundle.overview;
  const chipRow = chips.find((c) => c.ticker === bundle.ticker);
  const price = overview?.currentPrice ?? chipRow?.price ?? 0;
  const changePct = overview?.changePercent ?? chipRow?.changePercent ?? null;
  const trendLabel = overview?.trendStrength?.trend_label || '—';
  const sentimentLabel = overview?.sentiment?.sentiment_label || bundle.sentiment?.sentiment_label || '—';
  const riskLevel = overview?.risk?.risk_level || '—';
  const updated = formatUpdated(updatedMinutesAgo);
  const rows = Array.isArray(overview?.data) ? overview!.data : [];
  const note = signalNote(trendLabel, sentimentLabel, bundle.outlook, riskLevel);

  const selectTicker = async (ticker: string) => {
    if (ticker === bundle.ticker || switching) return;
    trackEvent('ticker_chip_click', { ticker });
    setSwitching(true);
    try {
      const next = await loadBundle(ticker, chips);
      setBundle(next);
    } finally {
      setSwitching(false);
    }
  };

  const focusSearch = () => {
    trackEvent('search_usage', { source: 'hero_cta' });
    const el = document.getElementById('hero-search');
    if (el) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      (el as HTMLInputElement).focus({ preventScroll: true });
    }
  };

  return (
    <div className={cn('transition-opacity duration-200', switching ? 'opacity-60' : 'opacity-100')} aria-busy={switching}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Brief card */}
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <TickerLogo ticker={bundle.ticker} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {bundle.ticker} · Research Brief
              </p>
              <h2 className="truncate text-base font-bold">{bundle.name}</h2>
            </div>
            <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              Today’s pick
            </span>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums">${formatPrice(price)}</span>
            <span className={cn('pb-1 text-sm font-semibold tabular-nums', changeTone(changePct))}>
              {formatPct(changePct)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {updated && <span>{updated}</span>}
            {!overview && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-medium text-muted-foreground">
                Latest quote
              </span>
            )}
          </div>

          {/* Evidence rails */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Rail
              icon={trendTone(trendLabel) === 'positive' ? <TrendingUp className="h-3.5 w-3.5" /> : trendTone(trendLabel) === 'negative' ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              label="Trend"
              value={trendLabel}
              tone={trendTone(trendLabel)}
            />
            <Rail icon={<Newspaper className="h-3.5 w-3.5" />} label="Sentiment" value={sentimentLabel} tone={sentimentTone(sentimentLabel)} />
            <Rail icon={<Shield className="h-3.5 w-3.5" />} label="Risk" value={riskLevel} tone={riskTone(riskLevel)} />
            <Rail
              icon={bundle.outlook?.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : bundle.outlook?.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
              label="Model outlook"
              value={outlookWord(bundle.outlook)}
              tone={outlookTone(bundle.outlook)}
            />
          </div>

          {/* CTAs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={focusSearch} className="gap-1.5">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Analyze a stock
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="#market-read">See today’s market read</a>
            </Button>
          </div>

          <p className="mt-4 border-t border-border/50 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {note}
          </p>
        </div>

        {/* Chart card */}
        <div className="rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <h2 className="text-sm font-semibold">Price chart</h2>
              <p className="text-[11px] text-muted-foreground">{bundle.ticker} · daily close, last 6 months</p>
            </div>
            <Link
              href={`/stocks/${bundle.ticker.toLowerCase()}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Full analysis →
            </Link>
          </div>
          <HeroAreaChart rows={rows} ticker={bundle.ticker} />
        </div>
      </div>

      {/* Ticker chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Switch symbol:</span>
        {chips.map((c) => {
          const active = c.ticker === bundle.ticker;
          return (
            <button
              key={c.ticker}
              type="button"
              onClick={() => selectTicker(c.ticker)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {c.ticker}
              {c.price > 0 && (
                <span className={cn('tabular-nums font-medium', changeTone(c.changePercent))}>
                  {formatPct(c.changePercent)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
