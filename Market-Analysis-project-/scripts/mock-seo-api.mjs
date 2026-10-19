// Local mock of the StockVantex backend for SEO/routing build validation.
// Serves POST /api/market/overview and /api/forecast/onnx with deterministic
// canned data so `next build` never hits the live backend or news providers,
// plus GET /api/multi-asset/search for autocomplete tests.
//
// Symbols: the 52-symbol SEO allowlist (parsed from src/lib/stock-allowlist.ts)
// plus EXTRA_KNOWN (valid non-allowlist tickers used by routing tests).
// Unknown tickers return 404 so routes can prove genuine 404 behavior.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.MOCK_PORT || 8787);
const UPDATED_AT = 1791444000; // fixed unix ts → deterministic "computed" timestamps
const LOG_FILE = path.join(os.tmpdir(), 'mock-seo-requests.log');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTRA_KNOWN = [
  { symbol: 'LYFT', name: 'Lyft, Inc.' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors Company' },
  { symbol: 'MRNA', name: 'Moderna, Inc.' },
];

function loadAllowlist() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'stock-allowlist.ts'), 'utf8');
    const out = [];
    const re = /symbol:\s*'([A-Za-z0-9.\-_]+)',\s*name:\s*(?:'([^']+)'|"([^"]+)")/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      out.push({ symbol: m[1].toUpperCase(), name: m[2] || m[3] || m[1] });
    }
    return out;
  } catch {
    return [];
  }
}

const KNOWN = [...loadAllowlist(), ...EXTRA_KNOWN];
const KNOWN_SET = new Set(KNOWN.map((k) => k.symbol));

function log(line) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch {}
}

function buildRows(ticker) {
  const rows = [];
  let close = 100 + (ticker.charCodeAt(0) % 40);
  const base = new Date('2026-07-01T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    close += Math.sin(i / 3) * 2 + 0.5;
    const d = new Date(base.getTime() + i * 86400000);
    rows.push({
      Date: d.toISOString().slice(0, 10),
      Open: +(close - 0.4).toFixed(2),
      High: +(close + 1.1).toFixed(2),
      Low: +(close - 1.3).toFixed(2),
      Close: +close.toFixed(2),
      Volume: 42000000 + i * 100000,
      SMA20: +(close - 1.5).toFixed(2),
      SMA50: +(close - 3.2).toFixed(2),
      RSI: 62.4,
      MACD: 1.18,
      Signal: 0.94,
      UpperBand: +(close + 4).toFixed(2),
      LowerBand: +(close - 4).toFixed(2),
      ATR: 2.31,
    });
  }
  return rows;
}

function overviewFor(ticker) {
  const rows = buildRows(ticker);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  return {
    ticker,
    data: rows,
    currentPrice: last.Close,
    change: +(last.Close - prev.Close).toFixed(2),
    changePercent: +(((last.Close - prev.Close) / prev.Close) * 100).toFixed(2),
    topStocks: [],
    volatility: { daily_volatility: 24.5, weekly_volatility: 25.1, atr: 2.31 },
    risk: { ticker, risk_level: 'Moderate', risk_score: 48, message: 'Moderate volatility relative to its own history.' },
    trendStrength: { ticker, trend_score: 61.5, trend_label: 'Uptrend' },
    tradeConfirmation: { signal: 'Hold', score: 55, rationale: 'Indicators are mixed in this snapshot.' },
    sentiment: {
      sentiment_label: 'Positive',
      sentiment_score: 0.34,
      positive_count: 7,
      negative_count: 3,
      market_mood: 'Cautiously optimistic',
      news_impact_summary: '[mock] Coverage leans positive over the last session.',
      news: [
        { title: `${ticker} shares steady as sector sentiment improves`, source: 'Market Wire', url: 'https://example.com/news/1', published_at: '2026-10-07T14:05:00Z' },
        { title: `Analysts revisit outlook for ${ticker}`, source: 'Finance Daily', url: 'https://example.com/news/2', published_at: '2026-10-06T09:30:00Z' },
      ],
    },
    watchlist: [],
    marketStatus: 'Open',
    _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' },
  };
}

function forecastFor(ticker) {
  const actual = [];
  const predicted = [];
  const prices = [];
  const dates = [];
  let p = 150;
  const start = new Date('2026-10-08T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    p += Math.sin(i / 4) * 1.5 + 0.3;
    actual.push(+p.toFixed(2));
    predicted.push(+(p + Math.sin(i / 5) * 0.8).toFixed(2));
  }
  for (let i = 1; i <= 10; i++) {
    p += Math.cos(i / 3) * 1.2;
    prices.push(+p.toFixed(2));
    const d = new Date(start.getTime() + i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return {
    status: 'success',
    ticker,
    forecast_days: 10,
    results: {
      actual_prices: actual,
      predicted_historical_prices: predicted,
      forecast_prices: prices,
      forecast_dates: dates,
    },
  };
}

function searchFor(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return KNOWN.filter((k) => k.symbol.toLowerCase().includes(q) || k.name.toLowerCase().includes(q))
    .slice(0, 10)
    .map((k) => ({
      ticker: k.symbol,
      name: k.name,
      asset_class: 'equity',
      asset_class_label: 'Stock',
      has_volume: true,
      currency: 'USD',
      logo_url: null,
    }));
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    log(`${req.method} ${req.url}`);

    if (req.method === 'GET' && url.pathname === '/api/multi-asset/search') {
      res.end(JSON.stringify(searchFor(url.searchParams.get('q'))));
      return;
    }

    let ticker = 'AAPL';
    try {
      ticker = (JSON.parse(body || '{}').ticker || 'AAPL').toUpperCase();
    } catch {}

    if (req.url === '/api/market/overview' || req.url === '/api/forecast/onnx') {
      if (!KNOWN_SET.has(ticker)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: `unknown symbol ${ticker}` }));
        return;
      }
      res.end(JSON.stringify(req.url === '/api/market/overview' ? overviewFor(ticker) : forecastFor(ticker)));
    } else if (req.method === 'GET') {
      res.end(JSON.stringify({ status: 'mock', known_symbols: KNOWN.length }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ detail: 'not found' }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock SEO API listening on http://127.0.0.1:${PORT} (${KNOWN.length} known symbols)`);
});
