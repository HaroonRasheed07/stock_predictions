// Real-browser test of the forecast UX states:
//   S1. Quality refusal on /markets/stock/forecast (mock answers with the
//       production-shaped status:error + quality_issues) → calm informational
//       card, no red alert, no "Failed to load", no console errors.
//   S2. Same refusal on the stock research Forecast tab (/stocks/aapl).
//   S3. Success (/stocks/msft) → forecast renders with the
//       "Experimental model projection" label.
//   S4. Genuine network failure (forecast POST aborted) → real
//       "Failed to load forecast data." alert + Retry (never the calm card).
//
// Requires a prior mock-env production build:
//   node scripts/mock-seo-api.mjs (running) →
//   $env:NEXT_PUBLIC_API_URL='http://localhost:8787'; npm run build
// Optional dev-only tool:  npm i --no-save puppeteer-core
//
// Usage: node scripts/forecast-ux-test.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const BASE = 'http://localhost:3217';

let puppeteer = null;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.log('SKIP forecast-ux-test — puppeteer-core not installed (npm i --no-save puppeteer-core)');
  process.exit(0);
}

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
].find((p) => p && fs.existsSync(p));

if (!CHROME) {
  console.log('SKIP forecast-ux-test — Chrome not found');
  process.exit(0);
}
if (!fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  console.log('FAIL forecast-ux-test — no production build (run npm run build first)');
  process.exit(1);
}

let pass = 0;
let fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function waitFor(fn, timeoutMs, everyMs = 300) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(everyMs);
  }
  return false;
}

const QUALITY_TEXT = "didn't pass quality checks today";
const FAILED_TEXT = 'Failed to load forecast data';

const mock = spawn(process.execPath, ['scripts/mock-seo-api.mjs'], { cwd: root, stdio: 'ignore' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3217'], { cwd: root, stdio: 'ignore' });
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
  console.log('\nForecast UX browser test (quality-refusal vs real error)\n');

  const page = await browser.newPage();
  let abortForecast = false;
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Environmental noise: blocked external hosts, missing static assets,
    // and Vercel-only scripts that 404 in local `next start`.
    if (text.includes('Failed to load resource') || text.includes('net::ERR')) return;
    if (text.includes('/_vercel/')) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (abortForecast && req.method() === 'POST' && req.url().includes('/api/forecast/onnx')) {
      req.abort('failed').catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });

  const bodyText = () => page.evaluate(() => document.body.innerText);
  const resetErrors = () => { consoleErrors.length = 0; };
  const linkHrefs = () => page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));

  // ── S1: forecast page, quality refusal ────────────────────────────────────
  await page.goto(`${BASE}/markets/stock/forecast`, { waitUntil: 'networkidle2', timeout: 60000 });
  ok('S1 quality refusal renders calm card', await waitFor(async () => (await bodyText()).includes(QUALITY_TEXT), 45000), 'notice never appeared');
  const t1 = await bodyText();
  ok('S1 no "Failed to load forecast data" text', !t1.includes(FAILED_TEXT));
  ok('S1 no red alert (role=alert) rendered', await page.evaluate(() => document.querySelectorAll('[role="alert"]').length === 0));
  const hrefs1 = await linkHrefs();
  ok('S1 links to Technical tab', hrefs1.some((h) => h === '/stocks/aapl?view=technical'), JSON.stringify(hrefs1.filter((h) => h && h.includes('view='))));
  ok('S1 links to Risk tab', hrefs1.some((h) => h === '/stocks/aapl?view=risk'));
  ok('S1 links to Methodology page', hrefs1.some((h) => h === '/methodology'));
  await sleep(1500);
  ok('S1 no console errors for this expected state', consoleErrors.length === 0, consoleErrors.join(' | '));

  // ── S2: stock research Forecast tab, quality refusal ──────────────────────
  resetErrors();
  await page.goto(`${BASE}/stocks/aapl?view=forecast`, { waitUntil: 'networkidle2', timeout: 60000 });
  ok('S2 stock-page Forecast tab shows calm card', await waitFor(async () => (await bodyText()).includes(QUALITY_TEXT), 45000), 'notice never appeared');
  const t2 = await bodyText();
  ok('S2 no failure wording', !t2.includes('Failed to load') && !t2.includes('The forecast model may not support'));
  const hrefs2 = await linkHrefs();
  ok('S2 links to Technical tab', hrefs2.some((h) => h === '/stocks/aapl?view=technical'));
  ok('S2 links to Risk tab', hrefs2.some((h) => h === '/stocks/aapl?view=risk'));
  ok('S2 links to Methodology page', hrefs2.some((h) => h === '/methodology'));
  await sleep(1500);
  ok('S2 no console errors for this expected state', consoleErrors.length === 0, consoleErrors.join(' | '));

  // ── S3: success state keeps the experimental label ────────────────────────
  resetErrors();
  await page.goto(`${BASE}/stocks/msft?view=forecast`, { waitUntil: 'networkidle2', timeout: 60000 });
  ok('S3 forecast renders for MSFT', await waitFor(async () => (await bodyText()).includes('Price Forecast'), 45000), 'forecast card never appeared');
  const t3 = await bodyText();
  ok('S3 "Experimental model projection" label shown', t3.includes('Experimental model projection'));
  ok('S3 chart rendered', await page.evaluate(() => document.querySelectorAll('.recharts-wrapper svg').length > 0));
  ok('S3 no quality card on success', !t3.includes(QUALITY_TEXT));
  await sleep(1500);
  ok('S3 no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  // ── S4: genuine network failure keeps the real error alert ────────────────
  resetErrors();
  abortForecast = true;
  await page.goto(`${BASE}/markets/stock/forecast`, { waitUntil: 'networkidle2', timeout: 60000 });
  const s4shown = await waitFor(async () => (await bodyText()).includes(FAILED_TEXT), 45000);
  ok('S4 real failure shows "Failed to load forecast data"', s4shown, s4shown ? '' : `page text: ${(await bodyText()).slice(0, 240).replace(/\s+/g, ' ')}`);
  const t4 = await bodyText();
  ok('S4 Retry control offered', t4.includes('Retry'));
  ok('S4 calm card NOT used for real errors', !t4.includes(QUALITY_TEXT));
  abortForecast = false;
} catch (err) {
  fail += 1;
  console.log(`  FAIL  harness — ${err.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  mock.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
