/**
 * Homepage sections — server components. Pure rendering over data fetched in
 * page.tsx (ISR). Interactive bits (search, watchlist, tracked links) come
 * from ./interactive. All numbers shown here are computed in page.tsx from
 * API responses via @/lib/home-insights — nothing is invented here.
 */
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Brain, Shield,
  ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Sparkles, Eye, LineChart, Newspaper,
  ArrowRight, Layers, BookOpen, Clock, Search,
  Gauge, Activity, ArrowUpDown, ShieldAlert, TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSentimentLabel } from '@/lib/sentiment';
import { toUrlSymbol } from '@/lib/ticker-routing';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Button } from '@/components/ui/button';
import type { HomeBrief, MarketStatusResponse, MarketOverviewResponse } from '@/lib/api';
import type { MarketRead, SignalConflict, SignalChange, MoverRow, SectorGroup } from '@/lib/home-insights';
import { BriefOpenButton, TrackedLink } from '@/components/home/interactive';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED PIECES
   ═══════════════════════════════════════════════════════════════════════════ */

export function SignalBadge({ signal, compact = false }: { signal: string; compact?: boolean }) {
  const config: Record<string, { bg: string; icon: typeof TrendingUp; ariaLabel: string }> = {
    'Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp, ariaLabel: 'Buy signal' },
    'Strong Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp, ariaLabel: 'Strong buy signal' },
    'Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown, ariaLabel: 'Sell signal' },
    'Strong Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown, ariaLabel: 'Strong sell signal' },
    'Hold': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus, ariaLabel: 'Hold signal' },
  };
  const c = config[signal] || config['Hold'];
  const Icon = c.icon;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        c.bg,
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      )}
      role="status"
      aria-label={c.ariaLabel}
    >
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      {signal}
    </div>
  );
}

function PillarRow({ icon: Icon, label, reading, detail, color }: {
  icon: typeof TrendingUp;
  label: string;
  reading: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-b-0">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold mt-0.5">{reading}</p>
      </div>
      <p className="text-xs text-muted-foreground text-right max-w-[45%] leading-relaxed hidden sm:block">{detail}</p>
    </div>
  );
}

function TrendChip({ technical }: { technical?: string }) {
  const label = technical || '—';
  const tone = technical?.includes('Bullish')
    ? 'bg-success/10 border-success/20 text-success'
    : technical?.includes('Bearish')
      ? 'bg-destructive/10 border-destructive/20 text-destructive'
      : 'bg-muted/50 border-border/50 text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', tone)}>
      {label}
    </span>
  );
}

function RiskChip({ risk }: { risk?: string }) {
  const tone = risk === 'High'
    ? 'text-destructive'
    : risk === 'Low'
      ? 'text-success'
      : 'text-warning';
  return <span className={cn('text-[10px] font-semibold uppercase tracking-wide', tone)}>{risk || '—'}</span>;
}

function SectionHeading({ eyebrow, title, sub, id }: {
  eyebrow?: string;
  title: string;
  sub?: string;
  id: string;
}) {
  return (
    <div className="text-center mb-7">
      {eyebrow && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <span className="text-xs font-medium text-primary">{eyebrow}</span>
        </div>
      )}
      <h2 id={id} className="text-2xl md:text-3xl font-bold mb-2">{title}</h2>
      {sub && <p className="text-muted-foreground max-w-2xl mx-auto text-sm">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARKET STRIP — status + four major indices (server, ISR)
   ═══════════════════════════════════════════════════════════════════════════ */

export function MarketStrip({
  tiles,
  statusLabel,
  open,
  updatedLabel,
}: {
  tiles: Array<{ ticker: string; name: string; overview: MarketOverviewResponse | null }>;
  statusLabel: string | null;
  open: boolean | null;
  updatedLabel: string | null;
}) {
  return (
    <div className="bg-card/60 border-b border-border/50 backdrop-blur-sm" role="region" aria-label="Market status and index overview">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                open ? 'bg-success' : open === false ? 'bg-muted-foreground' : 'bg-warning'
              )} />
              <span className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                open ? 'bg-success' : open === false ? 'bg-muted-foreground' : 'bg-warning'
              )} />
            </span>
            <span className="text-sm font-medium">{statusLabel || 'Market data loading…'}</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">Data delayed · ET</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {tiles.map(({ ticker, name, overview }) => (
              <div key={ticker} className="flex items-baseline gap-1.5" title={`${name} — latest close`}>
                <span className="text-xs font-semibold text-muted-foreground">{name}</span>
                {overview ? (
                  <>
                    <span className="text-sm font-bold">{fmt(overview.currentPrice)}</span>
                    <span className={cn(
                      'text-xs font-medium flex items-center gap-0.5',
                      overview.changePercent >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {overview.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
                      {overview.changePercent >= 0 ? '+' : ''}{overview.changePercent.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/70">unavailable</span>
                )}
              </div>
            ))}
          </div>
        </div>
        {updatedLabel && (
          <p className="text-[10px] text-muted-foreground/70 mt-1">{updatedLabel}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO — left: headline + search; right: live sample brief card
   ═══════════════════════════════════════════════════════════════════════════ */

export function HeroBriefCard({ brief }: { brief: HomeBrief | null }) {
  const selected = brief?.selectedStock;

  if (!selected) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-7 text-left">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Today&apos;s sample brief</p>
        <p className="text-sm font-semibold mb-1">Live brief is between refreshes</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Price, signal, sentiment and risk for a representative stock appear here every few minutes —
          all figures on this page come straight from the live analysis API.
        </p>
        <Link
          href="/markets/brief"
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary font-medium hover:gap-2.5 transition-all"
        >
          Open the research brief
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden text-left">
      <div className="p-5 md:p-6 border-b border-border/40">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Today&apos;s sample brief</p>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <TickerLogo ticker={selected.ticker} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{selected.ticker}</h3>
                <SignalBadge signal={selected.signal} compact />
              </div>
              <p className="text-2xl font-bold tracking-tight mt-1">${fmt(selected.price)}</p>
              <div className={cn(
                'flex items-center gap-1 text-sm font-medium mt-0.5',
                selected.changePercent >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {selected.changePercent >= 0
                  ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
                {selected.changePercent >= 0 ? '+' : ''}{selected.change.toFixed(2)} ({selected.changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Score</p>
            <p className={cn(
              'text-2xl font-bold',
              selected.score >= 70 ? 'text-success' : selected.score >= 40 ? 'text-warning' : 'text-destructive'
            )}>
              {selected.score.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground">/100</p>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-6 py-2">
        <PillarRow
          icon={LineChart}
          label="Technical"
          reading={selected.signal}
          detail="RSI, MACD, moving averages, and pattern analysis"
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <PillarRow
          icon={Newspaper}
          label="Sentiment"
          reading={formatSentimentLabel(selected.sentiment || '', selected.sentiment_status)}
          detail="AI-scored news articles across multiple sources"
          color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
        <PillarRow
          icon={Brain}
          label="Forecast"
          reading="10-trading-day model outlook"
          detail="LSTM point estimates — not a guarantee"
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <PillarRow
          icon={Shield}
          label="Risk"
          reading={`${selected.risk} · ${selected.volatility.toFixed(1)}% vol`}
          detail="Volatility, drawdown, and multi-factor scoring"
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="px-5 md:px-6 py-4 border-t border-border/40 bg-muted/20">
        <div className="flex items-start gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Signals can disagree — and that&apos;s informative. Technical indicators, sentiment, and forecasts use
            different data over different time horizons.
          </p>
        </div>
        <BriefOpenButton ticker={selected.ticker} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARKET READ — counts across the scanned tracked stocks
   ═══════════════════════════════════════════════════════════════════════════ */

export function MarketReadSection({ read }: { read: MarketRead }) {
  if (read.scanned === 0) {
    return (
      <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="market-read-heading">
        <div className="container mx-auto px-4">
          <SectionHeading
            id="market-read-heading"
            eyebrow="Market Read"
            title="What the scan shows today"
            sub="Live counts across the tracked stocks — refreshed as the scan runs."
          />
          <div className="max-w-2xl mx-auto rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              The tracked-stock scan is being refreshed. Counts for trend, RSI zones and conflicts appear here
              as soon as live data arrives — nothing on this page is cached example data.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const stats = [
    { label: 'Trend bullish', value: read.bullish, tone: 'text-success' },
    { label: 'Trend bearish', value: read.bearish, tone: 'text-destructive' },
    { label: 'Mixed / neutral', value: read.neutral, tone: 'text-muted-foreground' },
    { label: 'RSI overbought (70+)', value: read.rsiOverbought, tone: 'text-warning' },
    { label: 'RSI oversold (≤30)', value: read.rsiOversold, tone: 'text-info' },
    { label: 'Trend vs model disagree', value: read.conflicts, tone: 'text-primary' },
    { label: 'High-risk reads today', value: read.highRisk, tone: 'text-destructive' },
    { label: 'Stocks scanned', value: read.scanned, tone: 'text-foreground' },
  ];

  return (
    <section className="py-10 md:py-14 border-t border-border/60" id="market-read" aria-labelledby="market-read-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="market-read-heading"
          eyebrow="Market Read"
          title="What the scan shows today"
          sub={`Computed live across ${read.scanned} tracked stocks from today's technical scan.`}
        />
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <p className={cn('text-2xl font-bold', s.tone)}>{s.value}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-muted/50 border border-border/40 px-4 py-3">
            <p className="text-sm text-foreground/80 leading-relaxed">{read.sentence}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Descriptive counts only — not investment advice. Each stock links to its full research page.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNALS DISAGREE — trend label vs model path, with honest explanations
   ═══════════════════════════════════════════════════════════════════════════ */

export function SignalConflicts({ items }: { items: SignalConflict[] }) {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="conflicts-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="conflicts-heading"
          eyebrow="Signals Disagree"
          title="Where trend and model point opposite ways"
          sub="Technical trend labels and the model's 10-day path sometimes diverge. When they do, that's worth knowing — here's every case from today's scan."
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {items.length > 0 ? (
            items.map((c) => (
              <TrackedLink
                key={c.ticker}
                href={`/stocks/${toUrlSymbol(c.ticker)}`}
                ticker={c.ticker}
                source="discover"
                ariaLabel={`Open research for ${c.ticker}`}
                className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-4 md:p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowUpDown className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold">{c.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate">{c.name}</span>
                    <TrendChip technical={c.trend} />
                    <span className={cn(
                      'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      c.direction === 'up'
                        ? 'bg-success/10 border-success/20 text-success'
                        : 'bg-destructive/10 border-destructive/20 text-destructive'
                    )}>
                      {c.direction === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" /> : <ArrowDownRight className="h-2.5 w-2.5" aria-hidden="true" />}
                      Model {c.direction === 'up' ? 'up' : 'down'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.explanation}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </TrackedLink>
            ))
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
              <Eye className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                No trend-vs-model conflicts among the scanned stocks right now — the technical trend and the
                model&apos;s 10-day path currently point the same way for every stock with both readings available.
                When they diverge, each case appears here with its own explanation.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BIGGEST CHANGES — RSI crossings, MACD flips, price moves, risk flags
   ═══════════════════════════════════════════════════════════════════════════ */

const CHANGE_ICONS = {
  'rsi-crossing': Gauge,
  'macd-flip': Activity,
  'price-move': ArrowUpDown,
  'risk-flag': ShieldAlert,
} as const;

export function BiggestChanges({ items }: { items: SignalChange[] }) {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="changes-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="changes-heading"
          eyebrow="Biggest Changes"
          title="What changed since yesterday"
          sub="Threshold crossings and flips computed from the latest indicator rows — RSI 30/70 bands, MACD signal-line crosses, session moves, and risk flags."
        />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.length > 0 ? (
            items.map((item, i) => {
              const Icon = CHANGE_ICONS[item.kind] || Activity;
              return (
                <TrackedLink
                  key={`${item.ticker}-${item.kind}-${i}`}
                  href={`/stocks/${toUrlSymbol(item.ticker)}`}
                  ticker={item.ticker}
                  source="discover"
                  ariaLabel={`Open research for ${item.ticker}`}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/20"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    item.kind === 'rsi-crossing' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : item.kind === 'macd-flip' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : item.kind === 'risk-flag' ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  )}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{item.ticker}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{item.headline}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.detail}</p>
                  </div>
                </TrackedLink>
              );
            })
          ) : (
            <div className="col-span-full rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No RSI threshold crossings, MACD flips or notable moves among the scanned stocks yet today —
                the latest indicator rows sit inside their usual ranges.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTOR GRID — tiles grouped by sector, colored by trend/risk
   ═══════════════════════════════════════════════════════════════════════════ */

export function SectorGrid({ groups }: { groups: SectorGroup[] }) {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="sectors-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="sectors-heading"
          eyebrow="Sector Grid"
          title="Tracked stocks by sector"
          sub="Each tile shows today's trend label and risk band from the scan — grouped by sector from the stock directory."
        />
        {groups.length > 0 ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div key={g.sector} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{g.sector}</h3>
                  <span className="text-[10px] text-muted-foreground">{g.items.length} tracked</span>
                </div>
                <div className="space-y-2">
                  {g.items.map((s) => (
                    <TrackedLink
                      key={s.ticker}
                      href={`/stocks/${toUrlSymbol(s.ticker)}`}
                      ticker={s.ticker}
                      source="discover"
                      ariaLabel={`Open research for ${s.ticker}`}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 hover:border-primary/20 transition-all"
                    >
                      <TickerLogo ticker={s.ticker} size="sm" />
                      <span className="text-xs font-bold">{s.ticker}</span>
                      <TrendChip technical={s.technical} />
                      <RiskChip risk={s.risk} />
                      <span className={cn(
                        'ml-auto text-xs font-semibold',
                        s.changePercent > 0 ? 'text-success' : s.changePercent < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                      </span>
                    </TrackedLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sector grouping appears once the tracked-stock scan returns — every tile links to a live research page.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOVERS — biggest session moves among the scanned stocks
   ═══════════════════════════════════════════════════════════════════════════ */

export function MoversGrid({ rows }: { rows: MoverRow[] }) {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="movers-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="movers-heading"
          eyebrow="Movers"
          title="Biggest moves among tracked stocks"
          sub="Ranked by absolute session change versus yesterday's close, from the same scanned universe."
        />
        {rows.length > 0 ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((m, i) => (
              <TrackedLink
                key={m.ticker}
                href={`/stocks/${toUrlSymbol(m.ticker)}`}
                ticker={m.ticker}
                source="discover"
                ariaLabel={`Open research for ${m.ticker}`}
                className="rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <TickerLogo ticker={m.ticker} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                        <p className="text-sm font-semibold">{m.ticker}</p>
                      </div>
                      <p className="text-lg font-bold">${fmt(m.price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-semibold',
                      m.changePercent > 0 ? 'text-success' : m.changePercent < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {m.changePercent > 0 ? '+' : ''}{m.changePercent.toFixed(2)}%
                    </p>
                    {m.signal && <SignalBadge signal={m.signal} compact />}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Trend</p>
                    <div className="mt-0.5"><TrendChip technical={m.technical} /></div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Risk</p>
                    <div className="mt-0.5"><RiskChip risk={m.risk} /></div>
                  </div>
                </div>
              </TrackedLink>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto rounded-2xl border border-border/40 bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Mover rankings appear once today&apos;s tracked-stock scan returns. Until then, the stock directory
              has every stock we cover.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEARN STRIP — beginner entry points
   ═══════════════════════════════════════════════════════════════════════════ */

const LEARN_CARDS = [
  {
    href: '/learn/how-to-analyze-a-stock',
    title: 'How to analyze a stock',
    desc: 'A step-by-step research routine: technicals, sentiment, model forecast and risk — each with its timeframe and source labeled.',
  },
  {
    href: '/learn/what-is-technical-analysis',
    title: 'Technical analysis basics',
    desc: 'How charts, trends and indicators like RSI and MACD produce Buy/Hold/Sell readings, and what they can and cannot tell you.',
  },
  {
    href: '/learn/what-is-rsi',
    title: 'RSI explained',
    desc: 'What the Relative Strength Index measures, how the 30 and 70 thresholds are read, and why they are only one input among many.',
  },
];

export function LearnStrip() {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="learn-strip-heading">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto">
          <div>
            <h2 id="learn-strip-heading" className="text-2xl md:text-3xl font-bold">Learn the concepts behind the signals</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Clear, jargon-free beginner guides — no account needed.
            </p>
          </div>
          <Link href="/learn" className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
            All guides <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LEARN_CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="group">
              <div className="h-full rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20">
                <BookOpen className="h-5 w-5 text-primary mb-3" aria-hidden="true" />
                <h3 className="text-sm font-semibold mb-1.5 group-hover:text-primary transition-colors">{c.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Read guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS — four research pillars
   ═══════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: LineChart,
    title: 'Technical Analysis',
    description: 'RSI, MACD, Bollinger Bands, moving averages, and ATR — with Buy/Hold/Sell readings across timeframes.',
    indicators: ['RSI', 'MACD', 'Bollinger Bands', 'Moving Averages', 'ATR'],
    link: '/markets/stock/technical',
    color: 'from-blue-500/20 to-blue-600/10 dark:from-blue-500/15 dark:to-blue-600/5',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    icon: Newspaper,
    title: 'News Sentiment',
    description: 'News headlines scored by an NLP model as positive, neutral, or negative — tracked across sources and time.',
    indicators: ['Headline Scoring', 'Source Tracking', 'Trend Tracking', 'Catalyst Detection'],
    link: '/markets/stock/sentiment',
    color: 'from-purple-500/20 to-purple-600/10 dark:from-purple-500/15 dark:to-purple-600/5',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    icon: Brain,
    title: 'AI Forecasting',
    description: 'LSTM point projections over a fixed 10-trading-day horizon, with the historical fit shown next to every forecast.',
    indicators: ['10-Trading-Day Horizon', 'Historical Fit', 'Recursive Projection', 'Business-Day Dates'],
    link: '/markets/stock/forecast',
    color: 'from-emerald-500/20 to-emerald-600/10 dark:from-emerald-500/15 dark:to-emerald-600/5',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: Shield,
    title: 'Risk Assessment',
    description: 'Volatility, drawdown, and multi-factor risk assessment to understand downside exposure.',
    indicators: ['Volatility', 'Drawdown', 'ATR', 'Risk Score'],
    link: '/markets/brief',
    color: 'from-amber-500/20 to-amber-600/10 dark:from-amber-500/15 dark:to-amber-600/5',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
];

export function HowItWorks() {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="features-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          id="features-heading"
          eyebrow="Research Toolkit"
          title="Everything You Need to Research a Stock"
          sub="Four analysis pillars, each using different data and methods. Together they reveal what no single metric can."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {FEATURES.map((feature) => (
            <Link key={feature.title} href={feature.link} className="group">
              <div className="rounded-2xl border border-border/60 bg-card p-5 h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 flex flex-col">
                <div className={cn(
                  'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 transition-transform group-hover:scale-105',
                  feature.color
                )}>
                  <feature.icon className={cn('h-5 w-5', feature.iconColor)} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feature.description}</p>
                <div className="mt-auto">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {feature.indicators.map((ind) => (
                      <span key={ind} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                        {ind}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRUST STRIP + FINAL CTA
   ═══════════════════════════════════════════════════════════════════════════ */

export function TrustStrip() {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="trust-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h2 id="trust-heading" className="text-xl md:text-2xl font-bold">Built for Research, Not Recommendations</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm mt-1">
              Every page states its data source, timeframe, and limits — so you can weigh the evidence yourself.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
              <Clock className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
              <h3 className="text-sm font-semibold mb-1">Transparent data</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Prices come from public market data via Yahoo Finance and may be delayed or cached. Each view labels its timeframe.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
              <Eye className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
              <h3 className="text-sm font-semibold mb-1">Honest methodology</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Forecasts are point estimates from an LSTM model. Historical fit percentages are MAPE-based and shown for transparency — not as promises.
              </p>
              <Link href="/learn/how-lstm-forecasting-works" className="text-xs text-primary hover:underline inline-block mt-2">
                How the forecast works
              </Link>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
              <Shield className="h-5 w-5 text-primary mx-auto mb-2" aria-hidden="true" />
              <h3 className="text-sm font-semibold mb-1">No investment advice</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                StockVantex is an educational research tool. Nothing on this site is a recommendation to buy or sell.
              </p>
              <Link href="/disclaimer" className="text-xs text-primary hover:underline inline-block mt-2">
                Financial disclaimer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="py-10 md:py-14 border-t border-border/60" aria-labelledby="final-cta-heading">
      <div className="container mx-auto px-4">
        <div className="glass rounded-3xl p-6 md:p-10 text-center max-w-3xl mx-auto glow-primary">
          <h2 id="final-cta-heading" className="text-2xl md:text-3xl font-bold mb-3">
            Start Researching
          </h2>
          <p className="text-base text-muted-foreground mb-6 max-w-xl mx-auto">
            Search any ticker above, or open the stock directory to browse everything we cover.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/stocks">
              <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                <Layers className="h-4 w-4" />
                Browse Stock Directory
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/learn">
              <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 gap-2 w-full sm:w-auto">
                <BookOpen className="h-4 w-4" />
                Learn Investing Basics
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Warning triangle reused by page-level notices if needed. */
export { TriangleAlert, Sparkles };
