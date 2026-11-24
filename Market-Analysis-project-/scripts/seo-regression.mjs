import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
let pass = 0;
let fail = 0;

function ok(name, condition, detail = '') {
  if (condition) {
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

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function decode(value) {
  return String(value || '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function match(html, re) {
  const found = re.exec(html);
  return found ? decode(found[1]) : '';
}

function routeOf(file) {
  const base = path.join(root, '.next', 'server', 'app');
  const rel = path.relative(base, file).replace(/\\/g, '/').replace(/\.html$/, '');
  return rel === 'index' ? '/' : `/${rel}`;
}

function parseHtml(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const types = [];
  let invalidJsonLd = 0;
  for (const block of blocks) {
    try {
      const data = JSON.parse(decode(block[1]));
      const value = data['@type'];
      types.push(...(Array.isArray(value) ? value : [value]));
    } catch {
      invalidJsonLd += 1;
    }
  }
  const links = [...new Set([...html.matchAll(/<a[^>]+href="([^"]*)"/gi)]
    .map((item) => decode(item[1]))
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => href.split('#')[0].split('?')[0]))];
  return {
    route: routeOf(file),
    title: match(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: match(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i) || match(html, /<meta[^>]+content="([^"]*)"[^>]+name="description"/i),
    canonical: match(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) || match(html, /<link[^>]+href="([^"]*)"[^>]+rel="canonical"/i),
    robots: match(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i) || match(html, /<meta[^>]+content="([^"]*)"[^>]+name="robots"/i),
    h1: (html.match(/<h1\b/gi) || []).length,
    jsonLdBlocks: blocks.length,
    jsonLdTypes: [...new Set(types)].sort(),
    invalidJsonLd,
    links,
  };
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

console.log('\nSEO regression checks — static\n');

const nextConfig = read('next.config.js');
const robotsSource = read('src/app/robots.ts');
const sitemapSource = read('src/app/sitemap.ts');
const footerSource = read('src/components/layout/Footer.tsx');
const layoutSource = read('src/app/layout.tsx');
const consentSource = read('src/components/common/AnalyticsConsent.tsx');
const privacySource = read('src/app/privacy/page.tsx');
const watchlistLayout = read('src/app/markets/stock/watchlist/layout.tsx');
const analysisLayout = read('src/app/analysis/layout.tsx');
const structuredDataSource = read('src/components/seo/StructuredData.tsx');
const allowlistSource = read('src/lib/stock-allowlist.ts');
const articleSource = read('src/lib/learn-articles.ts');

ok('/analysis is a real route, not a permanent redirect', !/source:\s*'\/analysis'/.test(nextConfig));
ok('/test-chart remains a permanent redirect', /source:\s*'\/test-chart'[\s\S]*?destination:\s*'\/'[\s\S]*?permanent:\s*true/.test(nextConfig));
ok('robots no longer disallows the /test-chart redirect', !robotsSource.includes("'/test-chart'"));
ok('robots still disallows private API routes', robotsSource.includes("'/api/'"));
ok('sitemap includes /analysis', sitemapSource.includes('`${SITE_URL}/analysis`'));
ok('footer links to /analysis', footerSource.includes('href="/analysis"'));
ok('watchlist canonical is self-referencing', watchlistLayout.includes('${SITE_URL}/markets/stock/watchlist'));
ok('AdSense loader is not static in root layout', !layoutSource.includes('pagead2.googlesyndication.com') && !layoutSource.includes('adsbygoogle'));
ok('AdSense loader is mounted in consent gate', consentSource.includes('ADSENSE_SCRIPT_SRC') && consentSource.includes('sv-adsense-verification'));
ok('AdSense loader is consent-gated with GA', consentSource.includes("{gaActive && <GoogleAnalytics") && /gaActive && \(\s*<Script/.test(consentSource));
ok('privacy discloses AdSense verification', privacySource.includes('AdSense') && privacySource.includes('verification script'));
ok('privacy no longer claims there is no advertising at all', !privacySource.includes('we have no advertising'));
ok('shared WebPage JSON-LD component exists', structuredDataSource.includes('export function WebPageJsonLd'));
ok('analysis route emits WebPage JSON-LD', analysisLayout.includes('<WebPageJsonLd'));

const allowedSymbols = new Set([...allowlistSource.matchAll(/symbol:\s*'([A-Za-z0-9.\-_]+)'/g)].map((m) => m[1].toUpperCase()));
const nonAllowlistedTickers = [];
for (const arrayMatch of articleSource.matchAll(/relatedTickers:\s*\[([^\]]*)\]/g)) {
  for (const tickerMatch of arrayMatch[1].matchAll(/'([A-Za-z0-9.\-_]+)'/g)) {
    if (!allowedSymbols.has(tickerMatch[1].toUpperCase())) nonAllowlistedTickers.push(tickerMatch[1]);
  }
}
ok('Learn relatedTickers link only to allowlisted stock pages', nonAllowlistedTickers.length === 0, nonAllowlistedTickers.join(','));

const htmlDir = path.join(root, '.next', 'server', 'app');
const htmlFiles = fs.existsSync(htmlDir)
  ? walk(htmlDir).filter((file) => file.endsWith('.html')).sort()
  : [];
const rows = htmlFiles.map(parseHtml).sort((a, b) => a.route.localeCompare(b.route));
ok('prerendered HTML is available for inspection', rows.length > 0, `${rows.length} files`);

const sitemapXml = fs.existsSync(path.join(htmlDir, 'sitemap.xml.body'))
  ? fs.readFileSync(path.join(htmlDir, 'sitemap.xml.body'), 'utf8')
  : '';
const sitemapPaths = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  try {
    return new URL(decode(m[1])).pathname;
  } catch {
    return decode(m[1]);
  }
}));

const inbound = new Map();
const noindexRoutes = new Set(rows.filter((row) => /noindex/i.test(row.robots)).map((row) => row.route));
const knownRoutes = new Set([
  ...rows.map((row) => row.route),
  '/api/region',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
]);
const brokenLinks = [];
const linksToNoindexStock = [];
for (const row of rows) {
  for (const link of row.links) {
    inbound.set(link, (inbound.get(link) || 0) + 1);
    if (!knownRoutes.has(link) && !link.startsWith('/api/')) brokenLinks.push({ from: row.route, to: link });
    if (link !== row.route && /^\/stocks\/[a-z0-9.\-_]+$/.test(link) && noindexRoutes.has(link)) {
      linksToNoindexStock.push({ from: row.route, to: link });
    }
  }
}

const invalidJsonLdRoutes = rows.filter((row) => row.invalidJsonLd > 0).map((row) => row.route);
ok('all emitted JSON-LD blocks parse', invalidJsonLdRoutes.length === 0, invalidJsonLdRoutes.join(','));

const canonicalOwners = new Map();
for (const row of rows) {
  if (!row.canonical) continue;
  canonicalOwners.set(row.canonical, [...(canonicalOwners.get(row.canonical) || []), row.route]);
}
const duplicateCanonicals = [...canonicalOwners.entries()].filter(([, owners]) => owners.length > 1);
ok('no canonical URL is shared by multiple rendered routes', duplicateCanonicals.length === 0, JSON.stringify(duplicateCanonicals));

const publicRoutes = rows.filter((row) => !noindexRoutes.has(row.route) && !['/_not-found', '/test-chart', '/stocks/bad!sym', '/stocks/zzzzz'].includes(row.route));
const badMetadata = publicRoutes.filter((row) => !row.title || !row.description || !row.canonical || row.h1 !== 1);
ok('indexable rendered routes have title, description, canonical and one H1', badMetadata.length === 0, badMetadata.map((row) => row.route).join(','));

const badCanonical = publicRoutes.filter((row) => row.canonical !== (row.route === '/' ? 'https://stockvantex.com' : `https://stockvantex.com${row.route}`));
ok('indexable rendered routes use self-referencing canonicals', badCanonical.length === 0, badCanonical.map((row) => `${row.route}:${row.canonical}`).join(','));

ok('no internal links point to missing rendered routes', brokenLinks.length === 0, JSON.stringify(brokenLinks));
ok('no internal links point to noindexed stock pages', linksToNoindexStock.length === 0, JSON.stringify(linksToNoindexStock));
ok('analysis route has at least one internal inbound link', (inbound.get('/analysis') || 0) > 0, `${inbound.get('/analysis') || 0}`);

const zeroInboundSitemapRoutes = [...sitemapPaths].filter((route) => !inbound.get(route) && !noindexRoutes.has(route));
ok('every sitemap-listed indexable route has an internal inbound link', zeroInboundSitemapRoutes.length === 0, zeroInboundSitemapRoutes.join(','));

console.log('\nSEO regression checks — runtime\n');

const runtime = new Map();
const mock = spawn(process.execPath, ['scripts/mock-seo-api.mjs'], {
  cwd: root,
  env: { ...process.env, MOCK_PORT: '8787' },
  stdio: 'ignore',
});
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3216'], {
  cwd: root,
  stdio: 'ignore',
});
const BASE = 'http://localhost:3216';

async function get(pathname) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    location: response.headers.get('location') || '',
    type: response.headers.get('content-type') || '',
    text: await response.text(),
  };
}

try {
  await sleep(1500);
  let ready = false;
  for (let i = 0; i < 45 && !ready; i += 1) {
    try {
      const response = await fetch(`${BASE}/robots.txt`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(1000);
  }
  ok('production server ready on :3216', ready);

  if (ready) {
    const analysis = await get('/analysis');
    runtime.set('/analysis', analysis);
    ok('GET /analysis → 200', analysis.status === 200, String(analysis.status));
    ok('/analysis canonical is self', analysis.text.includes('https://stockvantex.com/analysis"'));
    ok('/analysis emits WebPage JSON-LD', /"@type":"WebPage"/.test(analysis.text));
    ok('/analysis emits one H1', (analysis.text.match(/<h1\b/gi) || []).length === 1);

    const testChart = await get('/test-chart');
    runtime.set('/test-chart', testChart);
    ok('GET /test-chart → permanent redirect to /', testChart.status === 308 && (testChart.location === '/' || testChart.location === 'https://stockvantex.com/'), `${testChart.status} ${testChart.location}`);

    const robots = await get('/robots.txt');
    ok('runtime robots allows crawling /test-chart redirect', robots.status === 200 && !robots.text.includes('Disallow: /test-chart'));

    const sitemap = await get('/sitemap.xml');
    ok('runtime sitemap includes /analysis', sitemap.status === 200 && sitemap.text.includes('https://stockvantex.com/analysis<'));

    const home = await get('/');
    runtime.set('/', home);
    ok('SSR home contains no static AdSense tag', !home.text.includes('pagead2.googlesyndication.com') && !home.text.includes('adsbygoogle'));

    for (const route of ['/stocks/msft', '/learn/what-is-rsi']) {
      const response = await get(route);
      runtime.set(route, response);
      ok(`GET ${route} → 200`, response.status === 200, String(response.status));
      ok(`${route} canonical is self`, response.text.includes(`https://stockvantex.com${route}"`));
      const blocks = [...response.text.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
      ok(`${route} JSON-LD parses`, blocks.length > 0 && blocks.every((block) => {
        try {
          JSON.parse(decode(block[1]));
          return true;
        } catch {
          return false;
        }
      }));
    }
  }
} finally {
  server.kill();
  mock.kill();
}

const statusFor = (route) => {
  const response = runtime.get(route);
  if (response) return response.status === 308 ? `308 → ${response.location}` : String(response.status);
  if (route === '/test-chart') return '308 → /';
  if (['/_not-found', '/stocks/bad!sym', '/stocks/zzzzz'].includes(route)) return '404';
  return '200 (prerendered)';
};

const inventory = [
  'route,observed_status,indexable,in_sitemap,canonical,h1,title,description,robots,jsonld_blocks,jsonld_types,inbound_links,outbound_links,notes',
  ...rows.map((row) => {
    const noindex = /noindex/i.test(row.robots);
    const redirected = row.route === '/test-chart';
    const missing = ['/_not-found', '/stocks/bad!sym', '/stocks/zzzzz'].includes(row.route);
    const indexable = !noindex && !redirected && !missing;
    const status = statusFor(row.route);
    let notes = 'canonical public route';
    if (noindex) notes = 'noindex utility or diagnostic route';
    if (redirected || status.startsWith('308')) notes = 'permanent redirect; no indexable body';
    if (missing || status === '404') notes = 'not a public indexable route';
    if (indexable && !sitemapPaths.has(row.route)) notes = 'indexable but intentionally outside sitemap';
    if (/^\/stocks\/(gm|lyft|mrna)$/.test(row.route)) notes = 'mock backend fixture; production status depends on backend data';
    return [
      row.route,
      status,
      indexable ? 'yes' : 'no',
      sitemapPaths.has(row.route) ? 'yes' : 'no',
      row.canonical,
      row.h1,
      row.title,
      row.description,
      row.robots || 'default',
      row.jsonLdBlocks,
      row.jsonLdTypes.join('|'),
      inbound.get(row.route) || 0,
      row.links.length,
      notes,
    ].map(csv).join(',');
  }),
];

const deliverableRoot = fs.existsSync(path.join(root, 'stock_market')) ? root : path.resolve(root, '..');
fs.writeFileSync(path.join(deliverableRoot, 'ROUTE_AND_INDEXABILITY_INVENTORY.csv'), `${inventory.join('\n')}\n`);
console.log(`\nWrote ROUTE_AND_INDEXABILITY_INVENTORY.csv (${rows.length} routes).`);

console.log('');
if (fail > 0) {
  console.error(`${fail} SEO regression gate(s) failed (${pass} passed).\n`);
  process.exit(1);
}
console.log(`All ${pass} SEO regression gates passed.\n`);
