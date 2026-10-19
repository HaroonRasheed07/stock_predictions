/**
 * Homepage insight computations — pure functions over existing API responses.
 *
 * Every input comes from read-only interfaces (discover scan, indicators,
 * forecast responses, allowlist). Outputs are neutral, descriptive counts and
 * labels only — never advice, never invented numbers.
 */
import type { DiscoverStock } from '@/lib/api';
import type { IndicatorsResponse, ForecastResponse } from '@/lib/api';
import { getStockInfo } from '@/lib/stock-allowlist';

export type ForecastDirection = 'up' | 'down' | 'flat';

/** Direction of the model path: first vs last projected price. */
export function forecastDirection(forecast: ForecastResponse | null): ForecastDirection | null {
  const prices = forecast?.results?.forecast_prices;
  if (!prices || prices.length < 2) return null;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (!first || !last) return null;
  const deltaPct = ((last - first) / first) * 100;
  if (deltaPct > 0.5) return 'up';
  if (deltaPct < -0.5) return 'down';
  return 'flat';
}

function lastTwoRows(resp: IndicatorsResponse | null | undefined): {
  last: Record<string, unknown> | null;
  prev: Record<string, unknown> | null;
} {
  const data = resp?.data;
  if (!Array.isArray(data) || data.length < 2) return { last: null, prev: null };
  return {
    last: data[data.length - 1] as Record<string, unknown>,
    prev: data[data.length - 2] as Record<string, unknown>,
  };
}

function num(row: Record<string, unknown> | null, key: string): number | null {
  if (!row) return null;
  const v = row[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function latestRsi(resp: IndicatorsResponse | null | undefined): number | null {
  return num(lastTwoRows(resp).last, 'RSI');
}

export interface MarketRead {
  scanned: number;
  bullish: number;
  bearish: number;
  neutral: number;
  rsiOverbought: number;
  rsiOversold: number;
  highRisk: number;
  conflicts: number;
  sentence: string;
}

/** Counts across the scanned universe. Plain English, no advice. */
export function buildMarketRead(
  stocks: DiscoverStock[],
  indicators: Record<string, IndicatorsResponse | null>,
  conflictCount: number
): MarketRead {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let rsiOverbought = 0;
  let rsiOversold = 0;
  let highRisk = 0;

  for (const s of stocks) {
    if (s.technical === 'Bullish') bullish += 1;
    else if (s.technical === 'Bearish') bearish += 1;
    else neutral += 1;
    if (s.risk === 'High') highRisk += 1;
    const rsi = latestRsi(indicators[s.ticker]);
    if (rsi !== null && rsi >= 70) rsiOverbought += 1;
    else if (rsi !== null && rsi <= 30) rsiOversold += 1;
  }

  const scanned = stocks.length;
  const sentence =
    scanned === 0
      ? 'The tracked-stock scan is being refreshed — counts appear once data arrives.'
      : `Of ${scanned} tracked stocks scanned today, ${bullish} read bullish on trend, ${bearish} read bearish, and ${neutral} are mixed. ` +
        `${rsiOverbought} sit in overbought RSI territory (70+) and ${rsiOversold} in oversold territory (30 or below). ` +
        `${conflictCount} show trend and model direction pointing opposite ways.`;

  return { scanned, bullish, bearish, neutral, rsiOverbought, rsiOversold, highRisk, conflicts: conflictCount, sentence };
}

export interface SignalConflict {
  ticker: string;
  name: string;
  trend: string;
  direction: ForecastDirection;
  explanation: string;
}

/**
 * Stocks where the technical trend label and the model's 10-day path point in
 * opposite directions — each with a one-line, neutral explanation.
 */
export function findSignalConflicts(
  stocks: DiscoverStock[],
  forecasts: Record<string, ForecastResponse | null>
): SignalConflict[] {
  const out: SignalConflict[] = [];
  for (const s of stocks) {
    const dir = forecastDirection(forecasts[s.ticker] ?? null);
    if (!dir || dir === 'flat') continue;
    const trend = s.technical;
    const conflict =
      (trend === 'Bullish' && dir === 'down') || (trend === 'Bearish' && dir === 'up');
    if (!conflict) continue;
    const trendWord = trend === 'Bullish' ? 'bullish' : 'bearish';
    const dirWord = dir === 'up' ? 'upward' : 'downward';
    out.push({
      ticker: s.ticker,
      name: s.name,
      trend,
      direction: dir,
      explanation: `Trend indicators read ${trendWord} while the model's 10-day path slopes ${dirWord} — momentum and the model disagree today.`,
    });
  }
  return out;
}

export interface SignalChange {
  ticker: string;
  name: string;
  kind: 'rsi-crossing' | 'macd-flip' | 'price-move' | 'risk-flag';
  headline: string;
  detail: string;
}

/**
 * "Biggest changes since yesterday": RSI threshold crossings (today vs the
 * prior bar), MACD signal-line flips, the largest moves vs yesterday's close,
 * and high-risk flags. Every claim is computed from returned rows only.
 */
export function findBiggestChanges(
  stocks: DiscoverStock[],
  indicators: Record<string, IndicatorsResponse | null>,
  limit = 8
): SignalChange[] {
  const items: SignalChange[] = [];

  for (const s of stocks) {
    const { last, prev } = lastTwoRows(indicators[s.ticker]);
    const rsiNow = num(last, 'RSI');
    const rsiPrev = num(prev, 'RSI');
    if (rsiNow !== null && rsiPrev !== null) {
      if (rsiPrev < 70 && rsiNow >= 70) {
        items.push({
          ticker: s.ticker, name: s.name, kind: 'rsi-crossing',
          headline: `RSI crossed above 70`,
          detail: `RSI moved from ${rsiPrev.toFixed(0)} to ${rsiNow.toFixed(0)} — the traditional overbought threshold.`,
        });
      } else if (rsiPrev > 30 && rsiNow <= 30) {
        items.push({
          ticker: s.ticker, name: s.name, kind: 'rsi-crossing',
          headline: `RSI crossed below 30`,
          detail: `RSI moved from ${rsiPrev.toFixed(0)} to ${rsiNow.toFixed(0)} — the traditional oversold threshold.`,
        });
      }
    }
    const macdNow = num(last, 'MACD');
    const sigNow = num(last, 'Signal');
    const macdPrev = num(prev, 'MACD');
    const sigPrev = num(prev, 'Signal');
    if (macdNow !== null && sigNow !== null && macdPrev !== null && sigPrev !== null) {
      const wasBull = macdPrev > sigPrev;
      const isBull = macdNow > sigNow;
      if (wasBull !== isBull) {
        items.push({
          ticker: s.ticker, name: s.name, kind: 'macd-flip',
          headline: `MACD signal line ${isBull ? 'flipped bullish' : 'flipped bearish'}`,
          detail: `MACD ${isBull ? 'moved above' : 'moved below'} its signal line on the latest bar.`,
        });
      }
    }
    if (s.risk === 'High') {
      items.push({
        ticker: s.ticker, name: s.name, kind: 'risk-flag',
        headline: `Risk reads High today`,
        detail: `Volatility and trend stability put ${s.ticker} in the high-risk band of the scan.`,
      });
    }
  }

  // Largest moves vs yesterday's close (changePercent is computed server-side
  // against the previous close — genuinely "since yesterday").
  const movers = [...stocks]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 3);
  for (const s of movers) {
    if (Math.abs(s.changePercent) < 0.5) continue;
    items.push({
      ticker: s.ticker, name: s.name, kind: 'price-move',
      headline: `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}% since yesterday's close`,
      detail: `Price ${s.changePercent >= 0 ? 'rose' : 'fell'} from the previous close in the latest session.`,
    });
  }

  return items.slice(0, limit);
}

export interface MoverRow {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  /** Optional — only present when the row came from a full scan. */
  signal?: string;
  technical?: string;
  risk?: string;
}

/** Biggest price movers among the scanned tracked stocks. */
export function biggestMovers(stocks: DiscoverStock[], limit = 6): MoverRow[] {
  return [...stocks]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, limit)
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      changePercent: s.changePercent,
      signal: s.signal,
      technical: s.technical,
      risk: s.risk,
    }));
}

export interface SectorTile {
  ticker: string;
  name: string;
  technical: string;
  risk: string;
  changePercent: number;
  sector: string;
}

export interface SectorGroup {
  sector: string;
  items: SectorTile[];
}

/** Sector-grouped tiles colored by trend/risk (sector from the allowlist). */
export function sectorGroups(stocks: DiscoverStock[]): SectorGroup[] {
  const bySector = new Map<string, SectorTile[]>();
  for (const s of stocks) {
    const info = getStockInfo(s.ticker.toLowerCase());
    const sector = info?.sector || 'Other';
    const arr = bySector.get(sector) || [];
    arr.push({
      ticker: s.ticker,
      name: s.name,
      technical: s.technical,
      risk: s.risk,
      changePercent: s.changePercent,
      sector,
    });
    bySector.set(sector, arr);
  }
  return [...bySector.entries()]
    .map(([sector, items]) => ({ sector, items: items.sort((a, b) => b.changePercent - a.changePercent) }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** "Updated Xm ago" from a cache timestamp (epoch seconds). Null if unusable. */
export function updatedAgoLabel(updatedAtSec: number | undefined, nowMs: number): string | null {
  if (!updatedAtSec || updatedAtSec <= 0) return null;
  const diffMs = nowMs - updatedAtSec * 1000;
  if (diffMs < 0 || diffMs > 48 * 3600 * 1000) return null;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ${minutes % 60}m ago`;
}
