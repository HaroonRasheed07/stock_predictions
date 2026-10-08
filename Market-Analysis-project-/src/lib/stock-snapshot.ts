import { cache } from 'react';
import type { MarketOverviewResponse, ForecastResponse } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://stock-predictions-b6yx.onrender.com";

/** Matches the route's `revalidate` so prerendering stays static (no DynamicServerError). */
const FETCH_OPTS = { next: { revalidate: 3600 } } as RequestInit;

export type SnapshotDataStatus =
  /** Overview payload received and usable. */
  | 'ok'
  /** Backend unreachable / timed out / circuit open — treat as outage, not 404. */
  | 'outage'
  /** Backend answered but does not know this symbol (invalid or nonexistent). */
  | 'invalid-symbol';

export interface StockSnapshot {
  overview: MarketOverviewResponse | null;
  forecast: ForecastResponse | null;
  /** Unix seconds from the backend's cache metadata (when the data was computed). */
  updatedAt: number | null;
  /** True when the backend served stale-while-revalidate data. */
  overviewStale: boolean;
  /** Why the snapshot is empty — lets routes 404 only for genuinely unknown symbols. */
  dataStatus: SnapshotDataStatus;
}

const EMPTY = (dataStatus: SnapshotDataStatus): StockSnapshot => ({
  overview: null,
  forecast: null,
  updatedAt: null,
  overviewStale: false,
  dataStatus,
});

/**
 * Circuit breaker: if the backend is unreachable (network error / timeout),
 * fail fast for a cooldown window instead of stalling builds for 50+ pages.
 */
let backendDownUntil = 0;

interface PostResult<T> {
  data: T | null;
  networkError: boolean;
  /** HTTP status when the server answered with an error, otherwise null. */
  httpStatus: number | null;
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<PostResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      ...FETCH_OPTS,
    });
    if (!res.ok) return { data: null, networkError: false, httpStatus: res.status };
    return { data: (await res.json()) as T, networkError: false, httpStatus: null };
  } catch {
    return { data: null, networkError: true, httpStatus: null };
  }
}

interface OverviewWithMeta extends MarketOverviewResponse {
  _cache_meta?: { updated_at?: number; status?: string; is_stale?: boolean };
}

/**
 * Server-only snapshot for SEO rendering of /stocks/[symbol].
 * - Uses the backend's dual-layer SWR cache (overview: 120s fresh / 24h stale).
 * - Forecast endpoint checks its 15-minute cache before running the model.
 * - Never throws: pages degrade to a no-data state that is rendered as noindex.
 * - React `cache()` dedupes between generateMetadata and the page render pass.
 */
export const getStockSnapshot = cache(async (symbol: string): Promise<StockSnapshot> => {
  if (Date.now() < backendDownUntil) return EMPTY('outage');

  const ov = await postJson<OverviewWithMeta>('/api/market/overview', { ticker: symbol, period: '1y' }, 20000);
  if (ov.networkError) {
    backendDownUntil = Date.now() + 60_000;
    return EMPTY('outage');
  }
  if (ov.httpStatus !== null) {
    // 5xx = provider failure (outage); 4xx = the backend rejected the symbol.
    return EMPTY(ov.httpStatus >= 500 ? 'outage' : 'invalid-symbol');
  }
  const overview = ov.data;
  if (!overview || !overview.currentPrice || !Array.isArray(overview.data) || overview.data.length === 0) {
    // Server answered successfully but produced no series for this symbol.
    return EMPTY('invalid-symbol');
  }

  const meta = overview._cache_meta;
  const updatedAt = typeof meta?.updated_at === 'number' && meta.updated_at > 0 ? meta.updated_at : null;
  const overviewStale = Boolean(meta?.is_stale);

  const fc = await postJson<ForecastResponse>(
    '/api/forecast/onnx',
    { ticker: symbol, forecast_days: 10, period: '1y' },
    15000
  );
  const forecast =
    fc.data && fc.data.results && Array.isArray(fc.data.results.forecast_prices) && fc.data.results.forecast_prices.length > 0
      ? fc.data
      : null;

  return { overview, forecast, updatedAt, overviewStale, dataStatus: 'ok' };
});

export interface TechnicalSnapshot {
  rsi: number | null;
  macd: number | null;
  signalLine: number | null;
  sma20: number | null;
  sma50: number | null;
  close: number | null;
  asOf: string | null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Latest row of the indicator series, with nulls for unavailable values. */
export function extractTechnical(overview: MarketOverviewResponse | null): TechnicalSnapshot | null {
  const rows = overview?.data;
  if (!rows || rows.length === 0) return null;
  const last = rows[rows.length - 1];
  if (!last) return null;
  return {
    rsi: num(last.RSI),
    macd: num(last.MACD),
    signalLine: num(last.Signal),
    sma20: num(last.SMA20),
    sma50: num(last.SMA50),
    close: num(last.Close),
    asOf: typeof last.Date === 'string' ? last.Date : null,
  };
}

export type RsiZone = 'overbought' | 'oversold' | 'neutral';

export function rsiZone(rsi: number | null): RsiZone | null {
  if (rsi === null) return null;
  if (rsi > 70) return 'overbought';
  if (rsi < 30) return 'oversold';
  return 'neutral';
}
