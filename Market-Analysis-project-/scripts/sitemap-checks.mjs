// Sitemap & robots reliability gates for StockVantex (Phase 7 of the
// technical-SEO hardening spec). Static checks always run; runtime checks
// build against an existing production `.next` and spawn the local mock
// backend ONLY as an observer — the mock must receive ZERO requests while the
// sitemap is fetched, and must be killed to prove backend independence.
//
// Usage: node scripts/sitemap-checks.mjs   (requires a prior `next build`)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const ORIGIN = 'https://stockvantex.com';
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

/** Minimal well-formedness check: balanced tags, single root, no stray '<'. */
function parseXml(xml) {
  const withoutDecl = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
  const stack = [];
  let rootName = null;
  const re = /<([^>]+)>/g;
  let last = 0;
  let m;
  while ((m = re.exec(withoutDecl)) !== null) {
    const between = withoutDecl.slice(last, m.index);
    if (between.includes('<')) return { error: 'stray < outside a tag' };
    if (between.includes('&') && !/&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos);/.test(between.replace(/&[^;]*;/g, '&;'))) {
      // allow already-escaped entities; flag obvious raw ampersands
      if (/&(?!(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos);)/.test(between)) {
        return { error: 'unescaped & in text' };
      }
    }
    last = re.lastIndex;
    const inner = m[1];
    if (inner.startsWith('!')) continue;
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim();
      const top = stack.pop();
      if (top !== name) return { error: `mismatched close </${name}>, open was <${top}>` };
      continue;
    }
    const selfClosing = inner.endsWith('/');
    const name = (selfClosing ? inner.slice(0, -1) : inner).trim().split(/[\s/]/)[0];
    if (!name) return { error: 'empty tag name' };
    if (!selfClosing) stack.push(name);
    if (!rootName && stack.length === 1) rootName = name;
  }
  if (stack.length > 0) return { error: `unclosed tags: ${stack.join(', ')}` };
  return { root: rootName };
}

function extractUrls(xml) {
  const out = [];
  const re = /<url>([\s\S]*?)<\/url>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(block);
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/.exec(block);
    if (loc) out.push({ loc: loc[1].trim(), lastmod: lastmod ? lastmod[1].trim() : null });
  }
  return out;
}

console.log('\nSitemap checks — static\n');

// (Phase 2/4) Generation is pure and honest.
{
  const sm = read('src/app/sitemap.ts');
  ok('No artificial new Date() generation stamps', !sm.includes('new Date()'));
  ok('Learn lastmod comes from article.updatedAt', sm.includes('new Date(article.updatedAt)'));
  ok('No ignored priority/changefreq fields emitted', !/priority\s*:/.test(sm) && !/changeFrequency\s*:/.test(sm));
  ok('Single canonical origin via SITE_URL', sm.includes('SITE_URL'));
  ok('Output is deduplicated', sm.includes('seen.add'));
  ok('Output is sorted deterministically', sm.includes('.sort('));
  ok('No network/API imports in sitemap generation', !sm.includes("@/lib/api") && !sm.includes('fetch(') && !sm.includes('stock-snapshot'));
  ok('Sitemap uses local registries only', sm.includes('getAllAllowlistedSymbols') && sm.includes('getAllArticles'));
}

// (Phase 2/6) No duplicate handlers, no static-file shadowing.
{
  ok('Exactly one sitemap handler', fs.readdirSync(path.join(root, 'src', 'app')).filter((f) => f.startsWith('sitemap')).length === 1);
  ok('Exactly one robots handler', fs.readdirSync(path.join(root, 'src', 'app')).filter((f) => f.startsWith('robots')).length === 1);
  ok('No public/sitemap.xml shadow', !fs.existsSync(path.join(root, 'public', 'sitemap.xml')));
  ok('No public/robots.txt shadow', !fs.existsSync(path.join(root, 'public', 'robots.txt')));
}

// (Phase 3/6) Listed routes exist and stay canonical/indexable.
{
  const sm = read('src/app/sitemap.ts');
  for (const dir of ['', 'stocks', 'about', 'contact', 'methodology', 'learn', 'privacy', 'terms', 'disclaimer']) {
    const p = dir ? path.join(root, 'src', 'app', dir) : path.join(root, 'src', 'app');
    ok(`Route exists: /${dir}`, fs.existsSync(path.join(p, dir ? 'page.tsx' : 'page.tsx')));
  }
  ok('Noindex routes absent from sitemap source', !sm.includes('/markets/more') && !sm.includes('watchlist') && !sm.includes('/test-chart'));
}

// (Phase 5) Robots policy.
{
  const rb = read('src/app/robots.ts');
  ok('Robots references the canonical sitemap', rb.includes('sitemap: `${SITE_URL}/sitemap.xml`'));
  ok('Robots allows all crawlers on public content', rb.includes("userAgent: '*'") && rb.includes("allow: '/'"));
  ok('Robots does not block /stocks', !rb.includes("'/stocks"));
  ok('Robots does not block /learn', !rb.includes("'/learn"));
  ok('Robots does not block the sitemap path', !rb.includes("'/sitemap") && !rb.includes('"/sitemap'));
}

// (Phase 6) Middleware never touches /sitemap.xml.
{
  const mw = read('src/middleware.ts');
  ok('Middleware matcher scoped to /stocks only', mw.includes("matcher: '/stocks/:path*'"));
}

// (Phase 4) Learn article dates are real, formatted, and not future-dated.
{
  const src = read('src/lib/learn-articles.ts');
  const dates = [...src.matchAll(/updatedAt:\s*'([^']+)'/g)].map((m) => m[1]);
  ok('All articles have updatedAt', dates.length >= 18, `found ${dates.length}`);
  ok('updatedAt values are ISO dates', dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d))));
  ok('No future updatedAt', dates.every((d) => Date.parse(d) <= Date.now()), dates.filter((d) => Date.parse(d) > Date.now()).join(','));
}

// ---------------------------------------------------------------- runtime ---
const BUILD_ID = path.join(root, '.next', 'BUILD_ID');
if (!fs.existsSync(BUILD_ID)) {
  console.log('\n  SKIP  runtime checks — no production build found (run `npm run build` first)\n');
} else {
  console.log('\nSitemap checks — runtime (mock observer, then backend offline)\n');

  const mock = spawn(process.execPath, ['scripts/mock-seo-api.mjs'], { cwd: root, stdio: 'ignore' });
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3214'], {
    cwd: root,
    stdio: 'ignore',
  });
  const BASE = 'http://localhost:3214';
  const LOG = path.join(os.tmpdir(), 'mock-seo-requests.log');

  const logLines = () => {
    try {
      return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  };

  const fetchRes = async (pathname, timeout = 15000) => {
    const res = await fetch(`${BASE}${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    const text = await res.text();
    return { status: res.status, type: res.headers.get('content-type') || '', location: res.headers.get('location'), text };
  };

  try {
    await sleep(1500);
    let ready = false;
    for (let i = 0; i < 45 && !ready; i++) {
      try {
        const r = await fetch(`${BASE}/robots.txt`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
        if (r.status === 200) { ready = true; break; }
      } catch {}
      await sleep(1000);
    }
    ok('production server ready on :3214', ready);
    if (ready) {
      // Pre-conditions on the mock observer.
      const baseline = logLines();

      // 1–3, 16: status, content type, no middleware interception.
      const r1 = await fetchRes('/sitemap.xml');
      ok('(1) Sitemap HTTP 200', r1.status === 200, String(r1.status));
      ok('(3) Content type is XML', /application\/xml|text\/xml/.test(r1.type), r1.type);
      ok('(16) Middleware does not intercept (no redirect)', r1.status === 200 && r1.location === null, `${r1.status} loc=${r1.location}`);

      // 2: well-formed XML with the sitemap namespace.
      const parsed = parseXml(r1.text);
      ok('(2) XML is well-formed', !parsed.error, parsed.error || '');
      ok('(2) Root is urlset with sitemap 0.9 namespace', parsed.root === 'urlset' && r1.text.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), String(parsed.root));
      ok('XML declaration is UTF-8', r1.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));

      const entries = extractUrls(r1.text);
      const locs = entries.map((e) => e.loc);

      // 4–6: required URLs.
      ok('(4) Canonical homepage present', locs.includes(ORIGIN));
      ok('(5) /stocks/aapl, /stocks/msft, /stocks/nvda present', ['/stocks/aapl', '/stocks/msft', '/stocks/nvda'].every((p) => locs.includes(`${ORIGIN}${p}`)));
      const learnSlugs = [...read('src/lib/learn-articles.ts').matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
      const missingLearn = learnSlugs.filter((s) => !locs.includes(`${ORIGIN}/learn/${s}`));
      ok('(6) All Learn articles present', learnSlugs.length >= 18 && missingLearn.length === 0, missingLearn.join(','));

      // 7–10: origin, dedupe, no queries, real/valid routes only.
      ok('(7) All URLs use https://stockvantex.com', locs.every((l) => l.startsWith(`${ORIGIN}`)) && locs.every((l) => l === ORIGIN || l.startsWith(`${ORIGIN}/`)), locs.filter((l) => !l.startsWith(ORIGIN)).join(','));
      ok('(8) No duplicate URLs', new Set(locs).size === locs.length, `${locs.length - new Set(locs).size} dupes`);
      ok('(9) No tracking/query parameters', locs.every((l) => !l.includes('?') && !l.includes('#')));
      const allow = new Set([...read('src/lib/stock-allowlist.ts').matchAll(/symbol:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase()));
      const stockLocs = locs.filter((l) => l.startsWith(`${ORIGIN}/stocks/`));
      const badTickers = stockLocs.filter((l) => !allow.has(l.slice(`${ORIGIN}/stocks/`.length)));
      ok('(10) Every /stocks/ URL is a supported allowlisted ticker', badTickers.length === 0, badTickers.join(','));
      ok('(10) Stock URL count matches the registry (52)', stockLocs.length === 52, String(stockLocs.length));
      const forbidden = ['/test-chart', '/analysis', '/api/', '/markets/more', '/watchlist', 'view='];
      const badUrls = locs.filter((l) => forbidden.some((f) => l.includes(f)));
      ok('(11) No noindex/blocked/diagnostic routes listed', badUrls.length === 0, badUrls.join(','));
      const core = ['', '/stocks', '/about', '/contact', '/methodology', '/learn', '/privacy', '/terms', '/disclaimer'];
      const unexplained = locs.filter((l) => {
        const p = l === ORIGIN ? '' : l.slice(ORIGIN.length);
        if (core.includes(p)) return false;
        if (p.startsWith('/stocks/') && allow.has(p.slice('/stocks/'.length))) return false;
        if (p.startsWith('/learn/') && learnSlugs.includes(p.slice('/learn/'.length))) return false;
        return true;
      });
      ok('Every URL maps to a real, known route', unexplained.length === 0, unexplained.join(','));

      // 12: meaningful modification dates.
      const now = Date.now();
      const lastmods = entries.filter((e) => e.lastmod);
      ok('(12) All lastmod values are valid ISO dates', lastmods.every((e) => !isNaN(Date.parse(e.lastmod))), lastmods.filter((e) => isNaN(Date.parse(e.lastmod))).map((e) => e.lastmod).join(','));
      ok('(12) No future lastmod values', lastmods.every((e) => Date.parse(e.lastmod) <= now));
      const stockWithLastmod = entries.filter((e) => e.lastmod && e.loc.startsWith(`${ORIGIN}/stocks/`));
      ok('(12) Stock pages carry no artificial lastmod', stockWithLastmod.length === 0, stockWithLastmod.slice(0, 3).map((e) => `${e.loc}=${e.lastmod}`).join(','));
      const updatedAtBySlug = new Map(
        [...read('src/lib/learn-articles.ts').matchAll(/slug:\s*'([^']+)'[\s\S]*?updatedAt:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
      );
      const learnEntries = entries.filter((e) => e.loc.startsWith(`${ORIGIN}/learn/`));
      const learnBad = learnEntries.filter((e) => {
        const slug = e.loc.slice(`${ORIGIN}/learn/`.length);
        const expected = updatedAtBySlug.get(slug);
        return !expected || !e.lastmod || !e.lastmod.startsWith(expected);
      });
      ok('(12) Learn lastmod equals each article real updatedAt', learnEntries.length >= 18 && learnBad.length === 0, learnBad.slice(0, 3).map((e) => `${e.loc}=${e.lastmod}`).join(','));

      // Deterministic output between consecutive requests (Phase 6).
      const r2 = await fetchRes('/sitemap.xml');
      ok('Consecutive responses are byte-identical', r2.text === r1.text);

      // 14: zero market-data/forecast calls during sitemap generation.
      const after = logLines();
      ok('(14) Zero backend API calls during sitemap fetches', after - baseline === 0, `${after - baseline} calls`);

      // Phase 6: listed pages are indexable (sample core + stock + learn).
      for (const p of ['/', '/stocks/aapl', '/learn/what-is-rsi']) {
        const r = await fetchRes(p);
        const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(r.text);
        ok(`Sampled page indexable: ${p}`, r.status === 200 && !noindex, `status=${r.status} noindex=${noindex}`);
      }

      // 15: robots.txt at runtime.
      const rb = await fetchRes('/robots.txt');
      ok('(15) Robots HTTP 200, text/plain', rb.status === 200 && /text\/plain/.test(rb.type), `${rb.status} ${rb.type}`);
      ok('(15) Robots references canonical sitemap', rb.text.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
      ok('(15) Robots allows /stocks, /learn, sitemap', !/Disallow:\s*\/(stocks|learn|sitemap)/i.test(rb.text));

      // 13: kill the backend — sitemap must remain available.
      mock.kill();
      await sleep(400);
      const offline = await fetchRes('/sitemap.xml');
      ok('(13) Sitemap still 200 with backend offline', offline.status === 200 && /application\/xml|text\/xml/.test(offline.type), `${offline.status} ${offline.type}`);
      const offlineRobots = await fetchRes('/robots.txt');
      ok('(13) Robots still 200 with backend offline', offlineRobots.status === 200, String(offlineRobots.status));
    }
  } finally {
    server.kill();
    mock.kill();
  }
}

console.log('');
if (fail > 0) {
  console.error(`${fail} sitemap gate(s) failed (${pass} passed).\n`);
  process.exit(1);
}
console.log(`All ${pass} sitemap gates passed.\n`);
