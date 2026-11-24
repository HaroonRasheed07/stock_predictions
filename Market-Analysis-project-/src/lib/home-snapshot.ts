export interface CacheMetaLike {
  created_at?: number;
  updated_at?: number;
  fresh_until?: number;
  is_stale?: boolean;
  refresh_in_progress?: boolean;
  status?: string;
}

export interface DiscoverStockLike {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal: string;
  risk: string;
  technical: string;
  sentiment: string;
  sentiment_status: 'sufficient' | 'insufficient' | 'error';
  score: number;
}

export interface OpportunityFactorLike {
  name: string;
  impact: number;
  value: string;
  detail: string;
}

export interface OpportunityScoreLike {
  ticker: string;
  name: string;
  asset_class: string;
  score: number;
  price: number;
  change: number;
  change_percent: number;
  factors: OpportunityFactorLike[];
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
  movers: DiscoverStockLike[];
  oversold: RsiRow[];
  overbought: RsiRow[];
  highRisk: DiscoverStockLike[];
}

export interface MarketSnapshot {
  stocks: DiscoverStockLike[];
  opportunities: OpportunityScoreLike[];
  breadth: BreadthSummary | null;
  scan: ScanBuckets | null;
  highRiskCount: number;
  available: boolean;
  hasSnapshot: boolean;
  updatedAt: number | null;
  isStale: boolean;
  degraded: boolean;
  refreshFailed: boolean;
  errors: string[];
}

export interface MarketSnapshotPayload {
  stocks?: Record<string, unknown> | unknown[] | null;
  opportunities?: unknown[] | null;
  _cache_meta?: CacheMetaLike | null;
  source_updated_at?: number | null;
  degraded?: boolean;
  errors?: unknown[] | string | null;
}

const TECHNICAL_VALUES = ['Bullish', 'Bearish', 'Neutral'];
const RISK_VALUES = ['High', 'Moderate', 'Low'];
const SENTIMENT_VALUES = ['Bullish', 'Bearish', 'Neutral'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function oneOf(value: unknown, values: string[], fallback: string): string {
  const match = values.find((v) => v.toLowerCase() === text(value).toLowerCase());
  return match || fallback;
}

export function normalizeDiscoverStock(raw: unknown, key?: string): DiscoverStockLike | null {
  if (!isRecord(raw)) return null;
  const ticker = text(raw.ticker ?? raw.symbol ?? key).toUpperCase();
  const price = finite(raw.price);
  const changePercent = finite(raw.changePercent ?? raw.change_percent);
  if (!ticker || price === null || changePercent === null) return null;
  return {
    ticker,
    name: text(raw.name, ticker),
    price,
    change: finite(raw.change) ?? 0,
    changePercent,
    signal: oneOf(raw.signal, TECHNICAL_VALUES, 'Neutral'),
    risk: oneOf(raw.risk, RISK_VALUES, 'Moderate'),
    technical: oneOf(raw.technical, TECHNICAL_VALUES, 'Neutral'),
    sentiment: oneOf(raw.sentiment, SENTIMENT_VALUES, 'Neutral'),
    sentiment_status: oneOf(raw.sentiment_status, ['sufficient', 'insufficient', 'error'], 'sufficient') as 'sufficient' | 'insufficient' | 'error',
    score: finite(raw.score) ?? 0,
  };
}

export function normalizeOpportunity(raw: unknown): OpportunityScoreLike | null {
  if (!isRecord(raw)) return null;
  const ticker = text(raw.ticker ?? raw.symbol).toUpperCase();
  if (!ticker) return null;
  const factors = Array.isArray(raw.factors)
    ? raw.factors
        .map((factor) => {
          if (!isRecord(factor)) return null;
          const name = text(factor.name);
          if (!name) return null;
          return {
            name,
            impact: finite(factor.impact) ?? 0,
            value: text(factor.value),
            detail: text(factor.detail),
          };
        })
        .filter((factor): factor is OpportunityFactorLike => factor !== null)
    : [];
  return {
    ticker,
    name: text(raw.name, ticker),
    asset_class: text(raw.asset_class, 'equity'),
    score: finite(raw.score) ?? 0,
    price: finite(raw.price) ?? 0,
    change: finite(raw.change) ?? 0,
    change_percent: finite(raw.change_percent ?? raw.changePercent) ?? 0,
    factors,
  };
}

export function parseRsi(op: OpportunityScoreLike): number | null {
  const factor = (op.factors || []).find((f) => /RSI/i.test(f.name));
  if (!factor) return null;
  const match = /RSI:\s*([0-9]+(?:\.[0-9]+)?)/.exec(factor.detail || '');
  if (!match) return null;
  const value = parseFloat(match[1]);
  return isFinite(value) ? value : null;
}

export function buildBreadth(stocks: DiscoverStockLike[] | Record<string, DiscoverStockLike>): BreadthSummary | null {
  const list = Array.isArray(stocks) ? stocks : Object.values(stocks);
  if (list.length === 0) return null;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let moveSum = 0;
  for (const stock of list) {
    const technical = (stock.technical || '').toLowerCase();
    if (technical.includes('bullish')) bullish++;
    else if (technical.includes('bearish')) bearish++;
    else neutral++;
    const move = finite(stock.changePercent) ?? 0;
    moveSum += move;
    if (move > 0.0001) advancers++;
    else if (move < -0.0001) decliners++;
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
  stocks: DiscoverStockLike[] | Record<string, DiscoverStockLike>,
  opportunities: OpportunityScoreLike[]
): ScanBuckets | null {
  const list = Array.isArray(stocks) ? stocks : Object.values(stocks);
  if (list.length === 0) return null;
  const byAbsMove = [...list].sort(
    (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
  );
  const highRisk = list
    .filter((stock) => (stock.risk || '').toLowerCase() === 'high')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
  const rsiRows: RsiRow[] = [];
  for (const op of opportunities) {
    const rsi = parseRsi(op);
    if (rsi === null) continue;
    rsiRows.push({
      ticker: op.ticker,
      name: op.name || op.ticker,
      price: op.price ?? 0,
      changePercent: op.change_percent ?? 0,
      rsi,
    });
  }
  return {
    movers: byAbsMove.slice(0, 8),
    oversold: rsiRows.filter((row) => row.rsi < 40).sort((a, b) => a.rsi - b.rsi).slice(0, 6),
    overbought: rsiRows.filter((row) => row.rsi > 60).sort((a, b) => b.rsi - a.rsi).slice(0, 6),
    highRisk,
  };
}

export function snapshotTimestamp(meta: CacheMetaLike | null | undefined, fallback: number | null = null): number | null {
  const raw = finite(meta?.updated_at);
  if (raw === null || raw <= 0) return fallback;
  const seconds = raw > 1e12 ? Math.floor(raw / 1000) : raw;
  return seconds > 0 ? seconds : fallback;
}

export function snapshotAgeMinutes(updatedAt: number | null, nowMs = Date.now()): number | null {
  if (updatedAt === null || updatedAt <= 0) return null;
  const minutes = Math.floor(nowMs / 1000 - updatedAt);
  if (!isFinite(minutes) || minutes < 0) return 0;
  return Math.floor(minutes / 60);
}

function normalizeErrors(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(typeof item === 'string' ? item : isRecord(item) ? item.message ?? item.detail : ''))
    .filter(Boolean);
}

function stocksFromPayload(stocks: MarketSnapshotPayload['stocks']): DiscoverStockLike[] {
  const entries: Array<[string, unknown]> = Array.isArray(stocks)
    ? stocks.map((row, index) => [String(index), row])
    : isRecord(stocks)
      ? Object.entries(stocks)
      : [];
  const byTicker = new Map<string, DiscoverStockLike>();
  for (const [key, raw] of entries) {
    const stock = normalizeDiscoverStock(raw, key);
    if (stock) byTicker.set(stock.ticker, stock);
  }
  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function opportunitiesFromPayload(opportunities: MarketSnapshotPayload['opportunities']): OpportunityScoreLike[] {
  if (!Array.isArray(opportunities)) return [];
  const byTicker = new Map<string, OpportunityScoreLike>();
  for (const raw of opportunities) {
    const opportunity = normalizeOpportunity(raw);
    if (opportunity) byTicker.set(opportunity.ticker, opportunity);
  }
  return Array.from(byTicker.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function mergeByTicker<T extends { ticker: string }>(current: T[], incoming: T[]): T[] {
  const byTicker = new Map<string, T>();
  for (const row of current) byTicker.set(row.ticker, row);
  for (const row of incoming) byTicker.set(row.ticker, row);
  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function mergeSnapshots(
  current: MarketSnapshot | null,
  incoming: MarketSnapshot | null,
  refreshFailed = false
): MarketSnapshot {
  if (!current) {
    return (
      incoming || {
        stocks: [],
        opportunities: [],
        breadth: null,
        scan: null,
        highRiskCount: 0,
        available: false,
        hasSnapshot: false,
        updatedAt: null,
        isStale: false,
        degraded: false,
        refreshFailed,
        errors: [],
      }
    );
  }
  if (!incoming) {
    return { ...current, refreshFailed, isStale: current.isStale || refreshFailed };
  }
  const stocks = mergeByTicker(current.stocks, incoming.stocks);
  const opportunities = mergeByTicker(current.opportunities, incoming.opportunities);
  const updatedAt =
    incoming.updatedAt !== null && current.updatedAt !== null
      ? Math.max(incoming.updatedAt, current.updatedAt)
      : incoming.updatedAt ?? current.updatedAt;
  return {
    stocks,
    opportunities,
    breadth: buildBreadth(stocks),
    scan: buildScanBuckets(stocks, opportunities),
    highRiskCount: stocks.filter((stock) => (stock.risk || '').toLowerCase() === 'high').length,
    available: stocks.length > 0,
    hasSnapshot: stocks.length > 0,
    updatedAt,
    isStale: current.isStale || incoming.isStale || incoming.degraded || refreshFailed,
    degraded: current.degraded || incoming.degraded,
    refreshFailed,
    errors: Array.from(new Set([...current.errors, ...incoming.errors])),
  };
}

export function buildMarketSnapshot(
  payload: MarketSnapshotPayload | null | undefined,
  previous: MarketSnapshot | null = null
): MarketSnapshot {
  const stocks = stocksFromPayload(payload?.stocks);
  const opportunities = opportunitiesFromPayload(payload?.opportunities);
  const errors = normalizeErrors(payload?.errors);
  const degraded = Boolean(payload?.degraded) || errors.length > 0;
  const sourceUpdatedAt = finite(payload?.source_updated_at);
  const updatedAt = sourceUpdatedAt && sourceUpdatedAt > 0
    ? sourceUpdatedAt > 1e12
      ? Math.floor(sourceUpdatedAt / 1000)
      : sourceUpdatedAt
    : snapshotTimestamp(payload?._cache_meta, previous?.updatedAt);
  const merged = mergeSnapshots(previous, {
    stocks,
    opportunities,
    breadth: buildBreadth(stocks),
    scan: buildScanBuckets(stocks, opportunities),
    highRiskCount: stocks.filter((stock) => (stock.risk || '').toLowerCase() === 'high').length,
    available: stocks.length > 0,
    hasSnapshot: stocks.length > 0,
    updatedAt,
    isStale: degraded || Boolean(payload?._cache_meta?.is_stale),
    degraded,
    refreshFailed: false,
    errors,
  });
  return merged;
}

export function validateMarketSnapshotResponse(value: unknown): MarketSnapshotPayload | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.stocks) && !Array.isArray(value.stocks)) return null;
  if (!Array.isArray(value.opportunities)) return null;
  if (value._cache_meta !== undefined && value._cache_meta !== null && !isRecord(value._cache_meta)) return null;
  return value as unknown as MarketSnapshotPayload;
}

export function validateMarketSnapshot(value: unknown): MarketSnapshot | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.stocks) || !Array.isArray(value.opportunities)) return null;
  const stocks = value.stocks
    .map((row) => normalizeDiscoverStock(row))
    .filter((row): row is DiscoverStockLike => row !== null);
  const opportunities = value.opportunities
    .map((row) => normalizeOpportunity(row))
    .filter((row): row is OpportunityScoreLike => row !== null);
  const updatedAt = finite(value.updatedAt);
  return {
    stocks,
    opportunities,
    breadth: buildBreadth(stocks),
    scan: buildScanBuckets(stocks, opportunities),
    highRiskCount: stocks.filter((stock) => (stock.risk || '').toLowerCase() === 'high').length,
    available: stocks.length > 0,
    hasSnapshot: stocks.length > 0,
    updatedAt: updatedAt && updatedAt > 0 ? updatedAt : null,
    isStale: Boolean(value.isStale),
    degraded: Boolean(value.degraded),
    refreshFailed: Boolean(value.refreshFailed),
    errors: normalizeErrors(value.errors),
  };
}
