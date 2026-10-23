/**
 * Homepage server data layer (ISR, revalidate 600).
 *
 * Every fetch here is wrapped so `getHomeData()` NEVER throws: the homepage
 * must always render a complete snapshot (possibly labeled "data delayed"),
 * never an empty/loading state. Forecast and sentiment are read through the
 * existing interfaces (`fetchForecast`, `fetchSentiment`) and passed through
 * unchanged — nothing in this file recomputes model output.
 */
import YahooFinance from 'yahoo-finance2';
import {
  fetchDiscoverScanAll,
  fetchOpportunityScanAll,
  fetchHomeBrief,
  fetchMarketOverview,
  fetchForecast,
  fetchIndicators,
  fetchSentiment,
  type DiscoverStock,
  type OpportunityScore,
  type MarketOverviewResponse,
  type ForecastResponse,
  type IndicatorsResponse,
  type EnhancedSentiment,
  type CacheMeta,
} from '@/lib/api';
import { getAllAllowlistedSymbols, getStockInfo } from '@/lib/stock-allowlist';
import { deriveOutlook, type ModelOutlook } from '@/lib/model-outlook';
import { normalizeOverviewSentiment } from '@/lib/overview-sentiment';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://stock-predictions-b6yx.onrender.com';

/** ISR window for the homepage. */
export const HOME_REVALIDATE = 600;

/** Ticker chip pool under the hero brief card; four chips rotate once per day. */
const CHIP_POOL = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META',
  'GOOGL', 'AMD', 'NFLX', 'JPM', 'V', 'INTC',
];

/** Four chips for today — deterministic rotation by UTC calendar day. */
export function getDailyChips(): string[] {
  const valid = CHIP_POOL.filter((t) => getStockInfo(t));
  if (valid.length === 0) return [];
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const offset = dayIndex % valid.length;
  return [...valid.slice(offset), ...valid.slice(0, offset)].slice(0, 4);
}

export interface IndexQuote {
  symbol: string;
  label: string;
  value: number | null;
  changePercent: number | null;
  points: number[];
}

export interface MarketStatusView {
  status: string;
  label: string;
  timezone: string;
  next_open: string | null;
  next_close: string | null;
  source: 'backend' | 'local';
}

export interface BreadthSummary {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  avgMove: number;
}

export interface RsiRow {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  rsi: number;
}

export interface ScanBuckets {
  movers: DiscoverStock[];
  oversold: RsiRow[];
  overbought: RsiRow[];
  highRisk: DiscoverStock[];
}

export interface HeroBundle {
  ticker: string;
  name: string;
  overview: MarketOverviewResponse | null;
  indicators: IndicatorsResponse | null;
  forecast: ForecastResponse | null;
  sentiment: EnhancedSentiment | null;
  outlook: ModelOutlook | null;
  /** Discover-scan row for the featured ticker (price/change fallbacks). */
  discover: DiscoverStock | null;
  delayed: boolean;
}

export interface DisagreeCardData {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  technical: string;
  sentiment: string;
  modelDirection: 'up' | 'down' | 'flat' | null;
  mismatch: 'technical-vs-model' | 'technical-vs-sentiment' | null;
}

export interface HomeData {
  indexes: IndexQuote[];
  status: MarketStatusView;
  discover: DiscoverStock[];
  discoverAvailable: boolean;
  breadth: BreadthSummary | null;
  scan: ScanBuckets | null;
  hero: HeroBundle;
  chips: Array<{ ticker: string; name: string; price: number; changePercent: number }>;
  disagreements: DisagreeCardData[];
  modelAvailable: boolean;
  highRiskCount: number;
  updatedMinutesAgo: number | null;
  indicesDelayed: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safe<T>(promise: Promise<T>, ms = 10000): Promise<T | null> {
  return promise.then((v) => v).catch(() => null);
}

function newestUpdatedAt(...metas: Array<CacheMeta | undefined>): number | null {
  let best: number | null = null;
  for (const meta of metas) {
    const raw = meta?.updated_at;
    if (typeof raw !== 'number' || !isFinite(raw) || raw <= 0) continue;
    const sec = raw > 1e12 ? Math.floor(raw / 1000) : raw;
    if (best === null || sec > best) best = sec;
  }
  return best;
}

function minutesSince(epochSec: number | null): number | null {
  if (epochSec === null) return null;
  const mins = Math.floor((Date.now() / 1000 - epochSec) / 60);
  if (!isFinite(mins) || mins < 0) return 0;
  return Math.min(mins, 999);
}

// ─── market indices (Yahoo Finance, no backend endpoint exists) ─────────────

const INDEX_DEFS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^VIX', label: 'VIX' },
];

let yfClient: InstanceType<typeof YahooFinance> | null = null;
function yahoo(): InstanceType<typeof YahooFinance> {
  if (!yfClient) {
    yfClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yfClient;
}

/** Primary source: backend /api/market/indices (real daily closes, SWR-cached). */
async function fetchBackendIndices(): Promise<IndexQuote[] | null> {
  try {
    const res = await withTimeout(fetch(`${API_BASE}/api/market/indices`), 12000);
    if (!res.ok) return null;
    const data = (await res.json()) as { indexes?: Array<Partial<IndexQuote>> };
    const arr = Array.isArray(data?.indexes) ? data.indexes : [];
    const out: IndexQuote[] = [];
    for (const row of arr) {
      if (!row || typeof row.symbol !== 'string' || typeof row.label !== 'string') continue;
      if (typeof row.value !== 'number' || !isFinite(row.value)) continue;
      out.push({
        symbol: row.symbol,
        label: row.label,
        value: row.value,
        changePercent:
          typeof row.changePercent === 'number' && isFinite(row.changePercent)
            ? row.changePercent
            : null,
        points: Array.isArray(row.points)
          ? row.points.filter((p): p is number => typeof p === 'number' && isFinite(p))
          : [],
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Fallback source: Yahoo directly (best-effort; rate-limited IPs skip to delayed state). */
async function fetchYahooIndices(): Promise<IndexQuote[]> {
  const results = await Promise.allSettled(
    INDEX_DEFS.map(async (def) => {
      const chart = await withTimeout(
        yahoo().chart(def.symbol, {
          period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          interval: '1h',
        }),
        9000
      );
      const meta = (chart.meta ?? {}) as Record<string, any>;
      const quotes = Array.isArray(chart.quotes) ? chart.quotes : [];
      const points: number[] = [];
      for (const q of quotes) {
        const c = q?.close;
        if (typeof c === 'number' && isFinite(c)) points.push(c);
      }
      const value =
        typeof meta.regularMarketPrice === 'number' && isFinite(meta.regularMarketPrice)
          ? meta.regularMarketPrice
          : points.length > 0
            ? points[points.length - 1]
            : null;
      const prev =
        meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose;
      const changePercent =
        typeof prev === 'number' && isFinite(prev) && prev !== 0 && typeof value === 'number'
          ? ((value - prev) / prev) * 100
          : null;
      return {
        symbol: def.symbol,
        label: def.label,
        value,
        changePercent,
        points,
      } satisfies IndexQuote;
    })
  );

  const out: IndexQuote[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(r.value);
  }
  return out;
}

export async function fetchIndexQuotes(): Promise<IndexQuote[]> {
  const backend = await fetchBackendIndices();
  if (backend) return backend;
  return fetchYahooIndices();
}

// ─── market status (backend → local ET fallback) ────────────────────────────

function localMarketStatus(): MarketStatusView {
  const now = new Date();
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now),
    10
  );
  const etMinute = parseInt(
    new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now),
    10
  );
  const etWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(now);
  const isWeekend = etWeekday === 'Sat' || etWeekday === 'Sun';
  const mins = etHour * 60 + etMinute;

  let status = 'closed';
  let label = 'Market Closed';
  if (!isWeekend && mins >= 570 && mins < 600) {
    status = 'pre_market';
    label = 'Pre-Market';
  } else if (!isWeekend && mins >= 600 && mins <= 960) {
    status = 'open';
    label = 'Market Open';
  } else if (!isWeekend && mins > 960 && mins <= 1200) {
    status = 'after_hours';
    label = 'After Hours';
  }
  return { status, label, timezone: 'America/New_York', next_open: null, next_close: null, source: 'local' };
}

export async function fetchMarketStatusView(): Promise<MarketStatusView> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE}/api/market/status`),
      6000
    );
    if (!res.ok) return localMarketStatus();
    const data = (await res.json()) as Partial<MarketStatusView>;
    if (!data || typeof data.status !== 'string' || !data.label) return localMarketStatus();
    return {
      status: data.status,
      label: data.label,
      timezone: data.timezone || 'America/New_York',
      next_open: data.next_open ?? null,
      next_close: data.next_close ?? null,
      source: 'backend',
    };
  } catch {
    return localMarketStatus();
  }
}

// ─── universe scans (discover + opportunity factors) ────────────────────────

export async function fetchUniverse(): Promise<{
  stocks: Record<string, DiscoverStock>;
  opportunities: OpportunityScore[];
  available: boolean;
  meta: CacheMeta | undefined;
}> {
  const symbols = getAllAllowlistedSymbols();
  const [discover, opps] = await Promise.all([
    safe(withTimeout(fetchDiscoverScanAll(symbols), 18000), 20000),
    safe(withTimeout(fetchOpportunityScanAll(symbols), 22000), 24000),
  ]);
  return {
    stocks: discover?.stocks ?? {},
    opportunities: opps?.scan_results ?? [],
    available: Boolean(discover && discover.count > 0),
    meta: discover?._cache_meta ?? opps?._cache_meta,
  };
}

function parseRsi(op: OpportunityScore): number | null {
  const factor = (op.factors || []).find((f) => /RSI/i.test(f.name));
  if (!factor) return null;
  const m = /RSI:\s*([0-9]+(?:\.[0-9]+)?)/.exec(factor.detail || '');
  if (!m) return null;
  const v = parseFloat(m[1]);
  return isFinite(v) ? v : null;
}

export function buildBreadth(stocks: Record<string, DiscoverStock>): BreadthSummary | null {
  const list = Object.values(stocks);
  if (list.length === 0) return null;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let moveSum = 0;
  for (const s of list) {
    const t = (s.technical || '').toLowerCase();
    if (t.includes('bullish')) bullish++;
    else if (t.includes('bearish')) bearish++;
    else neutral++;
    const ch = typeof s.changePercent === 'number' && isFinite(s.changePercent) ? s.changePercent : 0;
    moveSum += ch;
    if (ch > 0.0001) advancers++;
    else if (ch < -0.0001) decliners++;
    else unchanged++;
  }
  return {
    total: list.length,
    bullish,
    bearish,
    neutral,
    advancers,
    decliners,
    unchanged,
    avgMove: moveSum / list.length,
  };
}

export function buildScanBuckets(
  stocks: Record<string, DiscoverStock>,
  opportunities: OpportunityScore[]
): ScanBuckets | null {
  const list = Object.values(stocks);
  if (list.length === 0) return null;

  const byAbsMove = [...list].sort(
    (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
  );

  const highRisk = list
    .filter((s) => (s.risk || '').toLowerCase() === 'high')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);

  const rsiRows: RsiRow[] = [];
  for (const op of opportunities) {
    const rsi = parseRsi(op);
    if (rsi === null) continue;
    rsiRows.push({
      ticker: op.ticker,
      name: op.name || getStockInfo(op.ticker)?.name || op.ticker,
      price: op.price ?? 0,
      changePercent: op.change_percent ?? 0,
      rsi,
    });
  }
  const oversold = rsiRows.filter((r) => r.rsi < 40).sort((a, b) => a.rsi - b.rsi).slice(0, 6);
  const overbought = rsiRows.filter((r) => r.rsi > 60).sort((a, b) => b.rsi - a.rsi).slice(0, 6);

  return {
    movers: byAbsMove.slice(0, 8),
    oversold,
    overbought,
    highRisk,
  };
}

// ─── hero bundle ────────────────────────────────────────────────────────────

export async function fetchHeroBundle(ticker: string): Promise<HeroBundle> {
  const name = getStockInfo(ticker)?.name || ticker;
  const [overview, indicators, forecast, sentiment] = await Promise.all([
    safe(withTimeout(fetchMarketOverview(ticker, '6mo'), 15000), 17000),
    safe(withTimeout(fetchIndicators(ticker, '1y'), 10000), 12000),
    safe(withTimeout(fetchForecast(ticker, 10, '1y'), 12000), 14000),
    safe(withTimeout(fetchSentiment(ticker), 20000), 22000),
  ]);
  return {
    ticker,
    name,
    overview,
    indicators,
    forecast,
    sentiment: sentiment ?? normalizeOverviewSentiment(overview?.sentiment),
    outlook: deriveOutlook(forecast, overview?.currentPrice ?? null),
    discover: null,
    delayed: !overview,
  };
}

// ─── disagreement cards ─────────────────────────────────────────────────────

function modelDirectionOf(forecast: ForecastResponse | null, currentPrice: number | null): 'up' | 'down' | 'flat' | null {
  return deriveOutlook(forecast, currentPrice)?.direction ?? null;
}

export async function fetchDisagreements(
  stocks: Record<string, DiscoverStock>,
  heroTicker: string
): Promise<{ cards: DisagreeCardData[]; modelAvailable: boolean }> {
  const candidates = Object.values(stocks)
    .filter((s) => s.ticker !== heroTicker)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
    .slice(0, 8);

  const forecasts = await Promise.all(
    candidates.map((s) => safe(withTimeout(fetchForecast(s.ticker, 10, '1y'), 9000), 11000))
  );
  const modelAvailable = forecasts.some((f) => f !== null);

  const cards: DisagreeCardData[] = [];
  for (let i = 0; i < candidates.length && cards.length < 4; i++) {
    const s = candidates[i];
    const technical = s.technical || 'Neutral';
    const sentiment = s.sentiment || 'Neutral';
    const model = modelAvailable ? modelDirectionOf(forecasts[i], s.price ?? null) : null;
    const technicalDir = technical.toLowerCase().includes('bullish') ? 'up'
      : technical.toLowerCase().includes('bearish') ? 'down' : 'flat';
    const sentimentDir = sentiment.toLowerCase().includes('bull') || sentiment.toLowerCase().includes('positive') ? 'up'
      : sentiment.toLowerCase().includes('bear') || sentiment.toLowerCase().includes('negative') ? 'down' : 'flat';

    let mismatch: DisagreeCardData['mismatch'] = null;
    if (model && model !== 'flat' && technicalDir !== 'flat' && model !== technicalDir) {
      mismatch = 'technical-vs-model';
    } else if (sentimentDir !== 'flat' && technicalDir !== 'flat' && sentimentDir !== technicalDir) {
      mismatch = 'technical-vs-sentiment';
    }
    if (!mismatch) continue;

    cards.push({
      ticker: s.ticker,
      name: s.name || getStockInfo(s.ticker)?.name || s.ticker,
      price: s.price ?? 0,
      changePercent: s.changePercent ?? 0,
      technical,
      sentiment,
      modelDirection: model,
      mismatch,
    });
  }
  return { cards, modelAvailable };
}

// ─── aggregate ──────────────────────────────────────────────────────────────

export async function getHomeData(): Promise<HomeData> {
  const symbols = getAllAllowlistedSymbols();

  const [indexes, status, brief, universe] = await Promise.all([
    safe(fetchIndexQuotes(), 15000),
    fetchMarketStatusView(),
    safe(withTimeout(fetchHomeBrief(), 6000), 8000),
    fetchUniverse(),
  ]);

  const idx = indexes ?? [];
  const stocks = universe.stocks;
  const dailyChips = getDailyChips();
  const heroTicker =
    brief?.selectedStock?.ticker?.toUpperCase() ||
    dailyChips[0] ||
    symbols[0] ||
    'AAPL';

  const [hero, disagreement] = await Promise.all([
    fetchHeroBundle(heroTicker),
    fetchDisagreements(stocks, heroTicker),
  ]);
  hero.discover = stocks[heroTicker] ?? null;
  hero.name = hero.discover?.name || getStockInfo(heroTicker)?.name || hero.name;

  const chips = dailyChips.map((ticker) => {
    const s = stocks[ticker];
    return {
      ticker,
      name: getStockInfo(ticker)?.name || ticker,
      price: s?.price ?? 0,
      changePercent: s?.changePercent ?? 0,
    };
  });

  const updated = minutesSince(newestUpdatedAt(universe.meta, brief?._cache_meta));

  return {
    indexes: idx,
    status,
    discover: Object.values(stocks),
    discoverAvailable: universe.available,
    breadth: buildBreadth(stocks),
    scan: buildScanBuckets(stocks, universe.opportunities),
    hero,
    chips,
    disagreements: disagreement.cards,
    modelAvailable: disagreement.modelAvailable,
    highRiskCount: Object.values(stocks).filter((s) => (s.risk || '').toLowerCase() === 'high').length,
    updatedMinutesAgo: updated,
    indicesDelayed: idx.length === 0,
  };
}
