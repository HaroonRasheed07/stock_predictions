// Real-browser GA4 behavior test: regional consent gating, initial
// page_view, client-side navigation page_views (exactly one per transition,
// no dupes), the footer Privacy Settings opt-out/opt-in cycle, and the
// default-on standard tier + GPC opt-out.
//
// Tier simulation: locally /api/region has no Vercel edge country header and
// fails closed to 'strict', so flows A–G exercise the prior-consent tier
// (minimal notice → allow/decline). Flows I–J seed the region cache to
// simulate a standard tier visitor, and a Global Privacy Control browser.
//
// Delivery model under test: gtag('config') sends the initial page_view;
// gtag.js's built-in history tracking (pushState/replaceState) sends exactly
// one page_view per route transition, delivered a couple of seconds after the
// change (gtag's internal interval). Depending on Google's tag_exp experiment,
// those hits may arrive with or without an `en=page_view` param — both forms
// are counted (engagement hits like scroll/user_engagement always carry `en`
// and are excluded). Collect hits are answered locally with a 204 stub, so
// nothing reaches the real GA4 property.
//
// Requires an optional dev-only tool:  npm i --no-save puppeteer-core
// (skips cleanly when puppeteer-core is not installed).
//
// Usage: node scripts/ga-browser-test.mjs   (requires a prior `next build`)
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const BASE = 'http://localhost:3216';
const GA_ID = 'G-87F1WZ9KPF';

let puppeteer = null;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.log('SKIP ga-browser-test — puppeteer-core not installed (npm i --no-save puppeteer-core)');
  process.exit(0);
}

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
].find((p) => p && fs.existsSync(p));

if (!CHROME) {
  console.log('SKIP ga-browser-test — Chrome not found');
  process.exit(0);
}
if (!fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  console.log('FAIL ga-browser-test — no production build (run npm run build first)');
  process.exit(1);
}

let pass = 0;
let fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function waitFor(fn, timeoutMs, everyMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Evaluate can throw while a deliberate navigation/reload tears the
    // execution context down — treat that as "not yet" and keep polling.
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(everyMs);
  }
  return false;
}

async function clickButton(page, label) {
  const found = await waitFor(
    () => page.evaluate((l) => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes(l)), label),
    15000
  );
  if (!found) return false;
  await page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(l)).click(), label);
  return true;
}

function trackCounts(page, counts, tag = '') {
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('googletagmanager.com/gtag/js')) {
      counts.gtagScript += 1;
      if (process.env.GA_BROWSER_VERBOSE) console.log(`    [${tag}] gtag.js load #${counts.gtagScript} @${Date.now() % 100000}`);
    }
    if (url.includes('google-analytics.com/') || url.includes('googletagmanager.com/gtag/')) {
      try {
        const u = new URL(url);
        if (process.env.GA_BROWSER_VERBOSE && url.includes('/collect')) {
          console.log(`    [${tag}] collect en=${u.searchParams.get('en')} sc=${u.searchParams.get('sc')} cid=${(u.searchParams.get('cid') || '').slice(0, 8)} sid=${u.searchParams.get('sid')} dl=${u.searchParams.get('dl')} @${Date.now() % 100000}`);
          console.log(`        full: ${decodeURIComponent(url).slice(0, 600)}`);
        }
        const en = u.searchParams.get('en');
        // Page views: explicit en=page_view (config/manual/history in some
        // tag_exp experiments) OR the en-less variant gtag uses for history
        // page_views (carries dl + dr/dp but no event name). Engagement hits
        // (scroll, user_engagement, ...) always carry `en` → excluded here.
        const isPageView =
          en === 'page_view' ||
          u.searchParams.get('t') === 'pageview' ||
          (en === null && (u.searchParams.get('dp') || (u.searchParams.get('dl') && u.searchParams.get('dr'))));
        if (isPageView) {
          counts.pageViews += 1;
          try {
            counts.paths.push(new URL(u.searchParams.get('dl')).pathname);
          } catch {
            counts.paths.push(u.searchParams.get('dl'));
          }
          if (process.env.GA_BROWSER_VERBOSE) {
            console.log(`    [${tag}] page_view #${counts.pageViews} en=${en} dl=${u.searchParams.get('dl')} @${Date.now() % 100000}`);
          }
        }
      } catch {}
      // Answer 204 with CORS so the browser accepts the response — no retries,
      // no real hits reach the GA4 property.
      if (url.includes('/collect')) {
        req.respond({ status: 204, contentType: 'text/plain', body: '', headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
        return;
      }
    }
    req.continue().catch(() => {});
  });
}

function seedStandardRegion(page) {
  return page.evaluateOnNewDocument(() => {
    try {
      window.localStorage.setItem(
        'sv-analytics-region',
        JSON.stringify({ country: 'US', tier: 'standard', ts: Date.now() })
      );
    } catch {}
  });
}

const mock = spawn(process.execPath, ['scripts/mock-seo-api.mjs'], { cwd: root, stdio: 'ignore' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3216'], { cwd: root, stdio: 'ignore' });
let browser = null;

try {
  let ready = false;
  for (let i = 0; i < 45 && !ready; i++) {
    try {
      const r = await fetch(`${BASE}/robots.txt`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (r.status === 200) { ready = true; break; }
    } catch {}
    await sleep(1000);
  }
  if (!ready) throw new Error('server did not become ready');

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  console.log('\nGA4 browser test (collect hits stubbed locally with 204 — real property receives nothing)\n');

  const page = await browser.newPage();
  const counts = { gtagScript: 0, pageViews: 0, paths: [] };
  await page.setRequestInterception(true);
  trackCounts(page, counts);

  // A. Pre-consent (strict tier, region resolving): zero Google requests.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  ok('A. Pre-consent: no gtag.js loaded', counts.gtagScript === 0, String(counts.gtagScript));
  ok('A. Pre-consent: zero page_view hits', counts.pageViews === 0, String(counts.pageViews));

  // B. Grant consent → exactly one initial page_view (gtag config).
  ok('B. Consent notice visible (strict tier, local has no edge country)', await clickButton(page, 'Allow analytics'));
  await waitFor(() => counts.pageViews >= 1, 20000);
  await sleep(2000);
  ok('B. Initial load fires exactly 1 page_view', counts.pageViews === 1, `got ${counts.pageViews}`);
  ok('B. gtag.js loaded exactly once', counts.gtagScript === 1, String(counts.gtagScript));

  // C. Client-side navigation / → /stocks: gtag's history tracking sends
  // exactly one page_view for the transition (delivered a couple of seconds
  // after the change). A manual event on top of this would make it 3.
  const clickedStocks = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/stocks');
    if (a) { a.click(); return true; }
    return false;
  });
  ok('C. Navigated via client-side link to /stocks', clickedStocks && (await waitFor(() => page.evaluate(() => location.pathname === '/stocks'), 15000)));
  await waitFor(() => counts.pageViews >= 2, 20000);
  await sleep(2000);
  ok('C. Transition fires exactly 1 page_view (total 2, no dupes)', counts.pageViews === 2 && JSON.stringify(counts.paths) === JSON.stringify(['/', '/stocks']), `got ${counts.pageViews} paths=${JSON.stringify(counts.paths)}`);

  // D. Next navigation /stocks → /stocks/aapl: exactly one more.
  const clickedAapl = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/stocks/aapl');
    if (a) { a.click(); return true; }
    return false;
  });
  ok('D. Navigated via client-side link to /stocks/aapl', clickedAapl && (await waitFor(() => page.evaluate(() => location.pathname === '/stocks/aapl'), 15000)));
  await waitFor(() => counts.pageViews >= 3, 20000);
  await sleep(2000);
  ok('D. Stock transition fires exactly 1 page_view (total 3)', counts.pageViews === 3 && JSON.stringify(counts.paths) === JSON.stringify(['/', '/stocks', '/stocks/aapl']), `got ${counts.pageViews} paths=${JSON.stringify(counts.paths)}`);

  // E. Full reload: config fires for the learn article — exactly one
  // page_view per page visited so far, no dupes.
  await page.goto(`${BASE}/learn/what-is-rsi`, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitFor(() => counts.pageViews >= 4, 20000);
  await sleep(2500);
  ok('E. Exactly one page_view per page (/, /stocks, aapl, learn)', counts.pageViews === 4 && JSON.stringify(counts.paths) === JSON.stringify(['/', '/stocks', '/stocks/aapl', '/learn/what-is-rsi']), `got ${counts.pageViews} paths=${JSON.stringify(counts.paths)}`);

  // F. Fresh visitor declines → zero Google requests, choice persisted.
  const ctx = await browser.createBrowserContext();
  const fresh = await ctx.newPage();
  const freshCounts = { gtagScript: 0, pageViews: 0, paths: [] };
  await fresh.setRequestInterception(true);
  trackCounts(fresh, freshCounts);
  await fresh.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  ok('F. Fresh visitor: declined keeps GA unloaded', await clickButton(fresh, 'Essential only'));
  await sleep(2500);
  ok('F. Declined: no gtag.js, zero page_view hits', freshCounts.gtagScript === 0 && freshCounts.pageViews === 0, `script=${freshCounts.gtagScript} pv=${freshCounts.pageViews}`);
  const stored = await fresh.evaluate(() => window.localStorage.getItem('sv-analytics-consent'));
  ok('F. Decline persisted in localStorage', stored === 'denied', String(stored));
  await ctx.close();

  // G. Reload with granted consent: config fires once, no banner re-prompt.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitFor(() => counts.pageViews >= 5, 20000);
  await sleep(1500);
  ok('G. Reload with consent tracks once (total 5, config not doubled)', counts.pageViews === 5 && counts.paths[4] === '/', `got ${counts.pageViews} paths=${JSON.stringify(counts.paths)}`);
  const bannerBack = await page.evaluate(() => Boolean(document.querySelector('[aria-label="Analytics consent"]')));
  ok('G. No consent notice re-prompt after prior grant', !bannerBack);

  // H. Footer Privacy Settings: disable → GA stops (no further hits during
  // navigation), then enable → reload gives one clean config page_view.
  {
    ok('H. Footer Privacy Settings entry opens the dialog', await clickButton(page, 'Privacy Settings'));
    await sleep(600);
    const dialogShown = await page.evaluate(() => document.body.innerText.includes('Google Analytics') && document.body.innerText.includes('Enabled'));
    ok('H. Dialog shows analytics status Enabled', dialogShown);
    ok('H. Disable analytics button works', await clickButton(page, 'Disable analytics'));
    await sleep(800);
    const afterDisable = await page.evaluate(() => window.localStorage.getItem('sv-analytics-consent'));
    ok('H. Opt-out persisted in localStorage', afterDisable === 'denied', String(afterDisable));
    const pvBefore = counts.pageViews;
    const navigated = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/methodology');
      if (a) { a.click(); return true; }
      return false;
    });
    ok('H. Navigated client-side after opt-out', navigated && (await waitFor(() => page.evaluate(() => location.pathname === '/methodology'), 15000)));
    await sleep(3500);
    ok('H. Opt-out stops all further page_view hits', counts.pageViews === pvBefore, `before=${pvBefore} after=${counts.pageViews}`);
    ok('H. Re-open settings and enable again', (await clickButton(page, 'Privacy Settings')) && (await clickButton(page, 'Enable analytics')));
    await waitFor(() => page.evaluate(() => window.localStorage.getItem('sv-analytics-consent') === 'granted'), 8000);
    await waitFor(() => counts.pageViews >= pvBefore + 1, 20000);
    await sleep(1500);
    const pvAfterEnable = counts.pageViews;
    ok('H. Enable reloads and fires exactly one config page_view', pvAfterEnable === pvBefore + 1, `before=${pvBefore} after=${pvAfterEnable}`);
    ok('H. No consent notice after re-enable', !(await page.evaluate(() => Boolean(document.querySelector('[aria-label="Analytics consent"]')))));
  }

  // I. Standard tier (seeded region cache): analytics allowed by default,
  // no consent notice at all; footer opt-out still available.
  const ctx2 = await browser.createBrowserContext();
  const std = await ctx2.newPage();
  const stdCounts = { gtagScript: 0, pageViews: 0, paths: [] };
  await seedStandardRegion(std);
  await std.setRequestInterception(true);
  trackCounts(std, stdCounts);
  await std.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitFor(() => stdCounts.pageViews >= 1, 20000);
  await sleep(1500);
  ok('I. Standard tier: analytics loads by default (1 page_view)', stdCounts.pageViews === 1, `pv=${stdCounts.pageViews}`);
  ok('I. Standard tier: no consent notice shown', !(await std.evaluate(() => Boolean(document.querySelector('[aria-label="Analytics consent"]')))));
  ok('I. Standard tier: footer opt-out available', await clickButton(std, 'Privacy Settings'));
  await sleep(600);
  ok('I. Standard tier: dialog shows Enabled', await std.evaluate(() => document.body.innerText.includes('Enabled')));
  ok('I. Standard tier: disable works', await clickButton(std, 'Disable analytics'));
  await sleep(800);
  const stdStored = await std.evaluate(() => window.localStorage.getItem('sv-analytics-consent'));
  ok('I. Standard tier: opt-out persisted', stdStored === 'denied', String(stdStored));
  await ctx2.close();

  // J. Global Privacy Control signal: analytics stays off by default even
  // in a standard tier region, and no notice interrupts the visit.
  const ctx3 = await browser.createBrowserContext();
  const gpcPage = await ctx3.newPage();
  const gpcCounts = { gtagScript: 0, pageViews: 0, paths: [] };
  await seedStandardRegion(gpcPage);
  await gpcPage.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
  });
  await gpcPage.setRequestInterception(true);
  trackCounts(gpcPage, gpcCounts);
  await gpcPage.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  ok('J. GPC signal: no gtag.js, zero page_view hits', gpcCounts.gtagScript === 0 && gpcCounts.pageViews === 0, `script=${gpcCounts.gtagScript} pv=${gpcCounts.pageViews}`);
  ok('J. GPC signal: no consent notice shown', !(await gpcPage.evaluate(() => Boolean(document.querySelector('[aria-label="Analytics consent"]')))));
  await ctx3.close();
} catch (err) {
  fail += 1;
  console.log(`  FAIL  unexpected error — ${err.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  mock.kill();
}

console.log('');
if (fail > 0) {
  console.error(`${fail} browser gate(s) failed (${pass} passed).\n`);
  process.exit(1);
}
console.log(`All ${pass} browser gates passed.\n`);
