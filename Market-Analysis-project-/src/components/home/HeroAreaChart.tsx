'use client';

import { useRef, useState } from 'react';
import { formatPct, formatPrice } from '@/components/home/format';

type Props = {
  rows: Record<string, any>[];
  ticker: string;
};

const W = 600;
const H = 200;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;

type Datum = { t: number; c: number };

export function HeroAreaChart({ rows, ticker }: Props) {
  const points: Datum[] = [];
  for (const r of rows) {
    const c = Number(r?.Close);
    const t = new Date(String(r?.Date ?? '')).getTime();
    if (isFinite(c) && !isNaN(t)) points.push({ t, c });
  }
  const data = points.slice(-126);
  const hasData = data.length >= 2;

  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  let line = '';
  let area = '';
  let min = 0;
  let max = 0;
  let change = 0;
  let firstDate = '';
  let lastDate = '';
  let lastPrice = 0;
  let xOf: (i: number) => number = () => 0;
  let yOf: (c: number) => number = () => 0;

  if (hasData) {
    const closes = data.map((d) => d.c);
    min = Math.min(...closes);
    max = Math.max(...closes);
    const span = max - min || 1;
    xOf = (i: number) => (i / (data.length - 1)) * W;
    yOf = (c: number) => PAD_TOP + (1 - (c - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

    const coords = data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.c).toFixed(1)}`);
    line = coords.join(' ');
    area = `M${coords.join(' L')} L${W},${H} L0,${H} Z`;

    const first = data[0].c;
    lastPrice = data[data.length - 1].c;
    change = first !== 0 ? ((lastPrice - first) / first) * 100 : 0;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    firstDate = new Date(data[0].t).toLocaleDateString('en-US', opts);
    lastDate = new Date(data[data.length - 1].t).toLocaleDateString('en-US', opts);
  }

  const trackPointer = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || !hasData) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (data.length - 1)));
  };

  const up = change >= 0;
  const hovered = hover !== null && hasData ? data[hover] : null;
  const prev = hovered && hover! > 0 ? data[hover! - 1] : null;
  const dayDelta = hovered && prev ? hovered.c - prev.c : null;
  const dayUp = dayDelta !== null && dayDelta >= 0;
  const hoveredPct = hovered ? (xOf(hover!) / W) * 100 : 0;
  const hoveredYPct = hovered ? (yOf(hovered.c) / H) * 100 : 0;
  const tooltipBelow = hoveredYPct < 32;

  return (
    <div
      ref={wrapRef}
      className="relative h-[240px] w-full md:h-[300px]"
      style={{ color: up ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
      onMouseMove={(e) => trackPointer(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => trackPointer(e.touches[0].clientX)}
      onTouchMove={(e) => trackPointer(e.touches[0].clientX)}
      onTouchEnd={() => setHover(null)}
      {...(hasData
        ? {
            role: 'img',
            'aria-label': `${ticker} closing price, ${firstDate} to ${lastDate}, ${formatPct(change)} over the period`,
          }
        : {})}
    >
      {hasData ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="hero-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={H * f}
                y2={H * f}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
            ))}
            <path d={area} fill="url(#hero-area-fill)" />
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {hovered && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 h-full w-px bg-current opacity-30"
                style={{ left: `${hoveredPct}%` }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                style={{ left: `${hoveredPct}%`, top: `${hoveredYPct}%`, borderColor: 'currentColor' }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-10 min-w-[7.5rem] -translate-x-1/2 rounded-md border border-border/60 bg-card px-2 py-1.5 text-foreground shadow-lg"
                style={{
                  left: `${Math.min(88, Math.max(12, hoveredPct))}%`,
                  top: tooltipBelow ? `calc(${hoveredYPct}% + 14px)` : `calc(${hoveredYPct}% - 14px)`,
                  transform: `translate(-50%, ${tooltipBelow ? '0' : '-100%'})`,
                }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {new Date(hovered.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold tabular-nums">{formatPrice(hovered.c)}</span>
                  {dayDelta !== null && (
                    <span className={`pill tabular-nums ${dayUp ? 'pill-bull' : 'pill-bear'}`}>
                      {formatPct(prev && prev.c !== 0 ? (dayDelta / prev.c) * 100 : 0)}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          <span className="absolute left-3 top-2 pill pill-mute tabular-nums">
            {min.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – {max.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={up ? 'absolute right-3 top-2 pill pill-bull tabular-nums' : 'absolute right-3 top-2 pill pill-bear tabular-nums'}>
            {formatPct(change)}
          </span>
          <span className="absolute bottom-2 left-3 text-[10px] font-medium text-muted-foreground">{firstDate}</span>
          <span className="absolute bottom-2 right-3 text-[10px] font-medium text-muted-foreground">
            {lastDate} · {formatPrice(lastPrice)}
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Chart series unavailable for this snapshot
        </div>
      )}
    </div>
  );
}
