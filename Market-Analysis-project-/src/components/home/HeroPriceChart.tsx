'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import type { ChartOverlays } from './PriceChartInner';

const PriceChartInner = dynamic(() => import('./PriceChartInner'), {
  ssr: false,
  loading: () => null,
});

type RangeKey = '1M' | '3M' | '6M';

const RANGES: Array<{ key: RangeKey; days: number; rows: number }> = [
  { key: '1M', days: 31, rows: 22 },
  { key: '3M', days: 92, rows: 64 },
  { key: '6M', days: 184, rows: 126 },
];

const OVERLAY_DEFS: Array<{ key: keyof ChartOverlays; label: string; col: string }> = [
  { key: 'sma20', label: 'SMA 20', col: 'SMA20' },
  { key: 'sma50', label: 'SMA 50', col: 'SMA50' },
  { key: 'ema20', label: 'EMA 20', col: 'EMA20' },
];

function sliceRows(rows: Record<string, any>[], range: RangeKey): Record<string, any>[] {
  if (rows.length === 0) return rows;
  const def = RANGES.find((r) => r.key === range)!;
  const lastDate = new Date(String(rows[rows.length - 1]?.Date ?? ''));
  if (isNaN(lastDate.getTime())) {
    return rows.slice(Math.max(0, rows.length - def.rows));
  }
  const cutoff = lastDate.getTime() - def.days * 24 * 60 * 60 * 1000;
  const sliced = rows.filter((r) => {
    const t = new Date(String(r?.Date ?? '')).getTime();
    if (isNaN(t)) return false;
    return t >= cutoff;
  });
  return sliced.length >= 5 ? sliced : rows.slice(Math.max(0, rows.length - def.rows));
}

/** Static skeleton drawn from the real close series (replaced on chart mount). */
function ChartSkeleton({ rows, visible }: { rows: Record<string, any>[]; visible: boolean }) {
  const closes = useMemo(() => {
    const out: number[] = [];
    for (const r of rows) {
      const c = Number(r?.Close);
      if (isFinite(c)) out.push(c);
    }
    return out.slice(-140);
  }, [rows]);

  const hasData = closes.length >= 2;
  const min = hasData ? Math.min(...closes) : 0;
  const max = hasData ? Math.max(...closes) : 1;
  const span = max - min || 1;
  const W = 600;
  const H = 200;
  const pts = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * W;
      const y = H - ((c - min) / span) * (H - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 transition-opacity duration-300',
        visible ? 'opacity-0' : 'opacity-100'
      )}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
        ))}
        {hasData ? (
          <polyline points={pts} fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ) : (
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="6 6" />
        )}
      </svg>
    </div>
  );
}

/**
 * Hero price chart: range tabs, SMA/EMA overlay toggles, real-data SSR
 * skeleton, IntersectionObserver-gated dynamic import of lightweight-charts.
 */
export function HeroPriceChart({
  rows,
  ticker,
}: {
  rows: Record<string, any>[];
  ticker: string;
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [range, setRange] = useState<RangeKey>('6M');
  const [overlays, setOverlays] = useState<ChartOverlays>({ sma20: false, sma50: false, ema20: false });
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sliced = useMemo(() => sliceRows(rows, range), [rows, range]);
  const availableCols = useMemo(() => {
    const present = new Set<string>();
    for (const r of rows) {
      for (const key of ['SMA20', 'SMA50', 'EMA20']) {
        if (typeof r?.[key] === 'number' && isFinite(r[key])) present.add(key);
      }
    }
    return present;
  }, [rows]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div role="tablist" aria-label="Chart range" className="flex gap-1 rounded-lg bg-muted/60 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                range === r.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {OVERLAY_DEFS.filter((o) => availableCols.has(o.col)).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={overlays[o.key]}
              onClick={() => setOverlays((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                overlays[o.key]
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-2 h-[240px] w-full grow md:h-[300px]">
        <ChartSkeleton rows={sliced} visible={ready && inView} />
        {inView && rows.length > 0 && (
          <PriceChartInner
            key={`${ticker}-${range}-${isDark}`}
            rows={sliced}
            isDark={isDark}
            overlays={overlays}
            onReady={() => setReady(true)}
          />
        )}
        {rows.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Chart series unavailable for this snapshot</span>
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              data delayed
            </span>
          </div>
        )}
      </div>
      <p className="px-4 pb-2 pt-1 text-[10px] text-muted-foreground">
        Charting by TradingView Lightweight Charts (Apache-2.0) · {ticker} · OHLC from the latest indicator snapshot.
      </p>
    </div>
  );
}
