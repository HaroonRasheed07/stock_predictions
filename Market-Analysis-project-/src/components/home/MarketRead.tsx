import { formatPct, formatUpdated, changeTone } from '@/components/home/format';
import type { BreadthSummary } from '@/lib/home-data';

/** Section 4 — breadth summary built from the real discover scan. */
export function MarketRead({
  breadth,
  discoverAvailable,
  updatedMinutesAgo,
}: {
  breadth: BreadthSummary | null;
  discoverAvailable: boolean;
  updatedMinutesAgo: number | null;
}) {
  const updated = formatUpdated(updatedMinutesAgo);

  return (
    <section id="market-read" aria-labelledby="market-read-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="market-read-heading" className="text-xl font-semibold md:text-2xl">
            Today’s market read
          </h2>
          {!discoverAvailable && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
              data delayed — last snapshot
            </span>
          )}
        </div>

        {breadth ? (
          <>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
              Across {breadth.total} tracked stocks, technical readings split{' '}
              <span className="font-semibold text-green-800 dark:text-success">{breadth.bullish} Bullish</span>,{' '}
              <span className="font-semibold text-red-700 dark:text-red-400">{breadth.bearish} Bearish</span> and{' '}
              <span className="font-semibold text-foreground">{breadth.neutral} Neutral</span>.{' '}
              {breadth.advancers} advanced while {breadth.decliners} declined
              {breadth.unchanged > 0 ? ` (${breadth.unchanged} unchanged)` : ''}, for an average move of{' '}
              <span className={`font-semibold tabular-nums ${changeTone(breadth.avgMove)}`}>
                {formatPct(breadth.avgMove)}
              </span>
              {updated ? ` · ${updated.toLowerCase()}` : ''}.
            </p>

            {/* Breadth bar */}
            <div
              className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-muted/60"
              role="img"
              aria-label={`${breadth.bullish} bullish, ${breadth.bearish} bearish, ${breadth.neutral} neutral of ${breadth.total} stocks`}
            >
              <span
                className="bg-success"
                style={{ width: `${(breadth.bullish / breadth.total) * 100}%` }}
              />
              <span
                className="bg-destructive"
                style={{ width: `${(breadth.bearish / breadth.total) * 100}%` }}
              />
              <span
                className="bg-muted-foreground/50"
                style={{ width: `${(breadth.neutral / breadth.total) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success align-middle" aria-hidden="true" />
                Bullish {breadth.bullish} · {((breadth.bullish / breadth.total) * 100).toFixed(0)}%
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-destructive align-middle" aria-hidden="true" />
                Bearish {breadth.bearish} · {((breadth.bearish / breadth.total) * 100).toFixed(0)}%
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-muted-foreground/50 align-middle" aria-hidden="true" />
                Neutral {breadth.neutral} · {((breadth.neutral / breadth.total) * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
              The breadth scan is refreshing for this snapshot. Index quotes, market status and the research
              tools below stay available in the meantime.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-semibold text-warning">
                data delayed
              </span>
              {updated && <span>{updated}</span>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
