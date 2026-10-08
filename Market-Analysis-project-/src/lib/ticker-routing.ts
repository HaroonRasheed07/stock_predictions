/**
 * Shared ticker URL routing rules for StockVantex.
 *
 * Canonical research URLs are lowercase (`/stocks/msft`); the backend always
 * receives the uppercase form (`MSFT`). These helpers are the single source of
 * truth for path validation, case normalization, and `?ticker=` deep links.
 */

/**
 * A researchable symbol path segment: 1–10 characters, starts alphanumeric,
 * may continue with alphanumerics, `.`, `-`, `_` (covers `BRK-B`, `BTC-USD`).
 * Anything else is not a symbol we can resolve, so it is a genuine 404.
 */
const SYMBOL_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.\-_]{0,9}$/;

export function isValidSymbolPath(raw: string): boolean {
  return SYMBOL_PATH_PATTERN.test(raw);
}

/** Canonical (lowercase) path segment for a symbol URL, or null when invalid. */
export function normalizeSymbolPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!isValidSymbolPath(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Uppercase ticker form expected by the backend API. */
export function toApiTicker(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Lowercase ticker form used in canonical URLs and query keys. */
export function toUrlSymbol(symbol: string): string {
  return symbol.trim().toLowerCase();
}

/**
 * Parses a `?ticker=` deep-link value (e.g. `/markets/stock/technical?ticker=msft`).
 * Returns the uppercase ticker or null when the parameter is missing/invalid.
 */
export function parseTickerParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!isValidSymbolPath(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** The analysis views selectable via `?view=` on `/stocks/[symbol]`. */
export const STOCK_VIEWS = ['overview', 'technical', 'sentiment', 'risk', 'forecast'] as const;
export type StockView = (typeof STOCK_VIEWS)[number];

export function normalizeStockView(raw: string | null | undefined): StockView {
  return raw && (STOCK_VIEWS as readonly string[]).includes(raw) ? (raw as StockView) : 'overview';
}
