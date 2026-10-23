// Signal/score consistency gates for StockVantex.
//
// Two layers:
//  1. Behavioural tests — transpiles src/lib/signal-bands.ts,
//     src/lib/brief-assessment.ts, and src/lib/model-outlook.ts to CommonJS
//     in a temp dir and exercises the canonical band logic (risk 35/65,
//     opportunity 40/70, sentiment ±0.15, trend 60/40, forecast flat ±0.3%)
//     plus the Stock Brief assessment rules (aligned / mixed / diverging,
//     missing-data honesty, high-risk-does-not-force-Mixed).
//  2. Source consistency checks — greps the UI sources to make sure no
//     component has drifted back to off-band thresholds or fabricated
//     fallbacks (e.g. opportunity_score used as a confidence %).
//
// Usage: node scripts/signal-checks.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, `expected ${e}, got ${a}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// ── Transpile the pure libs to CJS and load them ─────────────────────────
console.log('\nsignal checks — behavioural\n');

const ts = require('typescript');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-signal-checks-'));
const LIBS = ['signal-bands.ts', 'brief-assessment.ts', 'model-outlook.ts'];
const loaded = {};

for (const file of LIBS) {
  const src = read(path.join('src/lib', file));
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  const jsPath = path.join(tmp, file.replace(/\.ts$/, '.js'));
  fs.writeFileSync(jsPath, out);
  loaded[file.replace(/\.ts$/, '.js')] = require(jsPath);
}

const bands = loaded['signal-bands.js'];
const assess = loaded['brief-assessment.js'];
const outlook = loaded['model-outlook.js'];

// ── Canonical band constants ─────────────────────────────────────────────
eq('RISK_BANDS = 35 / 65', bands.RISK_BANDS, { MEDIUM_MIN: 35, HIGH_MIN: 65 });
eq('OPPORTUNITY_BANDS = 40 / 70', bands.OPPORTUNITY_BANDS, { LOW_MAX: 40, HIGH_MIN: 70 });
eq('SENTIMENT_NEUTRAL_BAND = 0.15', bands.SENTIMENT_NEUTRAL_BAND, 0.15);
eq('TREND_SCORE_BANDS = 60 / 40', bands.TREND_SCORE_BANDS, { BULLISH_MIN: 60, BEARISH_MAX: 40 });
eq('FORECAST_FLAT_PCT = 0.003', bands.FORECAST_FLAT_PCT, 0.003);

// ── Risk level boundaries (backend risk.py: <35 Low, 35–65 Medium, ≥65 High) ──
eq('risk 34.9 → Low', bands.riskLevelFor(34.9), 'Low');
eq('risk 35 → Medium', bands.riskLevelFor(35), 'Medium');
eq('risk 64.9 → Medium', bands.riskLevelFor(64.9), 'Medium');
eq('risk 65 → High', bands.riskLevelFor(65), 'High');
eq('risk 82 → High', bands.riskLevelFor(82), 'High');
eq('risk null → Unknown', bands.riskLevelFor(null), 'Unknown');

// ── Opportunity display bands (40 / 70) ──────────────────────────────────
eq('opportunity 39.9 → low', bands.opportunityBandFor(39.9), 'low');
eq('opportunity 40 → moderate', bands.opportunityBandFor(40), 'moderate');
eq('opportunity 69.9 → moderate', bands.opportunityBandFor(69.9), 'moderate');
eq('opportunity 70 → high', bands.opportunityBandFor(70), 'high');
eq('opportunity null → low', bands.opportunityBandFor(null), 'low');

// ── Sentiment tone band (backend label: ≥+0.15 / ≤-0.15) ────────────────
eq('sentiment +0.15 boundary → bullish', bands.sentimentTone(0.15), 'bullish');
eq('sentiment +0.149 → neutral', bands.sentimentTone(0.149), 'neutral');
eq('sentiment -0.15 boundary → bearish', bands.sentimentTone(-0.15), 'bearish');
eq('sentiment -0.149 → neutral', bands.sentimentTone(-0.149), 'neutral');
eq('sentiment 0 → neutral', bands.sentimentTone(0), 'neutral');
eq('sentiment null → neutral', bands.sentimentTone(null), 'neutral');

// ── Brief assessment scenarios ───────────────────────────────────────────

// 1. CRWV-like fixture: Mixed Evidence + high_risk_divergence + High risk
//    with a positive sentiment — Mixed stays Mixed, risk note fires, and the
//    bullish sentiment chip is preserved (never collapsed into a direction).
{
  const a = assess.assessBriefEvidence({
    signal: 'Mixed Evidence',
    evidenceState: 'high_risk_divergence',
    riskLevel: 'High',
    riskScore: 72,
    sentimentStatus: 'sufficient',
    sentimentLabel: 'Positive',
    timeframeConsensus: 'Hold',
  });
  eq('CRWV: label = Mixed Evidence', a.label, 'Mixed Evidence');
  eq('CRWV: agreement = mixed', a.agreement, 'mixed');
  eq('CRWV: hasConflict', a.hasConflict, true);
  ok('CRWV: riskNote present and mentions High', !!a.riskNote && a.riskNote.includes('High'), a.riskNote || '');
  const sent = a.chips.find((c) => c.name === 'Sentiment');
  eq('CRWV: sentiment chip stays bullish', sent && sent.direction, 'bullish');
  eq('CRWV: counts', a.counts, { bullish: 1, bearish: 0, neutral: 2, total: 3 });
}

// 2. The original complaint: Hold-style technical + Sell consensus with no
//    sentiment used to render as "aligned". It must now be diverging with an
//    explanation, not silent agreement.
{
  const a = assess.assessBriefEvidence({
    signal: 'Hold',
    sentimentStatus: 'insufficient',
    timeframeConsensus: 'Sell',
  });
  eq('complaint: agreement = diverging', a.agreement, 'diverging');
  eq('complaint: label = Neutral (from signal)', a.label, 'Neutral');
  ok('complaint: divergence explanation present', !!a.conflictExplanation, JSON.stringify(a.counts));
  ok('complaint: sentiment limitation listed', a.limitations.some((l) => l.includes('sentiment')), a.limitations.join(' | '));
}

// 3. Opposing directional votes → Mixed Evidence with named sources.
{
  const a = assess.assessBriefEvidence({
    signal: 'Buy',
    sentimentStatus: 'sufficient',
    sentimentLabel: 'Negative',
    timeframeConsensus: 'Sell',
  });
  eq('opposing: agreement = mixed', a.agreement, 'mixed');
  eq('opposing: label = Mixed Evidence', a.label, 'Mixed Evidence');
  ok('opposing: explanation names both sides', !!a.conflictExplanation && a.conflictExplanation.includes('Technical') && a.conflictExplanation.includes('Sentiment'), a.conflictExplanation || '');
}

// 4. Fully aligned bullish.
{
  const a = assess.assessBriefEvidence({
    signal: 'Buy',
    sentimentStatus: 'sufficient',
    sentimentLabel: 'Positive',
    timeframeConsensus: 'Buy',
  });
  eq('aligned: agreement', a.agreement, 'aligned');
  eq('aligned: label', a.label, 'Bullish');
  eq('aligned: color', a.colorClass, 'text-success');
  eq('aligned: counts', a.counts, { bullish: 3, bearish: 0, neutral: 0, total: 3 });
  eq('aligned: no limitations', a.limitations.length, 0);
  eq('aligned: no riskNote without High risk', a.riskNote, null);
}

// 5. High risk with fully aligned bullish evidence: backend sets
//    conflict_details.has_conflict=true (because risk is High) but
//    evidence_state stays aligned_bullish — must NOT flip to Mixed.
{
  const a = assess.assessBriefEvidence({
    signal: 'Buy',
    evidenceState: 'aligned_bullish',
    hasConflict: true,
    riskWarning: true,
    riskLevel: 'High',
    riskScore: 70,
    sentimentStatus: 'sufficient',
    sentimentLabel: 'Positive',
    timeframeConsensus: 'Buy',
  });
  eq('high-risk aligned: stays aligned', a.agreement, 'aligned');
  eq('high-risk aligned: label stays Bullish', a.label, 'Bullish');
  ok('high-risk aligned: riskNote warns about the divergence', !!a.riskNote && a.riskNote.includes('High'), a.riskNote || '');
  ok('high-risk aligned: riskNote says risk ≠ Sell', !!a.riskNote && a.riskNote.includes('does not by itself mean Sell'), a.riskNote || '');
}

// 6. Backend conflict label variant.
{
  const a = assess.assessBriefEvidence({ signal: 'Conflicting Signals' });
  eq('conflict label variant', a.label, 'Conflicting Signals');
  eq('conflict agreement', a.agreement, 'mixed');
}

// 7. Missing signal entirely → honest Insufficient Data, no fabricated Hold.
{
  const a = assess.assessBriefEvidence({
    signal: null,
    sentimentStatus: 'insufficient',
    timeframeConsensus: 'Sell',
  });
  eq('missing signal: label', a.label, 'Insufficient Data');
  ok('missing signal: limitation explains it', a.limitations.some((l) => l.includes('overall setup signal')), a.limitations.join(' | '));
  eq('missing signal: technical chip shows No data', a.chips.find((c) => c.name === 'Technical').display, 'No data');
}

// 8. Insufficient sentiment is excluded from the counts, not neutral-voted.
{
  const a = assess.assessBriefEvidence({
    signal: 'Buy',
    sentimentStatus: 'no_relevant_news',
    timeframeConsensus: 'Buy',
  });
  eq('insufficient sentiment: not counted', a.counts.total, 2);
  eq('insufficient sentiment: counts', a.counts, { bullish: 2, bearish: 0, neutral: 0, total: 2 });
  eq('insufficient sentiment: chip = No data', a.chips.find((c) => c.name === 'Sentiment').display, 'No data');
  ok('insufficient sentiment: limitation listed', a.limitations.some((l) => l.includes('no sufficient recent news')), a.limitations.join(' | '));
}

// 9. Mixed consensus is not a directional vote.
{
  const a = assess.assessBriefEvidence({
    signal: 'Buy',
    sentimentStatus: 'sufficient',
    sentimentLabel: 'Positive',
    timeframeConsensus: 'Mixed',
  });
  eq('mixed consensus: timeframe excluded', a.chips.find((c) => c.name === 'Timeframe').available, false);
  eq('mixed consensus: counts', a.counts.total, 2);
  ok('mixed consensus: limitation listed', a.limitations.some((l) => l.includes('Mixed')), a.limitations.join(' | '));
}

// 10. Raw has_conflict alone (high-risk flag on neutral aligned evidence)
//     must not force Mixed.
{
  const a = assess.assessBriefEvidence({
    signal: 'Neutral',
    evidenceState: 'neutral',
    hasConflict: true,
    riskWarning: true,
    riskLevel: 'High',
    riskScore: 68,
    sentimentStatus: 'insufficient',
    timeframeConsensus: 'Hold',
  });
  eq('high-risk neutral: not mixed by has_conflict alone', a.agreement, 'aligned');
  eq('high-risk neutral: label', a.label, 'Neutral');
}

// 11. Risk-note wording for a High-risk stock with no directional lean.
{
  const a = assess.assessBriefEvidence({
    signal: 'Neutral',
    riskLevel: 'High',
    riskScore: 77,
    sentimentStatus: 'insufficient',
    timeframeConsensus: 'Hold',
  });
  ok('neutral high risk: separate risk wording', !!a.riskNote && a.riskNote.includes('independently'), a.riskNote || '');
}

// ── deriveOutlook (forecast direction, ±0.3% flat band) ──────────────────
const fc = (prices) => ({ results: { forecast_prices: prices } });

eq('outlook: null forecast', outlook.deriveOutlook(null, 100), null);
eq('outlook: single price', outlook.deriveOutlook(fc([100]), 100), null);
{
  const o = outlook.deriveOutlook(fc([100, 101, 102]), 100);
  eq('outlook: up direction', o.direction, 'up');
  eq('outlook: horizon', o.horizonDays, 3);
  eq('outlook: last price', o.last, 102);
}
eq('outlook: +0.2% vs ref → flat', outlook.deriveOutlook(fc([100, 100.2]), 100).direction, 'flat');
eq('outlook: +0.3% boundary → flat', outlook.deriveOutlook(fc([100, 100.3]), 100).direction, 'flat');
eq('outlook: +0.4% → up', outlook.deriveOutlook(fc([100, 100.4]), 100).direction, 'up');
eq('outlook: -0.3% boundary → flat', outlook.deriveOutlook(fc([100, 99.7]), 100).direction, 'flat');
eq('outlook: -0.4% → down', outlook.deriveOutlook(fc([100, 99.6]), 100).direction, 'down');
eq('outlook: no ref price uses first step as ref', outlook.deriveOutlook(fc([200, 206]), null).direction, 'up');
eq('outlook: bad values rejected', outlook.deriveOutlook(fc([NaN, 101]), 100), null);

// ── Source consistency checks ────────────────────────────────────────────
console.log('\nsignal checks — source consistency\n');

const stockPage = read('src/app/stocks/[symbol]/StockPageClient.tsx');
ok('StockPageClient uses riskLevelFor for the risk bar', stockPage.includes('riskLevelFor(score)'));
ok('StockPageClient has no 66/33 risk bar literals', !stockPage.includes('score >= 66') && !stockPage.includes('score >= 33'));
ok('StockPageClient risk tile is 3-way tone (not !== High)', !stockPage.includes("risk_level !== 'High'"));
ok('StockPageClient sentiment tile shows No Data when insufficient', stockPage.includes("'No Data'") && stockPage.includes('sentimentAvailable'));
ok('StockPageClient uses shared sentimentTone', stockPage.includes('sentimentTone(sentimentScore)'));

const tradeConf = read('src/components/analysis/TradeConfirmation.tsx');
ok('TradeConfirmation never fabricates BUY/SELL from opportunity_score', !tradeConf.includes('opportunity_score > 65'));
ok('TradeConfirmation never shows opportunity_score as confidence %', !tradeConf.includes('opportunity_score / 100'));
ok('TradeConfirmation missing signal falls back to MIXED', tradeConf.includes("'MIXED'"));
ok('TradeConfirmation renders Confidence n/a when absent', tradeConf.includes('Confidence n/a'));
ok('TradeConfirmation trend tile uses TREND_SCORE_BANDS', tradeConf.includes('TREND_SCORE_BANDS'));

const sentimentLib = read('src/lib/sentiment.ts');
ok('sentiment lib colours via shared sentimentTone (band-driven)', sentimentLib.includes('const tone = sentimentTone(score)'));
ok('sentiment lib has no 0.1 band left', !sentimentLib.includes('score > 0.1') && !sentimentLib.includes('score < -0.1'));
ok('sentiment lib re-exports sentimentTone', sentimentLib.includes('export { sentimentTone }'));

const trendComp = read('src/components/analysis/TrendStrength.tsx');
ok('TrendStrength colours follow 60/40 bands', trendComp.includes('TREND_SCORE_BANDS.BULLISH_MIN') && trendComp.includes('TREND_SCORE_BANDS.BEARISH_MAX'));
ok('TrendStrength has no 55/45 drift left', !trendComp.includes('> 55') && !trendComp.includes('< 45'));

const briefPage = read('src/app/markets/brief/page.tsx');
ok('brief page uses assessBriefEvidence', briefPage.includes('assessBriefEvidence('));
ok('brief page no longer defaults missing signal to Hold', !briefPage.includes("signal || 'Hold'"));
ok('brief page missing-signal fallback is Insufficient Data', briefPage.includes("signal || 'Insufficient Data'"));
ok('brief page fetches forecast for Model Outlook', briefPage.includes('fetchForecast(') && briefPage.includes('Model Outlook'));
ok('brief page renders risk as an independent chip', briefPage.includes('(independent)'));
ok('brief page shows riskNote', briefPage.includes('riskNote'));
ok('brief page shows limitations', briefPage.includes('limitations'));

const stockPageMarkets = read('src/app/markets/stock/page.tsx');
ok('markets/stock sentiment trend uses shared sentimentTone', stockPageMarkets.includes('sentimentTone(sentimentScore)'));

const methodology = read('src/app/methodology/page.tsx');
ok('methodology documents brief assessment', methodology.includes('Research Brief Assessment'));
ok('methodology documents ±0.15 sentiment band', methodology.includes('±0.15'));
ok('methodology documents forecast ±0.3% flat band', methodology.includes('±0.3%'));
ok('methodology documents opportunity display bands 70/40', methodology.includes('70–100 strong'));
ok('methodology documents trend label bands 60/40', methodology.includes('Bullish above 60, Bearish below 40'));
ok('methodology documents risk bands 35/65', methodology.includes('Low below 35, Medium 35–65, High at or above 65'));

const modelOutlook = read('src/lib/model-outlook.ts');
ok('model-outlook shares FORECAST_FLAT_PCT from signal-bands', modelOutlook.includes("from './signal-bands'") && modelOutlook.includes('FORECAST_FLAT_PCT'));

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
