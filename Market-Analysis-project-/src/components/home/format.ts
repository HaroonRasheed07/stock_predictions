export function formatPrice(v: number | null | undefined): string {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(v: number | null | undefined, withSign = true): string {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = withSign ? (v > 0.0001 ? '+' : v < -0.0001 ? '−' : '') : '';
  return `${sign}${abs}%`;
}

export function changeTone(v: number | null | undefined): string {
  if (typeof v !== 'number' || !isFinite(v) || Math.abs(v) < 0.0001) return 'text-muted-foreground';
  return v > 0 ? 'text-green-800 dark:text-success' : 'text-red-700 dark:text-red-400';
}

/** Compact display of a quoted index value (12,345.67 → "12,345.7"). */
export function formatIndex(v: number | null | undefined): string {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatUpdated(minutesAgo: number | null): string | null {
  if (minutesAgo === null) return null;
  if (minutesAgo <= 1) return 'Updated just now';
  if (minutesAgo < 60) return `Updated ${minutesAgo} min ago`;
  const h = Math.floor(minutesAgo / 60);
  return `Updated ${h} hr ago`;
}
