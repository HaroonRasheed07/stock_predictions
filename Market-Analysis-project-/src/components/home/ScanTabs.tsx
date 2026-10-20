'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radar, ChevronDown, TrendingUp, Activity, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct, formatPrice, changeTone } from '@/components/home/format';
import { trackEvent } from '@/lib/analytics';
import { fetchMarketOverview, type DiscoverStock } from '@/lib/api';
import type { ScanBuckets, RsiRow } from '@/lib/home-data';
import { Sparkline } from '@/components/home/Sparkline';

type TabKey = 'movers' | 'oversold' | 'overbought' | 'highRisk';

const TABS: Array<{ key: TabKey; label: string; icon: typeof TrendingUp }> = [
  { key: 'movers', label: 'Biggest moves', icon: TrendingUp },
  { key: 'oversold', label: 'Oversold', icon: Activity },
  { key: 'overbought', label: 'Overbought', icon: Activity },
  { key: 'highRisk', label: 'High risk', icon: ShieldAlert },
];

function RsiBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = value < 40 ? 'bg-success' : value > 60 ? 'bg-destructive' : 'bg-muted-foreground/70';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted/70" aria-hidden="true">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 left-[30%] w-px bg-border" />
        <span className="absolute inset-y-0 left-[70%] w-px bg-border" />
      </div>
      <span className="text-xs font-semibold tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function StockRow({ s, rank, spark }: { s: DiscoverStock; rank: number; spark?: number[] }) {
  return (
    <li>
      <Link
        href={`/stocks/${s.ticker.toLowerCase()}`}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">{rank}</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold">{s.ticker}</span>
            <span className="ml-2 truncate text-xs text-muted-foreground">{s.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Sparkline points={spark} width={72} height={22} className="hidden sm:block" ariaLabel={`${s.ticker} recent price trend`} />
          <span className="text-sm tabular-nums text-foreground/80">${formatPrice(s.price)}</span>
          <span className={cn('w-16 text-right text-sm font-semibold tabular-nums', changeTone(s.changePercent))}>
            {formatPct(s.changePercent)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function RsiRowEntry({ r, rank, side, spark }: { r: RsiRow; rank: number; side: 'low' | 'high'; spark?: number[] }) {
  return (
    <li>
      <Link
        href={`/stocks/${r.ticker.toLowerCase()}`}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">{rank}</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold">{r.ticker}</span>
            <span className="ml-2 truncate text-xs text-muted-foreground">{r.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Sparkline points={spark} width={72} height={22} className="hidden md:block" ariaLabel={`${r.ticker} recent price trend`} />
          <span className={cn('w-16 text-right text-sm font-semibold tabular-nums', changeTone(r.changePercent))}>
            {formatPct(r.changePercent)}
          </span>
          <RsiBar value={r.rsi} />
          <span className="hidden w-14 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:block">
            {side === 'low' ? 'RSI low' : 'RSI high'}
          </span>
        </div>
      </Link>
    </li>
  );
}

function HighRiskCard({ stocks, sparks, ranks }: { stocks: DiscoverStock[]; sparks: Record<string, number[]>; ranks: Record<string, number> }) {
  const [openTicker, setOpenTicker] = useState<string | null>(stocks[0]?.ticker ?? null);
  return (
    <div className="space-y-2">
      {stocks.map((s) => {
        const open = openTicker === s.ticker;
        return (
          <div key={s.ticker} className="rounded-xl border border-destructive/25 bg-destructive/[0.04]">
            <button
              type="button"
              onClick={() => setOpenTicker(open ? null : s.ticker)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">
                  {ranks[s.ticker] ?? ''}
                </span>
                <span className="text-sm font-semibold">{s.ticker}</span>
                <span className="truncate text-xs text-muted-foreground">{s.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <Sparkline points={sparks[s.ticker]} width={64} height={20} className="hidden lg:block" ariaLabel={`${s.ticker} recent price trend`} />
                <span className={cn('text-sm font-semibold tabular-nums', changeTone(s.changePercent))}>
                  {formatPct(s.changePercent)}
                </span>
                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                  High risk
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
              </span>
            </button>
            {open && (
              <div className="border-t border-destructive/20 px-4 py-3 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <div>
                    <span className="block font-semibold text-foreground/80">Price</span>${formatPrice(s.price)}
                  </div>
                  <div>
                    <span className="block font-semibold text-foreground/80">Technical</span>
                    {s.technical || 'Neutral'}
                  </div>
                  <div>
                    <span className="block font-semibold text-foreground/80">Sentiment</span>
                    {s.sentiment || 'Neutral'}
                  </div>
                  <div>
                    <span className="block font-semibold text-foreground/80">Scan score</span>
                    {typeof s.score === 'number' ? s.score.toFixed(0) : '—'}
                  </div>
                </div>
                <p className="mt-2">
                  Risk flagged from the volatility scan. This is a risk label, not a recommendation.
                </p>
                <Link href={`/stocks/${s.ticker.toLowerCase()}`} className="mt-2 inline-block font-medium text-primary hover:underline">
                  Open full risk analysis →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Section 6 — scan tabs built from the real discover + opportunity scans. */
export function ScanTabs({ scan, discoverAvailable }: { scan: ScanBuckets | null; discoverAvailable: boolean }) {
  const [tab, setTab] = useState<TabKey>('movers');
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    const tickers =
      tab === 'movers'
        ? scan.movers.map((s) => s.ticker)
        : tab === 'oversold'
          ? scan.oversold.map((r) => r.ticker)
          : tab === 'overbought'
            ? scan.overbought.map((r) => r.ticker)
            : scan.highRisk.map((s) => s.ticker);

    for (const ticker of tickers) {
      if (fetchedRef.current.has(ticker)) continue;
      fetchedRef.current.add(ticker);
      (async () => {
        try {
          const ov = await fetchMarketOverview(ticker, '1mo');
          const rows = Array.isArray(ov?.data) ? ov.data : [];
          const closes = rows
            .map((r) => Number((r as Record<string, unknown>)?.Close))
            .filter((c) => isFinite(c))
            .slice(-20);
          if (!cancelled && closes.length >= 2) {
            setSparks((prev) => ({ ...prev, [ticker]: closes }));
          }
        } catch {
          // Keep the dashed placeholder — sparkline is a progressive enhancement.
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [tab, scan]);

  if (!scan) {
    return (
      <section id="scan" aria-labelledby="scan-heading" className="container mx-auto px-4 py-10 md:py-14">
        <h2 id="scan-heading" className="text-xl font-semibold md:text-2xl">
          Scan the universe
        </h2>
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          The market scan is refreshing for this snapshot.
          <span className="ml-2 inline-block rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
            data delayed
          </span>
        </div>
      </section>
    );
  }

  const active = TABS.find((t) => t.key === tab)!;
  const select = (key: TabKey) => {
    setTab(key);
    trackEvent('scan_tab_click', { tab: key });
  };

  const emptyCopy: Record<TabKey, string> = {
    movers: 'No daily movers in this snapshot.',
    oversold: 'No oversold names right now (RSI below 40 across the tracked universe).',
    overbought: 'No overbought names right now (RSI above 60 across the tracked universe).',
    highRisk: 'No names flagged High risk in this scan.',
  };

  return (
    <section id="scan" aria-labelledby="scan-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="scan-heading" className="text-xl font-semibold md:text-2xl">
              Scan the universe
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {discoverAvailable ? 'Live snapshot across the tracked universe.' : 'Last cached snapshot.'}
            </p>
          </div>
        </div>
        <Link href="/stocks" className="text-sm font-medium text-primary hover:underline">
          Full directory →
        </Link>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        One snapshot, four views: {scan.movers.length} biggest movers · {scan.oversold.length} oversold (RSI below
        40) · {scan.overbought.length} overbought (RSI above 60) · {scan.highRisk.length} high-risk.
      </p>

      <div
        role="tablist"
        aria-label="Scan categories"
        className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => select(t.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors md:text-sm',
                isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {active.label}
        </div>
        {tab === 'movers' && scan.movers.length > 0 && (
          <ul className="divide-y divide-border/40">
            {scan.movers.map((s, i) => (
              <StockRow key={s.ticker} s={s} rank={i + 1} spark={sparks[s.ticker]} />
            ))}
          </ul>
        )}
        {tab === 'oversold' && scan.oversold.length > 0 && (
          <ul className="divide-y divide-border/40">
            {scan.oversold.map((r, i) => (
              <RsiRowEntry key={r.ticker} r={r} rank={i + 1} side="low" spark={sparks[r.ticker]} />
            ))}
          </ul>
        )}
        {tab === 'overbought' && scan.overbought.length > 0 && (
          <ul className="divide-y divide-border/40">
            {scan.overbought.map((r, i) => (
              <RsiRowEntry key={r.ticker} r={r} rank={i + 1} side="high" spark={sparks[r.ticker]} />
            ))}
          </ul>
        )}
        {tab === 'highRisk' && scan.highRisk.length > 0 && (
          <div className="p-3">
            <HighRiskCard
              stocks={scan.highRisk}
              sparks={sparks}
              ranks={Object.fromEntries(scan.highRisk.map((s, i) => [s.ticker, i + 1]))}
            />
          </div>
        )}
        {((tab === 'movers' && scan.movers.length === 0) ||
          (tab === 'oversold' && scan.oversold.length === 0) ||
          (tab === 'overbought' && scan.overbought.length === 0) ||
          (tab === 'highRisk' && scan.highRisk.length === 0)) && (
          <p className="px-4 py-6 text-sm text-muted-foreground">{emptyCopy[tab]}</p>
        )}
      </div>
    </section>
  );
}
