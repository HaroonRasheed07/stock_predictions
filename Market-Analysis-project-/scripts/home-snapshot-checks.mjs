import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', output)(loaded, loaded.exports, () => {
    throw new Error('unexpected import in pure snapshot module');
  });
  return loaded.exports;
}

const snapshot = loadTypeScript('src/lib/home-snapshot.ts');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function stock(ticker, overrides = {}) {
  return {
    ticker,
    name: `${ticker} Inc.`,
    price: 100,
    change: 1,
    changePercent: 1.5,
    signal: 'Bullish',
    risk: 'Moderate',
    technical: 'Bullish',
    sentiment: 'Neutral',
    sentiment_status: 'sufficient',
    score: 60,
    ...overrides,
  };
}

function opportunity(ticker, score, rsi) {
  return {
    ticker,
    name: `${ticker} Inc.`,
    asset_class: 'equity',
    score,
    price: 100,
    change: 1,
    change_percent: 1.5,
    factors: [{ name: 'Momentum (RSI)', impact: 0, value: 'Neutral', detail: `RSI: ${rsi}` }],
  };
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check('successful payload produces complete coherent snapshot', () => {
  const result = snapshot.buildMarketSnapshot({
    stocks: {
      AAA: stock('AAA'),
      BBB: stock('BBB', { technical: 'Bearish', changePercent: -2.2, risk: 'High' }),
    },
    opportunities: [opportunity('AAA', 80, 25), opportunity('BBB', 55, 72)],
    source_updated_at: 1795510000,
    _cache_meta: { status: 'HIT', updated_at: 1795510999, is_stale: false },
    degraded: false,
    errors: [],
  });
  assert.equal(result.hasSnapshot, true);
  assert.equal(result.available, true);
  assert.equal(result.stocks.length, 2);
  assert.equal(result.breadth.total, 2);
  assert.equal(result.breadth.bullish, 1);
  assert.equal(result.breadth.bearish, 1);
  assert.equal(result.highRiskCount, 1);
  assert.equal(result.scan.movers.length, 2);
  assert.equal(result.scan.oversold[0].ticker, 'AAA');
  assert.equal(result.scan.overbought[0].ticker, 'BBB');
  assert.equal(result.updatedAt, 1795510000);
  assert.equal(result.isStale, false);
  assert.equal(result.refreshFailed, false);
});

check('background refresh merges and keeps newest timestamp', () => {
  const initial = snapshot.buildMarketSnapshot({
    stocks: { AAA: stock('AAA') },
    opportunities: [opportunity('AAA', 60, 45)],
    source_updated_at: 1000,
  });
  const incoming = snapshot.validateMarketSnapshot({
    stocks: [stock('BBB')],
    opportunities: [opportunity('BBB', 70, 30)],
    updatedAt: 2000,
    isStale: false,
    degraded: false,
    refreshFailed: false,
    errors: [],
  });
  const merged = snapshot.mergeSnapshots(initial, incoming, false);
  assert.deepEqual(merged.stocks.map((row) => row.ticker), ['AAA', 'BBB']);
  assert.equal(merged.updatedAt, 2000);
  assert.equal(merged.breadth.total, 2);
  assert.equal(merged.refreshFailed, false);
});

check('failed refresh retains last snapshot and marks refresh failed', () => {
  const initial = snapshot.buildMarketSnapshot({
    stocks: { AAA: stock('AAA') },
    opportunities: [opportunity('AAA', 60, 45)],
    source_updated_at: 1000,
  });
  const afterFailure = snapshot.mergeSnapshots(initial, null, true);
  assert.equal(afterFailure.hasSnapshot, true);
  assert.equal(afterFailure.stocks.length, 1);
  assert.equal(afterFailure.refreshFailed, true);
  assert.equal(afterFailure.isStale, true);
});

check('empty valid response never clears last snapshot', () => {
  const initial = snapshot.buildMarketSnapshot({
    stocks: { AAA: stock('AAA') },
    opportunities: [opportunity('AAA', 60, 45)],
    source_updated_at: 1000,
  });
  const empty = snapshot.validateMarketSnapshot({
    stocks: [],
    opportunities: [],
    updatedAt: 2000,
    isStale: false,
    degraded: false,
    refreshFailed: false,
    errors: [],
  });
  const merged = snapshot.mergeSnapshots(initial, empty, false);
  assert.equal(empty.hasSnapshot, false);
  assert.equal(merged.hasSnapshot, true);
  assert.equal(merged.stocks.length, 1);
});

check('invalid or incomplete rows are rejected or filtered', () => {
  assert.equal(snapshot.validateMarketSnapshotResponse({ stocks: 'nope', opportunities: [] }), null);
  assert.equal(snapshot.validateMarketSnapshotResponse(null), null);
  const built = snapshot.buildMarketSnapshot({
    stocks: {
      GOOD: stock('GOOD'),
      BAD: { ticker: 'BAD', price: Number.NaN, changePercent: 1 },
    },
    opportunities: [opportunity('GOOD', 50, 44), { ticker: 'BAD' }],
  });
  assert.deepEqual(built.stocks.map((row) => row.ticker), ['GOOD']);
  assert.equal(built.opportunities.length, 2);
  assert.equal(built.opportunities.every((row) => typeof row.ticker === 'string'), true);
});

check('cold failure has no usable snapshot and no false success', () => {
  const result = snapshot.buildMarketSnapshot({ stocks: {}, opportunities: [], degraded: true });
  assert.equal(result.hasSnapshot, false);
  assert.equal(result.available, false);
  assert.equal(result.refreshFailed, false);
  assert.equal(result.isStale, true);
});

check('snapshot age uses one timestamp source', () => {
  assert.equal(snapshot.snapshotAgeMinutes(1_000_000_000, 1_000_000_000_000 + 90_000), 1);
  assert.equal(snapshot.snapshotAgeMinutes(null, 1_000_000_000_000), null);
});

check('client refresh has timeout, overlap guard and stale-response guard', () => {
  const provider = read('src/components/home/MarketSnapshotProvider.tsx');
  assert.match(provider, /REFRESH_TIMEOUT_MS/);
  assert.match(provider, /AbortController/);
  assert.match(provider, /inFlightRef\.current/);
  assert.match(provider, /requestSeqRef\.current/);
  assert.match(provider, /seq === requestSeqRef\.current/);
  assert.match(provider, /mergeSnapshots\(current, parsed, false\)/);
  assert.match(provider, /mergeSnapshots\(current, null, true\)/);
  assert.match(provider, /validateMarketSnapshot/);
});

check('all three sections consume one provider and only wait when no snapshot exists', () => {
  const page = read('src/app/page.tsx');
  const marketRead = read('src/components/home/MarketRead.tsx');
  const scanTabs = read('src/components/home/ScanTabs.tsx');
  const heatmap = read('src/components/home/Heatmap.tsx');
  assert.match(page, /MarketSnapshotProvider initial=\{home\.marketSnapshot\}/);
  assert.match(page, /<ScanTabs \/>/);
  assert.match(page, /<Heatmap \/>/);
  for (const source of [marketRead, scanTabs, heatmap]) {
    assert.match(source, /useMarketSnapshot/);
    assert.match(source, /hasSnapshot/);
  }
  assert.doesNotMatch(marketRead, /Syncing snapshot/);
  assert.doesNotMatch(marketRead, /Updating snapshot/);
  assert.doesNotMatch(scanTabs, /syncing for this snapshot/);
  assert.doesNotMatch(heatmap, /The heatmap updates with each scan/);
});

check('backend composite endpoint and last-good cache exist', () => {
  const api = read('../stock_market/api.py');
  assert.match(api, /@app\.post\("\/api\/home\/market-snapshot"\)/);
  assert.match(api, /schedule_on_miss=False/);
  assert.match(api, /previous = _previous_snapshot\(\)/);
});

console.log(`${passed} homepage snapshot checks passed`);
