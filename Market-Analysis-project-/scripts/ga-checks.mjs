// GA4 regional-consent & integration gates for StockVantex.
//
// Static checks: single mount, env-var usage, region-based consent gating
// (strict tier = prior consent, standard tier = default-on with footer
// opt-out, fail-closed region resolution), no duplicate tracking
// implementations, privacy disclosure. Runtime checks (against an existing
// production build): SSR HTML must contain ZERO Google tags before consent,
// the /api/region endpoint must respond, SEO metadata must be intact, and
// the measurement ID must be inlined in the client bundle.
//
// Usage: node scripts/ga-checks.mjs
import fs from 'node:fs';
import path from 'node:path';

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

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

console.log('\nGA4 checks — static\n');

const consentSrc = read('src/components/common/AnalyticsConsent.tsx');
const consentLib = read('src/lib/analytics-consent.ts');
const regionLib = read('src/lib/consent-region.ts');
const regionRoute = read('src/app/api/region/route.ts');
const footerSrc = read('src/components/layout/Footer.tsx');
const layoutSrc = read('src/app/layout.tsx');
const srcFiles = walk(path.join(root, 'src'));

// 1. Official package installed and compatible.
{
  const pkg = JSON.parse(read('package.json'));
  ok('@next/third-parties installed', Boolean(pkg.dependencies['@next/third-parties']));
  const peer = JSON.parse(read('node_modules/@next/third-parties/package.json')).peerDependencies;
  ok('@next/third-parties peer-supports installed Next version', Boolean(peer.next), peer.next);
}

// 2. Mounted exactly once, in the root layout.
{
  const mounts = layoutSrc.match(/<AnalyticsConsent/g) || [];
  ok('Mounted exactly once in root layout', mounts.length === 1, `found ${mounts.length}`);
  ok('Root layout imports the consent component', layoutSrc.includes("from '@/components/common/AnalyticsConsent'"));
  const googleAnalyticsFiles = srcFiles.filter((f) => fs.readFileSync(f, 'utf8').includes('<GoogleAnalytics'));
  ok('GoogleAnalytics component used in exactly one file', googleAnalyticsFiles.length === 1, googleAnalyticsFiles.map((f) => path.relative(root, f)).join(','));
  ok('That file is the consent gate', googleAnalyticsFiles.length === 1 && googleAnalyticsFiles[0].endsWith('AnalyticsConsent.tsx'));
}

// 3. Environment variable usage; no stray measurement IDs.
{
  ok('Uses NEXT_PUBLIC_GA_MEASUREMENT_ID', consentLib.includes('process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID'));
  const ids = new Set();
  for (const f of srcFiles) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bG-[A-Z0-9]{6,}\b/g)) ids.add(m[0]);
  }
  ok('Exactly one GA measurement ID in src (env fallback G-87F1WZ9KPF)', ids.size === 1 && ids.has('G-87F1WZ9KPF'), [...ids].join(','));
  const example = read('.env.local.example');
  ok('.env.local.example documents NEXT_PUBLIC_GA_MEASUREMENT_ID', example.includes('NEXT_PUBLIC_GA_MEASUREMENT_ID=G-87F1WZ9KPF'));
  const local = fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8') : '';
  ok('.env.local sets NEXT_PUBLIC_GA_MEASUREMENT_ID', local.includes('NEXT_PUBLIC_GA_MEASUREMENT_ID=G-87F1WZ9KPF'));
}

// 4. Regional consent gating: strict tier requires an explicit grant before
//    any Google code loads; standard tier defaults on with a real opt-out;
//    an unresolvable region fails closed to prior consent.
{
  ok('GA mounts only when analytics is effective-on (grant or standard default)', consentSrc.includes('const gaActive = effective === \'on\'') && consentSrc.includes('{gaActive && <GoogleAnalytics'));
  ok('Strict tier shows the notice; standard tier never does', consentSrc.includes("bannerVisible = mounted && effective === 'ask'") && consentSrc.includes("tier === 'strict'") && consentSrc.includes("tier === 'standard'"));
  ok('Banner is the only pre-consent prompt (no dialog auto-open)', consentSrc.includes('role="region"') && consentSrc.includes('aria-label="Analytics consent"'));
  ok('Region endpoint reads the Vercel edge country header', regionRoute.includes('x-vercel-ip-country'));
  ok('Region resolution fails closed to strict when country is unknown', regionLib.includes("if (!country) return 'strict'") && consentLib.includes("tier: 'strict'"));
  ok('Consent tier list is explicit and auditable', regionLib.includes('STRICT_CONSENT_COUNTRIES'));
  ok('Choice persists in localStorage', consentLib.includes('sv-analytics-consent') && consentLib.includes('localStorage.getItem') && consentLib.includes('localStorage.setItem'));
  ok('Choice is restored on load', consentSrc.includes('readConsent('));
  ok('Banner offers grant and decline', consentSrc.includes("decide('granted')") && consentSrc.includes("decide('denied')"));
}

// 5. Page-view ownership: gtag('config') fires the initial page_view and
//    gtag.js's built-in history tracking fires one per route transition —
//    the app must NOT emit its own manual page_view event (it would
//    duplicate every navigation, proven by ga-browser-test).
{
  ok('No manual page_view event in the consent gate', !consentSrc.includes("'event', 'page_view'") && !consentSrc.includes('window.gtag('));
  ok('No gtag() call anywhere in src', !srcFiles.some((f) => /gtag\(/.test(fs.readFileSync(f, 'utf8'))));
  ok('No routing-hook tracking state (no usePathname/useSearchParams)', !consentSrc.includes('usePathname') && !consentSrc.includes('useSearchParams'));
  ok('No leftover dedup refs from manual tracking', !consentSrc.includes('lastTrackedPath') && !consentSrc.includes('becameGranted'));
}

// 6. No duplicate or legacy tracking implementations anywhere else.
{
  const strays = srcFiles.filter((f) => {
    const text = fs.readFileSync(f, 'utf8');
    if (f.endsWith('AnalyticsConsent.tsx')) return false;
    return /googletagmanager|gtag\(|dataLayer|GTM-[A-Z]/.test(text);
  });
  ok('No gtag/GTM/dataLayer outside the consent gate', strays.length === 0, strays.map((f) => path.relative(root, f)).join(','));
  ok('No GoogleTagManager component used', !srcFiles.some((f) => fs.readFileSync(f, 'utf8').includes('GoogleTagManager')));
}

// 7. Privacy Settings entry point + working opt-out + GPC signal.
{
  ok('Footer exposes Privacy Settings', footerSrc.includes('Privacy Settings') && footerSrc.includes('dispatchOpenSettings'));
  ok('Consent gate listens for the footer settings event', consentSrc.includes('OPEN_SETTINGS_EVENT'));
  ok('Settings dialog is rendered by the consent gate', consentSrc.includes('<Dialog open={settingsOpen}'));
  ok('Opt-out sets the ga-disable flag and clears GA cookies', consentLib.includes('ga-disable-') && consentLib.includes("startsWith('_ga_')"));
  ok('Re-enable after opt-out reloads for a single clean gtag init', consentSrc.includes('location.reload()'));
  ok('Global Privacy Control honoured as an opt-out', consentLib.includes('globalPrivacyControl'));
}

// 8. Privacy disclosure updated for GA4 + regional consent.
{
  const privacy = read('src/app/privacy/page.tsx');
  ok('Privacy page discloses Google Analytics', privacy.includes('Google Analytics'));
  ok('Privacy page documents prior-consent behavior', privacy.includes('prior consent'));
  ok('Privacy page documents the consent storage key', privacy.includes('sv-analytics-consent'));
  ok('Privacy page documents the Privacy Settings opt-out', privacy.includes('Privacy Settings'));
  ok('Privacy page documents fail-closed region handling', privacy.includes('fail closed'));
}

// ---------------------------------------------------------------- runtime ---
const BUILD_ID = path.join(root, '.next', 'BUILD_ID');
if (!fs.existsSync(BUILD_ID)) {
  console.log('\n  SKIP  runtime checks — no production build found (run `npm run build` first)\n');
} else {
  console.log('\nGA4 checks — runtime (SSR pre-consent + bundle)\n');
  const { spawn } = await import('node:child_process');
  const { setTimeout: sleep } = await import('node:timers/promises');

  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3215'], {
    cwd: root,
    stdio: 'ignore',
  });
  const BASE = 'http://localhost:3215';

  const get = async (pathname) => {
    const res = await fetch(`${BASE}${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text() };
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
    ok('production server ready on :3215', ready);
    if (ready) {
      for (const p of ['/', '/stocks/msft', '/learn/what-is-rsi']) {
        const r = await get(p);
        ok(`${p} → 200`, r.status === 200, String(r.status));
        ok(`${p}: zero Google tags in SSR HTML (pre-consent)`, !r.text.includes('googletagmanager') && !r.text.includes('dataLayer') && !r.text.includes('gtag('), 'found a Google tag');
        ok(`${p}: client bundle entry present`, r.text.includes('/_next/static/'));
      }

      // Region endpoint: responds with a tier; locally (no edge country
      // header) it must fail closed to prior consent.
      const region = await get('/api/region');
      ok('/api/region → 200', region.status === 200, String(region.status));
      let regionTier = null;
      try { regionTier = JSON.parse(region.text).tier; } catch {}
      ok('/api/region returns a valid tier (strict when country unknown)', regionTier === 'strict' || regionTier === 'standard', String(regionTier));
      ok('/api/region fails closed locally without an edge header', regionTier === 'strict', String(regionTier));

      // SEO untouched by the integration.
      const home = await get('/');
      ok('Homepage canonical intact', home.text.includes(`<link rel="canonical" href="https://stockvantex.com"`));
      const msft = await get('/stocks/msft');
      ok('Stock canonical intact', msft.text.includes('https://stockvantex.com/stocks/msft"'));
      const learn = await get('/learn/what-is-rsi');
      ok('Learn canonical intact', learn.text.includes('https://stockvantex.com/learn/what-is-rsi"'));

      // Measurement ID inlined into the client bundle (env or documented fallback).
      const chunkSrcs = [...home.text.matchAll(/\/_next\/static\/chunks\/[^"]+\.js/g)].map((m) => m[0]);
      ok('Client chunks discovered', chunkSrcs.length > 0, String(chunkSrcs.length));
      let foundId = false;
      let fetched = 0;
      for (const src of [...new Set(chunkSrcs)]) {
        if (fetched >= 25) break;
        fetched += 1;
        try {
          const res = await fetch(`${BASE}${src}`, { signal: AbortSignal.timeout(10000) });
          const js = await res.text();
          if (js.includes('G-87F1WZ9KPF')) { foundId = true; break; }
        } catch {}
      }
      ok('GA measurement ID present in client bundle', foundId, `checked ${fetched} chunks`);

      // Sitemap/robots untouched (sanity; full gates live in sitemap-checks).
      const sm = await get('/sitemap.xml');
      ok('Sitemap still 200 application/xml', sm.status === 200 && /xml/.test(sm.type), `${sm.status} ${sm.type}`);
      const rb = await get('/robots.txt');
      ok('Robots still references sitemap', rb.text.includes('Sitemap: https://stockvantex.com/sitemap.xml'));
    }
  } finally {
    server.kill();
  }
}

console.log('');
if (fail > 0) {
  console.error(`${fail} GA gate(s) failed (${pass} passed).\n`);
  process.exit(1);
}
console.log(`All ${pass} GA gates passed.\n`);
