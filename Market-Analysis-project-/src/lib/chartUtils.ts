'use client';

import { useEffect, useState } from 'react';

// ─── Breakpoint Hook ───────────────────────────────────────────────
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

// ─── Responsive Heights (px) ───────────────────────────────────────
export const CHART_HEIGHTS = {
  priceHistory: { mobile: 240, desktop: 300 },
  forecast: { mobile: 260, desktop: 400 },
  priceAction: { mobile: 240, desktop: 400 },
  bollinger: { mobile: 220, desktop: 300 },
  candlestick: { mobile: 360, desktop: 520 },
  sentimentTrend: { mobile: 160, desktop: 180 },
  mini: { mobile: 120, desktop: 150 },
} as const;

// ─── Responsive Margins ────────────────────────────────────────────
export function chartMargins(isMobile: boolean) {
  return isMobile
    ? { top: 5, right: 8, left: -10, bottom: 0 }
    : { top: 5, right: 20, left: 10, bottom: 0 };
}

// ─── Recharts Tick Config ──────────────────────────────────────────
export function axisTickStyle(isMobile: boolean) {
  return {
    fontSize: isMobile ? 10 : 12,
    fill: 'hsl(var(--muted-foreground))',
  };
}

export function xAxisConfig(isMobile: boolean, dataLength: number, dataKey = 'date') {
  return {
    dataKey,
    stroke: 'hsl(var(--muted-foreground))',
    tick: axisTickStyle(isMobile),
    minTickGap: isMobile ? 40 : 30,
    interval: isMobile ? Math.max(1, Math.floor(dataLength / 5)) : Math.max(1, Math.floor(dataLength / 10)),
  };
}

export function yAxisConfig(isMobile: boolean, opts?: { domain?: [any, any]; tickFormatter?: (v: number) => string }) {
  return {
    stroke: 'hsl(var(--muted-foreground))',
    tick: axisTickStyle(isMobile),
    width: isMobile ? 48 : 60,
    ...(opts?.domain ? { domain: opts.domain } : {}),
    ...(opts?.tickFormatter ? { tickFormatter: opts.tickFormatter } : {}),
  };
}

// ─── Recharts Tooltip Style ────────────────────────────────────────
export const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  padding: '8px 12px',
};

// ─── Formatting Functions ──────────────────────────────────────────
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatPriceTick(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ─── Canvas Theme Resolution ───────────────────────────────────────
// Single-element batch: resolve all CSS custom properties in ONE forced reflow
// instead of N separate append/remove cycles.
let _themeCache: Record<string, CanvasTheme> = {};

function resolveCssColorsBatch(cssValues: string[]): string[] {
  try {
    const tmp = document.createElement('div');
    tmp.style.display = 'none';
    tmp.style.position = 'absolute';
    tmp.style.visibility = 'hidden';
    document.body.appendChild(tmp);
    const results = cssValues.map((v) => {
      tmp.style.color = v;
      return getComputedStyle(tmp).color || v;
    });
    document.body.removeChild(tmp);
    return results;
  } catch {
    return cssValues;
  }
}

export function resolveCssColor(cssValue: string): string {
  try {
    const tmp = document.createElement('div');
    tmp.style.color = cssValue;
    tmp.style.display = 'none';
    document.body.appendChild(tmp);
    const resolved = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    return resolved || cssValue;
  } catch {
    return cssValue;
  }
}

export interface CanvasTheme {
  muted: string;
  border: string;
  primary: string;
  success: string;
  destructive: string;
  warning: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  isDark: boolean;
}

// Cache: CSS custom properties don't change at runtime for a given dark/light mode.
// Resolve once per isDark value, reuse forever.
export function getCanvasTheme(isDark: boolean): CanvasTheme {
  const key = isDark ? 'dark' : 'light';
  if (_themeCache[key]) return _themeCache[key];

  const cssVars = [
    'hsl(var(--muted))',
    'hsl(var(--border))',
    'hsl(var(--primary))',
    'hsl(var(--card))',
    'hsl(var(--foreground))',
    'hsl(var(--muted-foreground))',
  ];
  const [muted, border, primary, card, foreground, mutedForeground] = resolveCssColorsBatch(cssVars);

  _themeCache[key] = {
    muted,
    border,
    primary,
    success: '#22c55e',
    destructive: '#ef4444',
    warning: '#f59e0b',
    card,
    foreground,
    mutedForeground,
    isDark,
  };
  return _themeCache[key];
}
