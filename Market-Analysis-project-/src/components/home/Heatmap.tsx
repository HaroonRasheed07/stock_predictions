'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct, formatPrice, changeTone } from '@/components/home/format';
import type { DiscoverStock } from '@/lib/api';

function tileStyle(changePercent: number): React.CSSProperties {
  const ch = typeof changePercent === 'number' && isFinite(changePercent) ? changePercent : 0;
  const t = Math.min(Math.abs(ch) / 4, 1);
  const alpha = 0.12 + t * 0.7;
  return ch >= 0
    ? { backgroundColor: `rgba(22, 163, 74, ${alpha.toFixed(3)})` }
    : { backgroundColor: `rgba(220, 38, 38, ${alpha.toFixed(3)})` };
}

/** Section 8 — equal-size daily-move heatmap (CSS grid; tile size not price-weighted). */
export function Heatmap({ stocks, available }: { stocks: DiscoverStock[]; available: boolean }) {
  const sorted = useMemo(
    () =>
      [...stocks].sort(
        (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)
      ),
    [stocks]
  );
  const [selected, setSelected] = useState<string | null>(sorted[0]?.ticker ?? null);

  if (!available || sorted.length === 0) {
    return (
      <section id="heatmap" aria-labelledby="heatmap-heading" className="container mx-auto px-4 py-10 md:py-14">
        <h2 id="heatmap-heading" className="text-xl font-semibold md:text-2xl">
          Daily move heatmap
        </h2>
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          The heatmap refreshes with each scan.
          <span className="ml-2 inline-block rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
            data delayed
          </span>
        </div>
      </section>
    );
  }

  const sel = sorted.find((s) => s.ticker === selected) ?? sorted[0];

  return (
    <section id="heatmap" aria-labelledby="heatmap-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="heatmap-heading" className="text-xl font-semibold md:text-2xl">
              Daily move heatmap
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every tracked stock, today’s move — tiles are equal size, colored by session change.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'rgba(220,38,38,0.75)' }} aria-hidden="true" />
            down
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'rgba(22,163,74,0.75)' }} aria-hidden="true" />
            up
          </span>
        </div>
      </div>

      {/* Selection detail */}
      {sel && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
          <span className="font-bold">{sel.ticker}</span>
          <span className="truncate text-xs text-muted-foreground">{sel.name}</span>
          <span className="tabular-nums text-foreground/80">${formatPrice(sel.price)}</span>
          <span className={cn('font-semibold tabular-nums', changeTone(sel.changePercent))}>
            {formatPct(sel.changePercent)}
          </span>
          <span className="text-xs text-muted-foreground">Technical: {sel.technical || 'Neutral'}</span>
          <span className="text-xs text-muted-foreground">Sentiment: {sel.sentiment || 'Neutral'}</span>
          <Link href={`/stocks/${sel.ticker.toLowerCase()}`} className="ml-auto text-xs font-medium text-primary hover:underline">
            Open research →
          </Link>
        </div>
      )}

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}
        role="list"
        aria-label="Tracked stocks by daily change"
      >
        {sorted.map((s) => (
          <button
            key={s.ticker}
            type="button"
            role="listitem"
            aria-pressed={selected === s.ticker}
            aria-label={`${s.ticker}, ${formatPct(s.changePercent)}`}
            onClick={() => setSelected(s.ticker)}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-md border text-center transition-transform hover:scale-[1.04]',
              selected === s.ticker ? 'border-foreground/70 ring-1 ring-foreground/40' : 'border-black/10'
            )}
            style={tileStyle(s.changePercent)}
          >
            <span className="text-[11px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {s.ticker}
            </span>
            <span className="text-[9px] font-semibold leading-tight text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {formatPct(s.changePercent)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
