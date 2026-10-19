/**
 * Inline SVG sparkline — no chart library, no fake data.
 * Renders nothing but a rule when there are fewer than two real points.
 */
export function Sparkline({
  points,
  width = 88,
  height = 26,
  strokeWidth = 1.5,
  className,
  ariaLabel,
}: {
  points: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}) {
  if (!Array.isArray(points) || points.length < 2) {
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{ display: 'inline-block', width, height, borderBottom: '1px dashed currentColor', opacity: 0.35 }}
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = strokeWidth;
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p - min) / span) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const up = points[points.length - 1] >= points[0];
  const color = up ? 'var(--spark-up, #16a34a)' : 'var(--spark-down, #dc2626)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel || 'Recent price trend'}
      focusable="false"
    >
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
