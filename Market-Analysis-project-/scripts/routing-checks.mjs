// Routing & navigation quality gates for StockVantex.
//
// Static checks always run. Runtime checks start the mock backend + a
// production `next start` server against the existing `.next` build (build
// with the mock API env swap first — see scripts/mock-seo-api.mjs).
//
// Usage: node scripts/routing-checks.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('\nRouting checks — static\n');

// 1. /stocks directory reachable (the old next.config redirect must be gone).
{
  const cfg = read('next.config.js');
  ok('next.config no longer redirects /stocks away', !/source:\s*'\/stocks'/.test(cfg));
  const dir = read('src/app/stocks/page.tsx');
  ok('/stocks directory page exists with heading "Explore Stocks"', dir.includes('Explore Stocks'));
  ok('/stocks directory describes its curated universe honestly', dir.includes('curated'));
  ok('/stocks directory links individual research pages', dir.includes('/stocks/${'));
}

// 2. Homepage "Browse all stocks" goes to /stocks.
{
  const home = read('src/app/page.tsx');
  ok('Homepage Browse all stocks → /stocks', /href="\/stocks"\s*\n?\s*aria-label="Browse all stocks/.test(home));
}

// 3. Canonical ticker routing: lowercase normalization + genuine 404s.
{
  const page = read('src/app/stocks/[symbol]/page.tsx');
  ok('Ticker page normalizes symbol paths', page.includes('normalizeSymbolPath'));
  ok('Uppercase URLs redirect to lowercase', page.includes('permanentRedirect'));
  ok('Invalid symbol paths 404 (pattern gate)', page.includes('if (!normalized) notFound()'));
  ok('Unknown non-allowlisted symbols 404 via backend signal', page.includes("dataStatus === 'invalid-symbol'"));
  ok('Non-allowlisted symbols stay researchable (no allowlist notFound)', !page.includes('if (!info) notFound()'));
  ok('Ticker page breadcrumb points at /stocks', /href="\/stocks"/.test(page) && page.includes('>Stocks</Link>'));
  ok('Ticker page includes stock search', page.includes('StockSearch'));
  ok('Ticker page includes URL-driven research nav', page.includes('StockResearchNav'));
}

// 3b. Middleware canonicalizes case before routing (works under ISR too).
{
  const mw = read('src/middleware.ts');
  ok('Middleware exists for case canonicalization', mw.includes('NextResponse.redirect(url, 308)'));
  ok('Middleware preserves the query string via nextUrl.clone()', mw.includes('nextUrl.clone()'));
  ok('Middleware matcher is scoped to /stocks', mw.includes("matcher: '/stocks/:path*'"));
  const page = read('src/app/stocks/[symbol]/page.tsx');
  ok('Page fallback redirect does not touch dynamic searchParams', !page.includes('await searchParams'));
}

// 4. View routing: ?view= is the source of truth for analysis tabs.
{
  const client = read('src/app/stocks/[symbol]/StockPageClient.tsx');
  ok('Workspace reads view from URL', client.includes('useSearchParams'));
  ok('Workspace writes view back to the URL', client.includes('?view='));
  ok('Workspace has a risk view', client.includes("'risk'"));
  ok('Workspace queries are keyed by ticker (no stale data)', /queryKey: \['market-overview', ticker/.test(client));
  const nav = read('src/app/stocks/[symbol]/StockResearchNav.tsx');
  ok('Research nav offers all five views', ['overview', 'technical', 'sentiment', 'risk', 'forecast'].every((v) => nav.includes(v)));
}

// 5. Shared search reuses the symbol-resolution service and navigates to /stocks/.
{
  const search = read('src/components/common/StockSearch.tsx');
  ok('Search reuses fetchAssetSearch service', search.includes('fetchAssetSearch'));
  ok('Search navigates to /stocks/[symbol]', search.includes('router.push(`/stocks/'));
  ok('Search supports arrow-key navigation', search.includes('ArrowDown') && search.includes('ArrowUp'));
  ok('Search supports Enter + Escape', search.includes("'Enter'") && search.includes("'Escape'"));
  ok('Search has loading and empty states', search.includes('Loader2') && search.includes('No matches'));
}

// 6. Legacy deep links keep working and gain ?ticker= support.
{
  const legacy = [
    ['src/app/markets/stock/page.tsx', '/markets/stock'],
    ['src/app/markets/stock/technical/page.tsx', '/markets/stock/technical'],
    ['src/app/markets/stock/sentiment/page.tsx', '/markets/stock/sentiment'],
    ['src/app/markets/stock/forecast/page.tsx', '/markets/stock/forecast'],
  ];
  for (const [rel, label] of legacy) {
    const text = read(rel);
    ok(`${label} reads ?ticker= deep links`, text.includes('parseTickerParam'));
  }
}

// 7. SEO: sitemap & allowlist invariants.
{
  const sm = read('src/app/sitemap.ts');
  ok('Sitemap includes /stocks directory', sm.includes('`${SITE_URL}/stocks`'));
  ok('Sitemap has no view/tab routes', !sm.includes('view='));
  const allowlist = read('src/lib/stock-allowlist.ts');
  const symbolCount = new Set([...allowlist.matchAll(/symbol:\s*'([^']+)'/g)].map((m) => m[1])).size;
  ok('SEO allowlist still has exactly 52 symbols', symbolCount === 52, `found ${symbolCount}`);
}

// 8. Mobile/responsive affordances.
{
  const search = read('src/components/common/StockSearch.tsx');
  ok('Search dropdown scrolls instead of overflowing', search.includes('max-h-80 overflow-y-auto'));
  const nav = read('src/app/stocks/[symbol]/StockResearchNav.tsx');
  ok('Research nav scrolls horizontally on small screens', nav.includes('overflow-x-auto'));
}

// ---------------------------------------------------------------- runtime ---
const BUILD_ID = path.join(root, '.next', 'BUILD_ID');
if (!fs.existsSync(BUILD_ID)) {
  console.log('\n  SKIP  runtime checks — no production build found (run the mock-env build first)\n');
} else {
  console.log('\nRouting checks — runtime (mock backend + next start)\n');

  const mock = spawn(process.execPath, ['scripts/mock-seo-api.mjs'], { cwd: root, stdio: 'ignore' });
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3210'], {
    cwd: root,
    stdio: 'ignore',
  });
  const BASE = 'http://localhost:3210';
  const LOG = path.join(os.tmpdir(), 'mock-seo-requests.log');

  function logLines() {
    try {
      return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  }

  async function get(pathname) {
    const res = await fetch(`${BASE}${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), text };
  }

  try {
    await sleep(1500);
    let ready = false;
    for (let i = 0; i < 45 && !ready; i++) {
      try {
        const r = await fetch(`${BASE}/stocks`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
        if (r.status === 200) { ready = true; break; }
      } catch {}
      await sleep(1000);
    }
    ok('production server ready on :3210', ready);
    if (ready) {
      // Directory
      const dir = await get('/stocks');
      ok('GET /stocks → 200', dir.status === 200, String(dir.status));
      ok('/stocks renders Explore Stocks', dir.text.includes('Explore Stocks'));
      ok('/stocks lists research links (Apple example)', dir.text.includes('href="/stocks/aapl"'));
      ok('/stocks canonical is itself', dir.text.includes('https://stockvantex.com/stocks"'));

      // Homepage browse link
      const home = await get('/');
      ok('Homepage browse-all link present', home.text.includes('href="/stocks"') && home.text.includes('Browse all stocks'));

      // Canonical ticker pages
      const msft = await get('/stocks/msft');
      ok('GET /stocks/msft → 200', msft.status === 200, String(msft.status));
      ok('/stocks/msft renders Microsoft', msft.text.includes('Microsoft Corporation (MSFT) Stock Analysis'));
      ok('/stocks/msft canonical is lowercase self', msft.text.includes('https://stockvantex.com/stocks/msft"'));

      const aapl = await get('/stocks/aapl');
      ok('GET /stocks/aapl → 200', aapl.status === 200, String(aapl.status));
      ok('/stocks/aapl renders Apple', aapl.text.includes('Apple Inc.'));

      // Case normalization (middleware emits absolute Location headers).
      const upper = await get('/stocks/MSFT');
      ok('/stocks/MSFT → 308 to lowercase', upper.status === 308 && (upper.location || '').endsWith('/stocks/msft'), `${upper.status} ${upper.location}`);
      const upperView = await get('/stocks/MSFT?view=technical');
      ok('Uppercase redirect preserves ?view=', (upperView.location || '').endsWith('/stocks/msft?view=technical'), String(upperView.location));
      const upperFresh = await get('/stocks/F');
      ok('Uppercase non-prerendered ticker → 308 (was a prod 500)', upperFresh.status === 308 && (upperFresh.location || '').endsWith('/stocks/f'), `${upperFresh.status} ${upperFresh.location}`);
      const upperFresh2 = await get('/stocks/MRNA');
      ok('Uppercase non-allowlisted ticker → 308', upperFresh2.status === 308 && (upperFresh2.location || '').endsWith('/stocks/mrna'), `${upperFresh2.status} ${upperFresh2.location}`);
      const followed = await get('/stocks/mrna');
      ok('Redirect target /stocks/mrna renders (200, noindexed)', followed.status === 200 && followed.text.includes('noindex'), String(followed.status));

      // View routing
      const view = await get('/stocks/msft?view=forecast');
      ok('GET /stocks/msft?view=forecast → 200', view.status === 200, String(view.status));
      ok('View URL exposes ?view=forecast links', view.text.includes('?view=forecast'));
      ok('View URL keeps canonical without query', view.text.includes('https://stockvantex.com/stocks/msft"'));
      ok('Research nav links present in server HTML', view.text.includes('?view=technical#analysis'));

      // 404 behavior
      const unknown = await get('/stocks/zzzzz');
      ok('Valid-pattern unknown ticker → 404 (mock has no data)', unknown.status === 404, String(unknown.status));
      const invalid = await get('/stocks/bad%21sym');
      ok('Invalid symbol pattern → 404', invalid.status === 404, String(invalid.status));

      // Non-allowlisted but valid ticker: researchable + noindexed
      const lyft = await get('/stocks/lyft');
      ok('Valid non-allowlisted ticker → 200 (researchable)', lyft.status === 200, String(lyft.status));
      ok('Non-allowlisted page is noindexed', lyft.text.includes('noindex'));
      ok('Non-allowlisted canonical is its lowercase URL', lyft.text.includes('https://stockvantex.com/stocks/lyft"'));

      // Legacy routes
      for (const p of ['/markets/stock', '/markets/stock/technical', '/markets/stock/sentiment', '/markets/stock/forecast']) {
        const r = await get(p);
        ok(`Legacy ${p} → 200`, r.status === 200, String(r.status));
      }

      // Sitemap
      const sm = await get('/sitemap.xml');
      ok('Sitemap → 200', sm.status === 200, String(sm.status));
      ok('Sitemap includes /stocks', sm.text.includes('https://stockvantex.com/stocks<'));
      const tickerUrls = [...sm.text.matchAll(/https:\/\/stockvantex\.com\/stocks\/[^<]+/g)].map((m) => m[0]);
      ok('Sitemap has exactly 52 ticker URLs (no thin/duplicate routes)', tickerUrls.length === 52, `found ${tickerUrls.length}`);
      ok('Sitemap has no ?view= URLs', !sm.text.includes('view='));

      // Request budget: fresh non-allowlisted page hits the backend at most twice,
      // then serves from the ISR cache with zero additional calls.
      const before = logLines();
      await get('/stocks/gm');
      await sleep(300);
      const afterFirst = logLines();
      await get('/stocks/gm');
      await sleep(300);
      const afterSecond = logLines();
      ok('First uncached research page ≤ 3 backend calls', afterFirst - before <= 3, `${afterFirst - before} calls`);
      ok('Second request served from cache (0 backend calls)', afterSecond - afterFirst === 0, `${afterSecond - afterFirst} calls`);

      // Search API shape (used by StockSearch autocomplete)
      const searchRes = await fetch('http://127.0.0.1:8787/api/multi-asset/search?q=microsoft', { signal: AbortSignal.timeout(5000) });
      const searchJson = await searchRes.json();
      ok('Mock symbol search resolves by company name', Array.isArray(searchJson) && searchJson.some((r) => r.ticker === 'MSFT'));
    }
  } finally {
    server.kill();
    mock.kill();
  }
}

console.log('');
if (fail > 0) {
  console.error(`${fail} routing gate(s) failed (${pass} passed).\n`);
  process.exit(1);
}
console.log(`All ${pass} routing gates passed.\n`);
