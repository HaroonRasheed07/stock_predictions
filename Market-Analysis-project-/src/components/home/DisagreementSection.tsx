import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Minus, GitCompare } from 'lucide-react';
import { formatPct, formatPrice, changeTone } from '@/components/home/format';
import type { DisagreeCardData } from '@/lib/home-data';

function modelPill(direction: 'up' | 'down' | 'flat' | null) {
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> Model up
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        <ArrowDownRight className="h-3 w-3" aria-hidden="true" /> Model down
      </span>
    );
  }
  if (direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" /> Model flat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Model —
    </span>
  );
}

function directionWord(label: string): string {
  const l = (label || '').toLowerCase();
  if (l.includes('bull') || l.includes('positive') || l.includes('strong') || l.includes('uptrend')) return 'Bullish';
  if (l.includes('bear') || l.includes('negative') || l.includes('weak') || l.includes('downtrend')) return 'Bearish';
  if (l.includes('buy')) return 'Bullish';
  if (l.includes('sell')) return 'Bearish';
  return 'Neutral';
}

function tone(label: string): string {
  const w = directionWord(label);
  return w === 'Bullish' ? 'text-success border-success/30 bg-success/10'
    : w === 'Bearish' ? 'text-destructive border-destructive/30 bg-destructive/10'
    : 'text-muted-foreground border-border/60 bg-muted/50';
}

/** Section 5 — where trend, sentiment and the model point different ways. */
export function DisagreementSection({
  cards,
  modelAvailable,
  discoverAvailable,
}: {
  cards: DisagreeCardData[];
  modelAvailable: boolean;
  discoverAvailable: boolean;
}) {
  return (
    <section id="disagree" aria-labelledby="disagree-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-5 flex items-center gap-3">
        <GitCompare className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <h2 id="disagree-heading" className="text-xl font-semibold md:text-2xl">
            Where the readings disagree
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trend, news sentiment and the 10-day model don’t always point the same way — these cards show where
            they diverge in the current snapshot.
          </p>
        </div>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.ticker}
              href={`/stocks/${c.ticker.toLowerCase()}`}
              className="group rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{c.ticker}</span>
                <span className={`text-xs font-semibold tabular-nums ${changeTone(c.changePercent)}`}>
                  {formatPct(c.changePercent)}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.name}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">${formatPrice(c.price)}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone(c.technical)}`}>
                  Trend {directionWord(c.technical)}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone(c.sentiment)}`}>
                  Sentiment {directionWord(c.sentiment)}
                </span>
                {modelPill(c.modelDirection)}
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {c.mismatch === 'technical-vs-model'
                  ? 'The technical trend and the model outlook point opposite directions — compare their inputs before drawing a conclusion.'
                  : 'The technical reading and news sentiment point opposite directions — price action and headlines are telling different stories.'}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open research brief →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-6">
          {discoverAvailable && modelAvailable ? (
            <p className="text-sm text-muted-foreground">
              No trend, sentiment or model disagreements in the current snapshot — the three readings line up.
              Divergences reappear as soon as the next scan or forecast run updates.
            </p>
          ) : discoverAvailable ? (
            <p className="text-sm text-muted-foreground">
              Trend-versus-sentiment comparisons are clear in this snapshot; the model comparison is refreshing.
              <span className="ml-2 inline-block rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                data delayed
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              The disagreement scan is refreshing for this snapshot.
              <span className="ml-2 inline-block rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                data delayed
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
