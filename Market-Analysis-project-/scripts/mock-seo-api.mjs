// Local mock of the StockVantex backend for SEO/routing build validation.
// Serves POST /api/market/overview and /api/forecast/onnx with deterministic
// canned data so `next build` never hits the live backend or news providers,
// plus GET /api/multi-asset/search for autocomplete tests.
// The homepage build additionally needs GET /api/market/indices,
// GET /api/market/status, GET /api/home/brief, POST /api/discover/scan,
// POST /api/opportunities/scan, POST /api/data/indicators and
// POST /api/data/sentiment — all served here with deterministic canned data
// (LOCAL BUILD TOOL ONLY; production points at the real backend).
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
  let ema = close;
  const base = new Date('2026-07-01T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    close += Math.sin(i / 3) * 2 + 0.5;
    ema = ema * 0.9 + close * 0.1;
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
      EMA20: +ema.toFixed(2),
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

// ── Homepage section endpoints (deterministic canned data, local only) ──────

function hashOf(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function nameOf(sym) {
  return KNOWN.find((k) => k.symbol === sym)?.name || sym;
}
function round2(v) {
  return Math.round(v * 100) / 100;
}

function indicesFor() {
  const defs = [
    { symbol: '^GSPC', label: 'S&P 500', base: 6842.3 },
    { symbol: '^IXIC', label: 'Nasdaq', base: 23117.8 },
    { symbol: '^DJI', label: 'Dow Jones', base: 47324.5 },
    { symbol: '^VIX', label: 'VIX', base: 15.4 },
  ];
  const indexes = defs.map((d, idx) => {
    const h = hashOf(d.symbol);
    const drift = (((h % 500) - 250) / 10000) * d.base;
    const value = round2(d.base + drift);
    const changePercent = round2((((h >> 3) % 240) - 120) / 100);
    const points = [];
    let p = value * (1 - changePercent / 100) * 0.994;
    for (let i = 0; i < 10; i++) {
      p += Math.sin((i + idx) / 2.2) * (d.base * 0.0025) + (d.base * 0.0006);
      points.push(round2(p));
    }
    points[points.length - 1] = value;
    return { symbol: d.symbol, label: d.label, value, changePercent, points };
  });
  return { indexes, _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' } };
}

function discoverRowFor(sym) {
  const h = hashOf(sym);
  const price = round2(45 + (h % 420) + ((h >> 4) % 100) / 100);
  const changePercent = round2((((h >> 3) % 700) - 350) / 100);
  const change = round2((price * changePercent) / 100);
  return {
    ticker: sym,
    name: nameOf(sym),
    price,
    change,
    changePercent,
    signal: 'Hold',
    risk: ['Low', 'Medium', 'High'][(h >> 5) % 3],
    technical: ['Bullish', 'Neutral', 'Bearish'][h % 3],
    sentiment: ['Positive', 'Neutral', 'Negative'][(h >> 7) % 3],
    sentiment_status: 'sufficient',
    score: 30 + (h % 60),
  };
}

function discoverScanFor(tickers) {
  const stocks = {};
  const list = (Array.isArray(tickers) ? tickers : []).slice(0, 10);
  for (const raw of list) {
    const sym = String(raw || '').toUpperCase();
    if (!KNOWN_SET.has(sym)) continue;
    stocks[sym] = discoverRowFor(sym);
  }
  return {
    stocks,
    count: Object.keys(stocks).length,
    _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' },
  };
}

function opportunityScanFor(tickers) {
  const list = (Array.isArray(tickers) ? tickers : []).slice(0, 20);
  const scan_results = [];
  for (const raw of list) {
    const sym = String(raw || '').toUpperCase();
    if (!KNOWN_SET.has(sym)) continue;
    const h = hashOf(sym);
    const rsi = 25 + (h % 55);
    const row = discoverRowFor(sym);
    scan_results.push({
      ticker: sym,
      name: row.name,
      asset_class: 'equity',
      score: 35 + (h % 55),
      price: row.price,
      change: row.change,
      change_percent: row.changePercent,
      factors: [
        {
          name: 'Momentum (RSI)',
          impact: rsi < 40 ? 20 : rsi > 60 ? -20 : 0,
          value: rsi < 40 ? 'Oversold (Bullish)' : rsi > 60 ? 'Overbought (Bearish)' : 'Neutral',
          detail: `RSI: ${rsi}`,
        },
        { name: 'Volatility', impact: ((h >> 6) % 20) - 10, value: 'Moderate', detail: 'ATR: 2.4' },
      ],
    });
  }
  return { scan_results, _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' } };
}

function homeBriefFor() {
  const row = discoverRowFor('NVDA');
  return {
    selectedStock: {
      ...row,
      market_mood: 'Cautiously optimistic',
      volatility: 1.9,
    },
    _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' },
  };
}

function marketStatusNow() {
  const now = new Date();
  const etHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now), 10);
  const etMinute = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now), 10);
  const etDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(now);
  const weekend = etDay === 'Sat' || etDay === 'Sun';
  const mins = etHour * 60 + etMinute;
  let status = 'closed';
  let label = 'Market Closed';
  if (!weekend && mins >= 570 && mins < 600) { status = 'pre_market'; label = 'Pre-Market'; }
  else if (!weekend && mins >= 600 && mins <= 960) { status = 'open'; label = 'Market Open'; }
  else if (!weekend && mins > 960 && mins <= 1200) { status = 'after_hours'; label = 'After Hours'; }
  return { market: 'US', status, label, timezone: 'America/New_York', next_open: null, next_close: null, is_early_close: false };
}

function sentimentFor(ticker) {
  const h = hashOf(ticker);
  const positive = 6 + (h % 7);
  const negative = 2 + ((h >> 4) % 5);
  const neutral = 2 + ((h >> 8) % 4);
  const total = positive + negative + neutral;
  const score = round2((positive - negative) / total);
  const label = score > 0.15 ? 'Positive' : score < -0.15 ? 'Negative' : 'Neutral';
  const trend = [];
  let s = score;
  for (let i = 6; i >= 0; i--) {
    s += Math.sin((i + h % 5) / 2) * 0.08;
    trend.push({
      date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      score: Math.max(-1, Math.min(1, round2(s))),
    });
  }
  return {
    ticker,
    company_name: nameOf(ticker),
    sentiment_score: score,
    sentiment_label: label,
    status: 'sufficient',
    score,
    label,
    positive_count: positive,
    negative_count: negative,
    neutral_count: neutral,
    positive_pct: round2((positive / total) * 100),
    neutral_pct: round2((neutral / total) * 100),
    negative_pct: round2((negative / total) * 100),
    news_count: total,
    source_providers: ['mock-news'],
    news: [],
    sentiment_trend_7d: trend,
    drivers: [
      { category: 'Earnings', direction: score >= 0 ? 'positive' : 'negative', article_count: 4, contribution: round2(Math.abs(score) * 0.6) },
      { category: 'Product', direction: score >= 0 ? 'positive' : 'negative', article_count: 3, contribution: round2(Math.abs(score) * 0.3) },
      { category: 'Macro', direction: 'neutral', article_count: 2, contribution: 0.05 },
    ],
    explanation: '[mock] Deterministic local build data.',
    news_impact_summary: '[mock] Coverage leans with the local build snapshot.',
    market_mood: score > 0.15 ? 'Cautiously optimistic' : score < -0.15 ? 'Cautiously pessimistic' : 'Balanced',
  };
}

function indicatorsFor(ticker) {
  const rows = buildRows(ticker);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  return {
    ticker,
    data: rows,
    totalMarketCap: 0,
    tradingVolume: last.Volume,
    activeStocks: 0,
    topStocks: [],
    currentPrice: last.Close,
    change: round2(last.Close - prev.Close),
    changePercent: round2(((last.Close - prev.Close) / prev.Close) * 100),
    _cache_meta: { created_at: UPDATED_AT, updated_at: UPDATED_AT, fresh_until: UPDATED_AT + 120, is_stale: false, status: 'HIT' },
  };
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    log(`${req.method} ${req.url}`);

    // CORS preflight for client-side POSTs (JSON content type).
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/multi-asset/search') {
      res.end(JSON.stringify(searchFor(url.searchParams.get('q'))));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/market/indices') {
      res.end(JSON.stringify(indicesFor()));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/market/status') {
      res.end(JSON.stringify(marketStatusNow()));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/home/brief') {
      res.end(JSON.stringify(homeBriefFor()));
      return;
    }

    let ticker = 'AAPL';
    let tickers = [];
    try {
      const payload = JSON.parse(body || '{}');
      ticker = String(payload.ticker || 'AAPL').toUpperCase();
      tickers = Array.isArray(payload.tickers) ? payload.tickers : [];
    } catch {}

    if (req.method === 'POST' && url.pathname === '/api/discover/scan') {
      res.end(JSON.stringify(discoverScanFor(tickers)));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/opportunities/scan') {
      res.end(JSON.stringify(opportunityScanFor(tickers)));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/data/indicators') {
      if (!KNOWN_SET.has(ticker)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: `unknown symbol ${ticker}` }));
        return;
      }
      res.end(JSON.stringify(indicatorsFor(ticker)));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/data/sentiment') {
      if (!KNOWN_SET.has(ticker)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: `unknown symbol ${ticker}` }));
        return;
      }
      res.end(JSON.stringify(sentimentFor(ticker)));
      return;
    }

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
