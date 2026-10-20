import { formatPct } from '@/components/home/format';

type Props = {
  rows: Record<string, any>[];
  ticker: string;
};

const W = 600;
const H = 200;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;

/**
 * Inline SVG area chart of the daily close series — no external charting
 * dependency on the homepage (server-rendered, zero JS).
 */
export function HeroAreaChart({ rows, ticker }: Props) {
  const points: Array<{ t: number; c: number }> = [];
  for (const r of rows) {
    const c = Number(r?.Close);
    const t = new Date(String(r?.Date ?? '')).getTime();
    if (isFinite(c) && !isNaN(t)) points.push({ t, c });
  }
  const data = points.slice(-126);
  const hasData = data.length >= 2;

  let line = '';
  let area = '';
  let min = 0;
  let max = 0;
  let change = 0;
  let firstDate = '';
  let lastDate = '';
  let lastPrice = 0;

  if (hasData) {
    const closes = data.map((d) => d.c);
    min = Math.min(...closes);
    max = Math.max(...closes);
    const span = max - min || 1;
    const xOf = (i: number) => (i / (data.length - 1)) * W;
    const yOf = (c: number) => PAD_TOP + (1 - (c - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

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

  const up = change >= 0;

  return (
    <div
      className="relative h-[240px] w-full md:h-[300px]"
      style={{ color: up ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
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

          <span className="absolute left-3 top-2 pill pill-mute tabular-nums">
            {min.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – {max.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={up ? 'absolute right-3 top-2 pill pill-bull tabular-nums' : 'absolute right-3 top-2 pill pill-bear tabular-nums'}>
            {formatPct(change)}
          </span>
          <span className="absolute bottom-2 left-3 text-[10px] font-medium text-muted-foreground">{firstDate}</span>
          <span className="absolute bottom-2 right-3 text-[10px] font-medium text-muted-foreground">
            {lastDate} · ${lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
