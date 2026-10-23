import { formatPct, formatUpdated, changeTone } from '@/components/home/format';
import type { BreadthSummary } from '@/lib/home-data';

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'bull' | 'bear' | 'amber' | 'mute';
}) {
  const tones = {
    bull: 'border-success/30 bg-success/10 text-success',
    bear: 'border-destructive/30 bg-destructive/10 text-destructive',
    amber: 'border-warning/30 bg-warning/10 text-warning',
    mute: 'border-border/60 bg-muted/50 text-foreground/80',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Section 4 — breadth summary built from the real discover scan. */
export function MarketRead({
  breadth,
  discoverAvailable,
  updatedMinutesAgo,
  disagreeCount,
  highRiskCount,
  modelAvailable,
}: {
  breadth: BreadthSummary | null;
  discoverAvailable: boolean;
  updatedMinutesAgo: number | null;
  disagreeCount: number;
  highRiskCount: number;
  modelAvailable: boolean;
}) {
  const updated = formatUpdated(updatedMinutesAgo);

  return (
    <section id="market-read" aria-labelledby="market-read-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="market-read-heading" className="text-xl font-semibold md:text-2xl">
            Today’s market read
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {updated && <span>{updated}</span>}
            {discoverAvailable ? (
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Live feeds active
              </span>
            ) : (
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Syncing snapshot...
              </span>
            )}
          </div>
        </div>

        {breadth ? (
          <>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
              Across {breadth.total} tracked stocks, technicals read{' '}
              <span className="font-semibold text-success">{breadth.bullish} Bullish</span>,{' '}
              <span className="font-semibold text-destructive">{breadth.bearish} Bearish</span> and{' '}
              <span className="font-semibold text-foreground">{breadth.neutral} Neutral</span>, with{' '}
              {breadth.advancers} advancing and {breadth.decliners} declining for an average move of{' '}
              <span className={`font-semibold tabular-nums ${changeTone(breadth.avgMove)}`}>
                {formatPct(breadth.avgMove)}
              </span>
              .{' '}
              {modelAvailable
                ? `${disagreeCount} ${disagreeCount === 1 ? 'stock shows' : 'stocks show'} signal disagreements today`
                : 'The model outlook is refreshing for this snapshot'}
              , and {highRiskCount} {highRiskCount === 1 ? 'stock sits' : 'stocks sit'} in the high-risk band — open
              the sections below for the tickers behind each count.
            </p>

            {/* Four headline counts */}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Bullish stocks" value={breadth.bullish} tone="bull" />
              <StatCard label="Bearish stocks" value={breadth.bearish} tone="bear" />
              <StatCard
                label="Signal disagreements"
                value={modelAvailable ? disagreeCount : '—'}
                tone="amber"
              />
              <StatCard label="High-risk stocks" value={highRiskCount} tone="bear" />
            </div>

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
              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
                Updating snapshot...
              </span>
              {updated && <span>{updated}</span>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
