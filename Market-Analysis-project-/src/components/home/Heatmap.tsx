import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { formatPct, formatPrice } from '@/components/home/format';
import { getStockInfo } from '@/lib/stock-allowlist';
import type { DiscoverStock } from '@/lib/api';

function tileStyle(changePercent: number): React.CSSProperties {
  const ch = typeof changePercent === 'number' && isFinite(changePercent) ? changePercent : 0;
  const t = Math.min(Math.abs(ch) / 4, 1);
  const alpha = 0.12 + t * 0.43;
  return ch >= 0
    ? { backgroundColor: `rgba(21, 128, 61, ${alpha.toFixed(3)})` }
    : { backgroundColor: `rgba(185, 28, 28, ${alpha.toFixed(3)})` };
}

/** Section 8 — sector-grouped daily-move heatmap; every tile links to its brief. */
export function Heatmap({ stocks, available }: { stocks: DiscoverStock[]; available: boolean }) {
  const usable = stocks.filter(
    (s) => typeof s.changePercent === 'number' && isFinite(s.changePercent)
  );
  const sorted = [...usable].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  if (!available || sorted.length === 0) {
    return (
      <section id="heatmap" aria-labelledby="heatmap-heading" className="container mx-auto px-4 py-10 md:py-14">
        <h2 id="heatmap-heading" className="text-xl font-semibold md:text-2xl">
          Daily move heatmap
        </h2>
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground flex items-center gap-2">
          <span>The heatmap updates with each scan.</span>
          <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
            Updating
          </span>
        </div>
      </section>
    );
  }

  const bySector = new Map<string, DiscoverStock[]>();
  for (const s of sorted) {
    const sector = getStockInfo(s.ticker)?.sector || 'Other';
    const list = bySector.get(sector);
    if (list) list.push(s);
    else bySector.set(sector, [s]);
  }

  // Sparse-hiding: drop sectors with a lone tile; fall back to one flat group.
  const grouped = [...bySector.entries()].filter(([, members]) => members.length >= 2);
  const groups: Array<[string, DiscoverStock[]]> =
    grouped.length > 0
      ? grouped.sort(([a], [b]) => a.localeCompare(b))
      : [['All tracked stocks', sorted]];

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
              Today’s move for every tracked stock, grouped by sector — equal-size tiles colored by session change.
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

      {groups.map(([sector, members]) => (
        <div key={sector} className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sector} · {members.length}
          </h3>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}
          >
            {members.map((s) => (
              <Link
                key={s.ticker}
                href={`/stocks/${s.ticker.toLowerCase()}`}
                aria-label={`${s.ticker}, ${formatPct(s.changePercent)} on the day — ${formatPrice(s.price)} — open research brief`}
                className="flex aspect-square flex-col items-center justify-center rounded-md border border-black/10 text-center transition-transform hover:scale-[1.04]"
                style={tileStyle(s.changePercent)}
              >
                <span className="text-[11px] font-bold leading-tight text-neutral-950 dark:text-white">
                  {s.ticker}
                </span>
                <span className="text-[9px] font-semibold leading-tight text-neutral-950/80 dark:text-white/90">
                  {formatPct(s.changePercent)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
