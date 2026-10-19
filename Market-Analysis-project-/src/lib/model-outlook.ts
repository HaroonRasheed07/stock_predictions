/**
 * Pure model-outlook derivation from forecast output (shared by the homepage
 * server layer and client components). Reads `forecast_prices` as produced by
 * the existing forecast interface — never recomputed or rescaled.
 */
import type { ForecastResponse } from '@/lib/api';

export interface ModelOutlook {
  direction: 'up' | 'down' | 'flat';
  first: number;
  last: number;
  horizonDays: number;
}

export function deriveOutlook(
  forecast: ForecastResponse | null | undefined,
  currentPrice: number | null | undefined
): ModelOutlook | null {
  const prices = forecast?.results?.forecast_prices;
  if (!prices || prices.length < 2) return null;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (!isFinite(first) || !isFinite(last)) return null;
  const ref = currentPrice && currentPrice > 0 ? currentPrice : first;
  const pct = (last - ref) / ref;
  const direction: ModelOutlook['direction'] = pct > 0.003 ? 'up' : pct < -0.003 ? 'down' : 'flat';
  return { direction, first, last, horizonDays: prices.length };
}
