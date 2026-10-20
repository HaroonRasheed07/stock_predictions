'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Compass, LineChart, Newspaper, Brain, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct, formatPrice, changeTone } from '@/components/home/format';
import { Sparkline } from '@/components/home/Sparkline';
import { trackEvent } from '@/lib/analytics';
import type { HeroBundle } from '@/lib/home-data';

type TabKey = 'brief' | 'technical' | 'news' | 'forecast';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Compass; href: (t: string) => string; cta: string }> = [
  { key: 'brief', label: 'Stock Brief', icon: Compass, href: (t) => `/stocks/${t.toLowerCase()}`, cta: 'Open full research brief' },
  { key: 'technical', label: 'Technical', icon: LineChart, href: (t) => `/markets/stock/technical?ticker=${encodeURIComponent(t)}`, cta: 'Open technical view' },
  { key: 'news', label: 'News Sentiment', icon: Newspaper, href: (t) => `/markets/stock/sentiment?ticker=${encodeURIComponent(t)}`, cta: 'Open sentiment view' },
  { key: 'forecast', label: 'Forecast', icon: Brain, href: (t) => `/markets/stock/forecast?ticker=${encodeURIComponent(t)}`, cta: 'Open forecast view' },
];

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('mt-0.5 block text-sm font-bold tabular-nums', tone)}>{value}</span>
    </div>
  );
}

function Delayed({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      {what} is refreshing for this snapshot.
      <span className="pill pill-amber">
        data delayed
      </span>
    </p>
  );
}

/** Exactly three bullet points describing the active pipeline. */
function Bullets({ items }: { items: [string, string, string] }) {
  return (
    <ul className="mt-4 space-y-1.5 border-t border-border/50 pt-4 text-xs leading-relaxed text-muted-foreground">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {b}
        </li>
      ))}
    </ul>
  );
}

const TONE_CLS = {
  bull: 'border-success/30 bg-success/10 text-success',
  bear: 'border-destructive/30 bg-destructive/10 text-destructive',
  amber: 'border-warning/30 bg-warning/10 text-warning',
  mute: 'border-border/60 bg-muted/50 text-muted-foreground',
} as const;

type Tone = keyof typeof TONE_CLS;

function BriefRail({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${TONE_CLS[tone]}`}>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide !text-foreground/70">{label}</span>
        <span className="block truncate text-xs font-bold !text-foreground">{value}</span>
      </span>
    </div>
  );
}

function TechRow({ label, value, pill }: { label: string; value: string; pill: { text: string; cls: string } }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="block text-sm font-bold tabular-nums">{value}</span>
      </span>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>{pill.text}</span>
    </div>
  );
}

/** Two-line mini chart sharing one scale (real MACD / Signal columns). */
function DualLine({ a, b, labelA, labelB }: { a: number[]; b: number[]; labelA: string; labelB: string }) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const aa = a.slice(-n);
  const bb = b.slice(-n);
  const all = [...aa, ...bb];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const W = 260;
  const H = 64;
  const path = (arr: number[]) =>
    arr.map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - ((v - min) / span) * (H - 8) - 4).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden="true">
        <polyline points={path(aa)} fill="none" stroke="#60a5fa" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <polyline points={path(bb)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#60a5fa]" aria-hidden="true" />{labelA}</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#f59e0b]" aria-hidden="true" />{labelB}</span>
      </div>
    </div>
  );
}

function ForecastMini({ forecast }: { forecast: NonNullable<HeroBundle['forecast']> }) {
  const geom = useMemo(() => {
    const actual = (forecast.results?.actual_prices || []).filter((v) => isFinite(v)).slice(-30);
    const pred = (forecast.results?.forecast_prices || []).filter((v) => isFinite(v));
    if (actual.length < 2 || pred.length < 2) return null;
    const all = [...actual, ...pred];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const total = actual.length + pred.length;
    const W = 400;
    const H = 120;
    const x = (i: number) => (i / (total - 1)) * W;
    const y = (v: number) => H - ((v - min) / span) * (H - 16) - 8;
    const actualPts = actual.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const predPts = pred.map((v, i) => `${x(actual.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return { actualPts, predPts, W, H, boundary: x(actual.length - 1) };
  }, [forecast]);

  if (!geom) return <Delayed what="The model preview" />;

  return (
    <div>
      <svg viewBox={`0 0 ${geom.W} ${geom.H}`} preserveAspectRatio="none" className="h-32 w-full" aria-hidden="true">
        <line x1={geom.boundary} x2={geom.boundary} y1="0" y2={geom.H} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 4" />
        <polyline points={geom.actualPts} fill="none" stroke="#60a5fa" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <polyline points={geom.predPts} fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#60a5fa]" aria-hidden="true" />Actual close</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#f59e0b]" aria-hidden="true" />Model outlook</span>
        <span>· dashed line starts at the last session</span>
      </div>
    </div>
  );
}

/** Section 7 — four feature tabs previewing the real pipelines for one ticker. */
export function Explorer({ bundle }: { bundle: HeroBundle }) {
  const [tab, setTab] = useState<TabKey>('brief');
  const ticker = bundle.ticker;
  const overview = bundle.overview;
  const indicators = bundle.indicators;
  const sentiment = bundle.sentiment;
  const forecast = bundle.forecast;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string }>).detail;
      const t = detail?.tab as TabKey | undefined;
      if (t && TABS.some((x) => x.key === t)) {
        setTab(t);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('explore')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    };
    window.addEventListener('sv:explore-tab', handler);
    return () => window.removeEventListener('sv:explore-tab', handler);
  }, []);

  const pick = (key: TabKey, source = 'tabs') => {
    setTab(key);
    trackEvent('explorer_tab_click', { tab: key, source });
  };

  const rows = Array.isArray(indicators?.data) ? indicators!.data : [];
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  const last30 = rows.slice(-30);

  const headlines = (() => {
    const dateStr = (at?: string) =>
      at && !isNaN(Date.parse(at)) ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const fromNews = (sentiment?.news || [])
      .filter((n) => n && n.title)
      .slice(0, 3)
      .map((n) => ({
        title: n.title,
        url: n.url,
        source: n.source || '—',
        date: dateStr(n.published_at),
        label: n.sentiment == null ? 'Neutral' : n.sentiment > 0.15 ? 'Positive' : n.sentiment < -0.15 ? 'Negative' : 'Neutral',
        tone: (n.sentiment == null || (n.sentiment <= 0.15 && n.sentiment >= -0.15)
          ? 'mute'
          : n.sentiment > 0.15
            ? 'bull'
            : 'bear') as Tone,
      }));
    if (fromNews.length >= 3) return fromNews;
    const fromArticles = (sentiment?.articles || [])
      .filter((a) => a && a.title)
      .slice(0, 3 - fromNews.length)
      .map((a) => {
        const lbl = (a.finbert_label || '').toLowerCase();
        return {
          title: a.title,
          url: a.url,
          source: a.publisher || '—',
          date: dateStr(a.published_at),
          label: lbl === 'positive' ? 'Positive' : lbl === 'negative' ? 'Negative' : 'Neutral',
          tone: (lbl === 'positive' ? 'bull' : lbl === 'negative' ? 'bear' : 'mute') as Tone,
        };
      });
    return [...fromNews, ...fromArticles];
  })();

  const activeDef = TABS.find((t) => t.key === tab)!;

  return (
    <section id="explore" aria-labelledby="explore-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="explore-heading" className="text-xl font-semibold md:text-2xl">
              Explore the four readings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A preview of each pipeline for <span className="font-semibold text-foreground">{ticker}</span> — the
              same data the full views use.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Feature previews"
          aria-orientation="vertical"
          className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-1 md:flex-col md:overflow-x-visible"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                id={`explore-tab-${t.key}`}
                role="tab"
                aria-selected={active}
                aria-controls="explore-panel"
                type="button"
                onClick={() => pick(t.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors md:w-full md:justify-start md:text-sm',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="explore-panel"
          aria-labelledby={`explore-tab-${tab}`}
          className="rounded-2xl border border-border/60 bg-card p-5 md:p-6"
        >
        {tab === 'brief' && (
          <div>
            {overview ? (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <BriefRail
                    label="Trend"
                    value={overview.trendStrength?.trend_label || '—'}
                    tone={
                      (overview.trendStrength?.trend_label || '').toLowerCase().includes('bull')
                        ? 'bull'
                        : (overview.trendStrength?.trend_label || '').toLowerCase().includes('bear')
                          ? 'bear'
                          : 'mute'
                    }
                  />
                  <BriefRail
                    label="Sentiment"
                    value={overview.sentiment?.sentiment_label || sentiment?.sentiment_label || '—'}
                    tone={
                      (overview.sentiment?.sentiment_label || sentiment?.sentiment_label || '').toLowerCase().includes('positive')
                        ? 'bull'
                        : (overview.sentiment?.sentiment_label || sentiment?.sentiment_label || '').toLowerCase().includes('negative')
                          ? 'bear'
                          : 'mute'
                    }
                  />
                  <BriefRail
                    label="Risk"
                    value={overview.risk?.risk_level || '—'}
                    tone={
                      (overview.risk?.risk_level || '').toLowerCase() === 'low'
                        ? 'bull'
                        : (overview.risk?.risk_level || '').toLowerCase() === 'high'
                          ? 'bear'
                          : 'amber'
                    }
                  />
                  <BriefRail
                    label="Model outlook"
                    value={
                      bundle.outlook?.direction === 'up'
                        ? 'Model up'
                        : bundle.outlook?.direction === 'down'
                          ? 'Model down'
                          : bundle.outlook?.direction === 'flat'
                            ? 'Model flat'
                            : '—'
                    }
                    tone={
                      bundle.outlook?.direction === 'up'
                        ? 'bull'
                        : bundle.outlook?.direction === 'down'
                          ? 'bear'
                          : 'mute'
                    }
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Price" value={`$${formatPrice(overview.currentPrice)}`} />
                  <Stat label="Daily change" value={formatPct(overview.changePercent)} tone={changeTone(overview.changePercent)} />
                  <Stat label="ATR (14)" value={overview.volatility?.atr != null ? formatPrice(overview.volatility.atr) : '—'} />
                  <Stat label="Risk score" value={overview.risk?.risk_score != null ? `${overview.risk.risk_score}/100` : '—'} />
                  <Stat label="Trend score" value={overview.trendStrength?.trend_score != null ? `${overview.trendStrength.trend_score} · ${overview.trendStrength.trend_label}` : '—'} />
                  <Stat label="Market mood" value={overview.sentiment?.market_mood || sentiment?.market_mood || '—'} />
                  <Stat label="Sentiment score" value={`${((sentiment?.score ?? sentiment?.sentiment_score) || 0).toFixed(2)}`} />
                  <Stat label="Articles scored" value={String(sentiment?.news_count ?? sentiment?.relevant_article_count ?? '—')} />
                </div>
                <Bullets
                  items={[
                    'Price, daily change and ATR come straight from the latest indicator snapshot.',
                    'Trend, sentiment, risk and the model outlook stay separate — no averaged score.',
                    'Each reading links to the full pipeline view that produced it.',
                  ]}
                />
              </>
            ) : (
              <Delayed what="The brief snapshot" />
            )}
          </div>
        )}

        {tab === 'technical' && (
          <div>
            {last ? (
              <>
                {(() => {
                  const rsi = Number(last.RSI);
                  const atr = Number(overview?.volatility?.atr);
                  const price = Number(overview?.currentPrice);
                  const atrPct = isFinite(atr) && isFinite(price) && price > 0 ? (atr / price) * 100 : null;
                  const macd = Number(last.MACD);
                  const sig = Number(last.Signal);
                  const close = Number(last.Close);
                  const sma20 = Number(last.SMA20);
                  const num = (v: number, d: number) => (isFinite(v) ? v.toFixed(d) : '—');
                  return (
                    <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <TechRow
                        label="RSI (14)"
                        value={num(rsi, 1)}
                        pill={
                          !isFinite(rsi)
                            ? { text: '—', cls: TONE_CLS.mute }
                            : rsi >= 70
                              ? { text: 'Overbought zone', cls: TONE_CLS.bear }
                              : rsi <= 30
                                ? { text: 'Oversold zone', cls: TONE_CLS.bull }
                                : { text: 'Mid zone', cls: TONE_CLS.mute }
                        }
                      />
                      <TechRow
                        label="ATR (14)"
                        value={isFinite(atr) ? `$${formatPrice(atr)}` : '—'}
                        pill={
                          atrPct === null
                            ? { text: '—', cls: TONE_CLS.mute }
                            : atrPct >= 3
                              ? { text: 'Wide swings', cls: TONE_CLS.bear }
                              : atrPct >= 1.5
                                ? { text: 'Active', cls: TONE_CLS.amber }
                                : { text: 'Quiet', cls: TONE_CLS.mute }
                        }
                      />
                      <TechRow
                        label="MACD vs signal"
                        value={num(macd, 2)}
                        pill={
                          !isFinite(macd) || !isFinite(sig)
                            ? { text: '—', cls: TONE_CLS.mute }
                            : macd >= sig
                              ? { text: 'Above signal', cls: TONE_CLS.bull }
                              : { text: 'Below signal', cls: TONE_CLS.bear }
                        }
                      />
                      <TechRow
                        label="Price vs SMA 20"
                        value={isFinite(sma20) ? `$${formatPrice(sma20)}` : '—'}
                        pill={
                          !isFinite(sma20) || !isFinite(close)
                            ? { text: '—', cls: TONE_CLS.mute }
                            : close >= sma20
                              ? { text: 'Price above', cls: TONE_CLS.bull }
                              : { text: 'Price below', cls: TONE_CLS.bear }
                        }
                      />
                    </div>
                  );
                })()}
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RSI (14)</span>
                      <span className="text-sm font-bold tabular-nums">
                        {Number(last.RSI) ? Number(last.RSI).toFixed(1) : '—'}
                      </span>
                    </div>
                    <div className="relative mt-2 h-2 rounded-full bg-muted/70" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, Number(last.RSI) || 0))}%` }} />
                      <span className="absolute inset-y-0 left-[30%] w-px bg-border" />
                      <span className="absolute inset-y-0 left-[70%] w-px bg-border" />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>30 · oversold</span>
                      <span>70 · overbought</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MACD & signal</span>
                      <span className="text-sm font-bold tabular-nums">
                        {Number(last.MACD) ? Number(last.MACD).toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <DualLine
                        a={last30.map((r) => Number(r.MACD)).filter((v) => isFinite(v))}
                        b={last30.map((r) => Number(r.Signal)).filter((v) => isFinite(v))}
                        labelA="MACD"
                        labelB="Signal"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bollinger position</span>
                    <div className="relative mt-2 h-2 rounded-full bg-muted/70" aria-hidden="true">
                      {(() => {
                        const lower = Number(last.LowerBand);
                        const upper = Number(last.UpperBand);
                        const close = Number(last.Close);
                        const pct =
                          isFinite(lower) && isFinite(upper) && upper > lower
                            ? ((close - lower) / (upper - lower)) * 100
                            : null;
                        return pct === null ? null : (
                          <span
                            className="absolute inset-y-0 rounded-full bg-primary/70"
                            style={{ left: `${Math.max(0, Math.min(100, pct))}%`, width: '3px' }}
                          />
                        );
                      })()}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>lower band</span>
                      <span>upper band</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(['SMA20', 'SMA50', 'EMA20'] as const).map((col) => {
                      const v = Number(last[col]);
                      if (!isFinite(v)) return null;
                      const close = Number(last.Close);
                      const above = isFinite(close) && close >= v;
                      return (
                        <div key={col} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{col.replace('SMA', 'SMA ').replace('EMA', 'EMA ')}</span>
                          <span className="tabular-nums">
                            ${formatPrice(v)}{' '}
                            <span className={above ? 'text-success' : 'text-destructive'}>
                              {above ? 'price above' : 'price below'}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Bullets
                  items={[
                    'RSI, MACD, bands and averages come from the indicator pipeline exactly as computed for ' + ticker + '.',
                    'Reading pills (zones, volatility) are conventions for context — they are not signals to act on.',
                    'ATR is shown in dollars with a quiet/active/wide reading based on its share of the latest price.',
                  ]}
                />
              </>
            ) : (
              <Delayed what="Indicator rows" />
            )}
          </div>
        )}

        {tab === 'news' && (
          <div>
            {sentiment ? (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Headline distribution
                      </span>
                      <span className="text-sm font-bold">{sentiment.sentiment_label}</span>
                    </div>
                    {(() => {
                      const pos = sentiment.positive_pct ?? 0;
                      const neu = sentiment.neutral_pct ?? 0;
                      const neg = sentiment.negative_pct ?? 0;
                      const total = pos + neu + neg;
                      const p = (v: number) => (total > 0 ? (v / total) * 100 : v);
                      return (
                        <>
                          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted/70" aria-hidden="true">
                            <span className="bg-success" style={{ width: `${p(pos)}%` }} />
                            <span className="bg-muted-foreground/50" style={{ width: `${p(neu)}%` }} />
                            <span className="bg-destructive" style={{ width: `${p(neg)}%` }} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                            <span>Positive {Math.round(p(pos))}%</span>
                            <span>Neutral {Math.round(p(neu))}%</span>
                            <span>Negative {Math.round(p(neg))}%</span>
                          </div>
                        </>
                      );
                    })()}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Stat label="Score" value={`${(sentiment.score ?? sentiment.sentiment_score ?? 0).toFixed(2)}`} />
                      <Stat label="Articles scored" value={String(sentiment.news_count ?? sentiment.relevant_article_count ?? '—')} />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">7-day trend</span>
                    <div className="mt-2">
                      <Sparkline
                        points={(sentiment.sentiment_trend_7d || []).map((t) => t.score).filter((v) => isFinite(v))}
                        width={260}
                        height={56}
                        ariaLabel="7-day sentiment score trend"
                        className="w-full"
                      />
                    </div>
                    <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mood</span>
                    <p className="text-sm font-medium">{sentiment.market_mood}</p>
                    {sentiment.drivers && sentiment.drivers.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {sentiment.drivers.slice(0, 3).map((d) => (
                          <li key={d.category} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{d.category}</span>
                            <span className={cn('shrink-0 font-semibold', d.direction === 'positive' ? 'text-success' : d.direction === 'negative' ? 'text-destructive' : 'text-muted-foreground')}>
                              {d.direction} · {d.article_count} articles
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top headlines</span>
                  {headlines.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No recent headlines in this snapshot.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {headlines.map((h) => (
                        <a
                          key={h.url + h.title}
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/30"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1 text-xs font-semibold leading-snug line-clamp-2" title={h.title}>
                              {h.title}
                            </span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[h.tone]}`}>
                              {h.label}
                            </span>
                          </span>
                          <span className="mt-auto block text-[10px] text-muted-foreground">
                            {h.source}
                            {h.date ? ` · ${h.date}` : ''}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Bullets
                  items={[
                    'The share bar splits headlines into positive, neutral and negative — it is not a price signal.',
                    'Each headline links to its source with the sentiment label assigned in this snapshot.',
                    'Mood, drivers and counts reflect what the provider returned — they change as articles arrive.',
                  ]}
                />
              </>
            ) : (
              <Delayed what="Sentiment scoring" />
            )}
          </div>
        )}

        {tab === 'forecast' && (
          <div>
            {forecast ? (
              <>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                  <ForecastMini forecast={forecast} />
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          bundle.outlook?.direction === 'up'
                            ? TONE_CLS.bull
                            : bundle.outlook?.direction === 'down'
                              ? TONE_CLS.bear
                              : TONE_CLS.mute
                        }`}
                      >
                        Model direction:{' '}
                        {bundle.outlook?.direction === 'up'
                          ? 'Up'
                          : bundle.outlook?.direction === 'down'
                            ? 'Down'
                            : bundle.outlook?.direction === 'flat'
                              ? 'Flat'
                              : '—'}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS.mute}`}>
                        Historical fit shown
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS.mute}`}>
                        10 trading days
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      10-session close-price outlook from the ONNX LSTM pipeline — 60-day lookback, recursive
                      step-ahead, evaluated with MAPE-based error. Values shown unmodified; uncertainty grows
                      with every session.
                    </p>
                  </div>
                </div>
                <Bullets
                  items={[
                    'The dashed line is the model projection and starts at the last trading session.',
                    'Only the model direction is summarized — no target prices are shown here.',
                    'Model output for research context — not a price target and not a recommendation.',
                  ]}
                />
              </>
            ) : (
              <Delayed what="The model outlook" />
            )}
          </div>
        )}

        <div className="mt-5 border-t border-border/50 pt-4">
          <Link href={activeDef.href(ticker)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            {activeDef.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        </div>
      </div>
    </section>
  );
}
