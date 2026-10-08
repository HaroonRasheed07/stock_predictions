import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let failures = 0;

function ok(name, pass, detail = '') {
  if (pass) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
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

console.log('\nSEO quality gates\n');

// 1. Legacy brand must not appear in source (case variants with space / camel).
const srcFiles = walk(path.join(root, 'src'));
const legacyHits = [];
for (const f of srcFiles) {
  if (!/\.(ts|tsx|css|json|html|md)$/.test(f)) continue;
  const text = fs.readFileSync(f, 'utf8');
  if (/Stock Vanta/i.test(text) || /StockVanta/.test(text)) {
    legacyHits.push(path.relative(root, f));
  }
}
ok('No legacy brand "Stock Vanta" in src/', legacyHits.length === 0, legacyHits.join(', '));

// 2. Indexable core pages declare metadata.
const mustHaveMetadata = [
  'src/app/page.tsx',
  'src/app/about/page.tsx',
  'src/app/contact/page.tsx',
  'src/app/learn/page.tsx',
  'src/app/learn/[slug]/page.tsx',
  'src/app/methodology/page.tsx',
  'src/app/privacy/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/disclaimer/page.tsx',
  'src/app/stocks/[symbol]/page.tsx',
];
for (const rel of mustHaveMetadata) {
  let text = '';
  try {
    text = read(rel);
  } catch {
    ok(`Metadata declared in ${rel}`, false, 'file missing');
    continue;
  }
  ok(`Metadata declared in ${rel}`, /export const metadata|export async function generateMetadata/.test(text));
}

// 3. Thin/utility pages are noindex.
const noindexChecks = [
  ['src/app/markets/stock/watchlist/layout.tsx', /noindex/],
  ['src/app/markets/more/layout.tsx', /noindex/],
];
for (const [rel, re] of noindexChecks) {
  let text = '';
  try {
    text = read(rel);
  } catch {
    ok(`Noindex on ${rel}`, false, 'file missing');
    continue;
  }
  ok(`Noindex on ${rel}`, re.test(text));
}

// 4. Sitemap honesty: legal pages present, learn uses article updatedAt.
{
  const sm = read('src/app/sitemap.ts');
  ok('Sitemap includes /privacy', sm.includes('/privacy'));
  ok('Sitemap includes /terms', sm.includes('/terms'));
  ok('Sitemap includes /disclaimer', sm.includes('/disclaimer'));
  ok('Sitemap learn lastModified uses article updatedAt', sm.includes('article.updatedAt'));
}

// 5. Robots: training crawlers blocked, answer crawlers allowed (not listed as blocked).
{
  const rb = read('src/app/robots.ts');
  ok('robots blocks GPTBot', rb.includes('GPTBot'));
  ok('robots blocks CCBot', rb.includes('CCBot'));
  ok('robots does not block ChatGPT-User (answer fetches allowed)', !/ChatGPT-User[\s\S]{0,80}disallow: '\/'/.test(rb));
}

// 6. Canonical domain configured.
{
  const env = fs.existsSync(path.join(root, '.env.local')) ? read('.env.local') : '';
  ok('.env.local sets NEXT_PUBLIC_SITE_URL to stockvantex.com', env.includes('NEXT_PUBLIC_SITE_URL=https://stockvantex.com'));
}

// 7. Server-rendered ticker pages: snapshot lib used + JSON-LD present.
{
  const page = read('src/app/stocks/[symbol]/page.tsx');
  ok('Ticker page uses server snapshot', page.includes('getStockSnapshot'));
  ok('Ticker page emits JSON-LD (WebPage)', page.includes("'@type': 'WebPage'"));
  ok('Ticker page emits BreadcrumbList', page.includes('BreadcrumbList'));
  ok('Ticker page has FAQ/AEO block when data present', page.includes('FAQPage'));
  ok('Ticker page links internally to learn content', page.includes('/learn/'));
}

// 8. Internal linking: homepage links into /stocks/.
{
  const home = read('src/app/page.tsx');
  ok('Homepage links to /stocks/ research pages', home.includes('/stocks/'));
}

// 9. Security headers in next.config.
{
  const cfg = read('next.config.js');
  ok('next.config sets X-Content-Type-Options', cfg.includes('X-Content-Type-Options'));
  ok('next.config disables X-Powered-By', cfg.includes('poweredByHeader: false'));
  ok('next.config redirects www host to apex', cfg.includes('www.stockvantex.com'));
}

// 10. Footer exposes the Legal section.
{
  const footer = read('src/components/layout/Footer.tsx');
  ok('Footer has a Legal section', footer.includes('>Legal</h3>'));
  ok('Footer links to /privacy', footer.includes('href="/privacy"'));
  ok('Footer links to /terms', footer.includes('href="/terms"'));
  ok('Footer links to /disclaimer', footer.includes('href="/disclaimer"'));
  ok('Footer labels terms as "Terms and Conditions"', footer.includes('Terms and Conditions'));
}

// 11. Legal pages: titles, contact email, no personal gmail in src.
{
  const privacy = read('src/app/privacy/page.tsx');
  const terms = read('src/app/terms/page.tsx');
  const disclaimer = read('src/app/disclaimer/page.tsx');
  const contact = read('src/app/contact/page.tsx');
  ok('Privacy title is "Privacy Policy"', privacy.includes('Privacy Policy |'));
  ok('Terms title is "Terms and Conditions"', terms.includes('Terms and Conditions |'));
  ok('Disclaimer page titled "Financial Disclaimer"', disclaimer.includes('Financial Disclaimer |'));
  ok('Contact page uses haroon@stockvantex.com', contact.includes('haroon@stockvantex.com'));
  ok('Contact page no longer exposes personal gmail', !/gmail\.com/i.test(contact));
  const gmailHits = srcFiles.filter((f) => /\.(ts|tsx)$/.test(f) && /gmail\.com/i.test(fs.readFileSync(f, 'utf8')));
  ok('No personal gmail address anywhere in src/', gmailHits.length === 0, gmailHits.map((f) => path.relative(root, f)).join(', '));
}

// 12. Disclaimer is linked from research pages.
{
  const ticker = read('src/app/stocks/[symbol]/page.tsx');
  ok('Ticker page links to /disclaimer', ticker.includes('href="/disclaimer"'));
  const methodology = read('src/app/methodology/page.tsx');
  ok('Methodology links to /disclaimer', methodology.includes('href="/disclaimer"'));
}

// 13. Stock URL SEO rules (canonical, noindex, sitemap, canonicalization).
{
  const page = read('src/app/stocks/[symbol]/page.tsx');
  ok('Ticker canonical is lowercase self URL', page.includes('${SITE_URL}/stocks/${normalized}') || page.includes('${SITE_URL}/stocks/${displaySymbol.toLowerCase()}'));
  ok('Non-allowlisted research pages are noindexed', page.includes('noindex'));
  ok('Metadata has a robots noindex fallback for unknown symbols', page.includes('robots:'));
  const sm = read('src/app/sitemap.ts');
  ok('Sitemap lists /stocks directory', sm.includes('`${SITE_URL}/stocks`'));
  const cfg = read('next.config.js');
  ok('No redirect swallows /stocks anymore', !/source:\s*'\/stocks'/.test(cfg));
  const home = read('src/app/page.tsx');
  ok('Homepage browse-all targets /stocks', /href="\/stocks"/.test(home));
  const client = read('src/app/stocks/[symbol]/StockPageClient.tsx');
  ok('View switches are query-string based (single indexable URL)', client.includes('router.replace') && client.includes('?view='));
}

console.log('');
if (failures > 0) {
  console.error(`${failures} SEO gate(s) failed.\n`);
  process.exit(1);
}
console.log('All SEO gates passed.\n');
