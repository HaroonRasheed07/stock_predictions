import { Sparkline } from '@/components/home/Sparkline';
import { formatIndex, formatPct, formatUpdated, changeTone } from '@/components/home/format';
import type { IndexQuote, MarketStatusView } from '@/lib/home-data';

function statusDot(status: string): string {
  if (status === 'open') return 'bg-success';
  if (status === 'pre_market' || status === 'after_hours') return 'bg-warning';
  return 'bg-muted-foreground/60';
}

function fmtWhen(value: string | null): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return null;
  }
}

export function MarketStrip({
  indexes,
  status,
  updatedMinutesAgo,
  indicesDelayed,
}: {
  indexes: IndexQuote[];
  status: MarketStatusView;
  updatedMinutesAgo: number | null;
  indicesDelayed: boolean;
}) {
  const updated = formatUpdated(updatedMinutesAgo);
  const nextOpen = status.source === 'backend' ? fmtWhen(status.next_open) : null;

  return (
    <div className="border-b border-border/50 bg-background/60">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-4 overflow-x-auto py-1.5 text-xs md:gap-6" style={{ scrollbarWidth: 'none' }}>
          {/* Market status */}
          <div className="flex shrink-0 items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status.status)}`} aria-hidden="true" />
            <span className="font-medium text-foreground">{status.label}</span>
            <span className="text-muted-foreground">ET</span>
            {nextOpen && <span className="hidden text-muted-foreground sm:inline">· Next open {nextOpen}</span>}
          </div>

          <span className="h-3 w-px shrink-0 bg-border/70" aria-hidden="true" />

          {indexes.length === 0 ? (
            <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
              <span>Index quotes unavailable</span>
              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                data delayed
              </span>
            </div>
          ) : (
            indexes.map((idx) => (
              <div key={idx.symbol} className="flex shrink-0 items-center gap-2" title={idx.label}>
                <span className="font-medium text-foreground">{idx.label}</span>
                <span className="tabular-nums text-foreground/80">{formatIndex(idx.value)}</span>
                <span className={`tabular-nums font-semibold ${changeTone(idx.changePercent)}`}>
                  {formatPct(idx.changePercent)}
                </span>
                <Sparkline points={idx.points} width={64} height={18} ariaLabel={`${idx.label} recent trend`} />
              </div>
            ))
          )}

          <span className="h-3 w-px shrink-0 bg-border/70 hidden sm:block" aria-hidden="true" />

          <div className="ml-auto hidden shrink-0 items-center gap-2 text-muted-foreground md:flex">
            {indicesDelayed && (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                data delayed
              </span>
            )}
            {updated && <span>{updated}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
