import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getStockInfo, getRelatedStocks, getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { getStockSnapshot, extractTechnical, rsiZone } from '@/lib/stock-snapshot';
import { isValidSymbolPath, normalizeSymbolPath } from '@/lib/ticker-routing';
import { StockSearch } from '@/components/common/StockSearch';
import { StockResearchNav, StockResearchNavFallback } from './StockResearchNav';
import { StockPageClient } from './StockPageClient';

interface PageProps {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  return getAllAllowlistedSymbols().map((symbol) => ({
    symbol: symbol.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const normalized = normalizeSymbolPath(symbol);
  if (!normalized) return {};

  const info = getStockInfo(normalized);

  // Symbols outside the SEO allowlist stay researchable but are always
  // noindexed so thin/unknown pages never compete with canonical research URLs.
  if (!info) {
    const sym = normalized.toUpperCase();
    const title = { absolute: `${sym} Stock Research — Technicals & Market Data | ${SITE_NAME}` };
    const description = `Research ${sym} with technical indicators, price data, and available market analysis on ${SITE_NAME}.`;
    const canonical = `${SITE_URL}/stocks/${normalized}`;
    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: false, follow: true },
      openGraph: {
        images: ['/icon-512.png'],
        title,
        description,
        url: canonical,
        siteName: SITE_NAME,
        type: 'website',
      },
      twitter: {
        images: ['/icon-512.png'],
        card: 'summary_large_image',
        title,
        description,
      },
    };
  }

  const displayName = info.name;
  const displaySymbol = info.symbol;
  const canonical = `${SITE_URL}/stocks/${displaySymbol.toLowerCase()}`;

  const title = { absolute: `${displaySymbol} Stock Analysis — Technical Signals, Sentiment & Forecast | ${SITE_NAME}` };
  const description = `Analyze ${displayName} (${displaySymbol}) with technical indicators, market sentiment, risk assessment, and StockVantex's model-based forecast.`;

  const snapshot = await getStockSnapshot(displaySymbol);
  const hasData = Boolean(snapshot.overview);

  return {
    title,
    description,
    alternates: { canonical },
    robots: hasData ? undefined : { index: false, follow: true },
    openGraph: {
      images: ['/icon-512.png'],
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      images: ['/icon-512.png'],
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSigned(v: number, digits = 2): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
}

function fmtUtc(unix: number): string {
  return `${new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export default async function StockPage({ params }: PageProps) {
  const { symbol } = await params;
  const normalized = normalizeSymbolPath(symbol);
  if (!normalized) notFound();

  // Canonical URLs are lowercase: /stocks/MSFT → /stocks/msft. Middleware
  // normally intercepts case-variants first (and preserves the query string);
  // this is the no-query fallback for direct renders — it must not touch
  // `searchParams` here, because that is a dynamic API and this route is ISR.
  if (symbol !== normalized) {
    permanentRedirect(`/stocks/${normalized}`);
  }

  const info = getStockInfo(normalized);
  const sym = info ? info.symbol : normalized.toUpperCase();
  const displayName = info ? info.name : sym;
  const lower = normalized;
  const url = `${SITE_URL}/stocks/${lower}`;
  const related = info ? getRelatedStocks(normalized) : [];

  const snapshot = await getStockSnapshot(sym);
  // Valid ticker outside the allowlist: researchable while the backend knows it,
  // genuine 404 when it does not, outage → degraded noindex page (never a 404).
  if (!info && snapshot.dataStatus === 'invalid-symbol') notFound();
  const ov = snapshot.overview;
  const tech = extractTechnical(ov);
  const zone = rsiZone(tech?.rsi ?? null);

  const sentiment: any = ov?.sentiment ?? null;
  const analyzed = (sentiment?.positive_count ?? 0) + (sentiment?.negative_count ?? 0);
  const hasSentiment = Boolean(sentiment) && analyzed > 0;
  const risk: any = ov?.risk ?? null;
  const trendLabel: string | null = ov?.trendStrength?.trend_label ?? null;
  const trendScore: number | null =
    typeof ov?.trendStrength?.trend_score === 'number' ? ov.trendStrength.trend_score : null;

  const fPrices: number[] = snapshot.forecast?.results?.forecast_prices ?? [];
  const fDates: string[] = snapshot.forecast?.results?.forecast_dates ?? [];
  const fAvg = fPrices.length > 0 ? fPrices.reduce((a, b) => a + b, 0) / fPrices.length : null;
  const fMin = fPrices.length > 0 ? Math.min(...fPrices) : null;
  const fMax = fPrices.length > 0 ? Math.max(...fPrices) : null;
  const lastClose = tech?.close ?? ov?.currentPrice ?? null;
  const fChangePct = fAvg !== null && lastClose ? ((fAvg - lastClose) / lastClose) * 100 : null;

  // Signal alignment — descriptive counts of factual indicator relationships (not advice).
  let bull = 0;
  let bear = 0;
  if (tech) {
    if (tech.macd !== null && tech.signalLine !== null) {
      if (tech.macd > tech.signalLine) bull++;
      else bear++;
    }
    if (tech.close !== null && tech.sma50 !== null) {
      if (tech.close > tech.sma50) bull++;
      else bear++;
    }
  }
  if (trendLabel) {
    if (/up/i.test(trendLabel)) bull++;
    else if (/down/i.test(trendLabel)) bear++;
  }
  let agreement = 'Indicator signals are currently inconclusive.';
  if (bull > 0 && bear === 0) agreement = 'The momentum indicators in this snapshot are aligned to the upside.';
  else if (bear > 0 && bull === 0) agreement = 'The momentum indicators in this snapshot are aligned to the downside.';
  else if (bull > 0 && bear > 0) agreement = 'The momentum indicators in this snapshot are mixed.';

  const faqs: Array<{ q: string; a: string }> = [];
  if (ov) {
    const chg = ov.changePercent ?? 0;
    faqs.push({
      q: `What is the current price of ${sym} stock?`,
      a: `${displayName} (${sym}) is priced at ${fmtUsd(ov.currentPrice)} in this snapshot, a change of ${fmtSigned(chg)}% versus the previous close. Market status: ${ov.marketStatus || 'unknown'}.${snapshot.updatedAt ? ` Data computed ${fmtUtc(snapshot.updatedAt)}.` : ''}`,
    });
    if (zone && tech && tech.rsi !== null) {
      faqs.push({
        q: `Is ${sym} stock overbought or oversold right now?`,
        a: `The 14-day RSI for ${sym} is ${tech.rsi.toFixed(1)}, which sits in the conventional ${zone} range (above 70 is considered overbought, below 30 oversold). RSI is one indicator and does not predict future prices.`,
      });
    }
    if (fAvg !== null && fChangePct !== null && fMin !== null && fMax !== null) {
      faqs.push({
        q: `What does the StockVantex model forecast for ${sym}?`,
        a: `Over the next ${fPrices.length} trading sessions the model projects an average price of ${fmtUsd(fAvg)} (${fmtSigned(fChangePct, 1)}% versus the latest close), with projected values ranging from ${fmtUsd(fMin)} to ${fmtUsd(fMax)}. This is a statistical estimate from historical data, not a guarantee.`,
      });
    }
    if (risk) {
      faqs.push({
        q: `How risky is ${sym} stock?`,
        a: `StockVantex rates ${sym} at ${risk.risk_level || 'unknown'} risk with a score of ${risk.risk_score ?? 0}/100. ${risk.message || ''}`.trim(),
      });
    }
  }

  const jsonLdWebPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: `${sym} Stock Analysis — ${displayName}`,
    description: `Technical indicators, news sentiment, risk assessment and model forecast snapshot for ${displayName} (${sym}).`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    ...(ov && snapshot.updatedAt
      ? { dateModified: new Date(snapshot.updatedAt * 1000).toISOString() }
      : {}),
  };

  const jsonLdBreadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Stocks', item: `${SITE_URL}/stocks` },
      { '@type': 'ListItem', position: 3, name: `${sym} — ${displayName}`, item: url },
    ],
  };

  const jsonLdFaq = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }} />
      {jsonLdFaq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />}

      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4 flex flex-wrap items-center gap-1">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/stocks" className="hover:text-primary">Stocks</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{info ? `${displayName} (${sym})` : sym}</span>
          </nav>

          <header className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              {info ? `${displayName} (${sym}) Stock Analysis` : `${sym} Stock Research`}
            </h1>
            {info && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{info.sector}</span>
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{info.industry}</span>
              </div>
            )}
            <p className="text-muted-foreground max-w-3xl mt-3">
              Live snapshot of {displayName} ({sym}) — price, technical indicators, news sentiment, risk assessment, and a model-based price forecast — from {SITE_NAME}'s multi-layer research platform. All figures below are server-rendered from the latest cached market data.
            </p>
            <div className="mt-4 max-w-md">
              <StockSearch
                label="Switch stock"
                placeholder="Switch stock — search ticker or company…"
              />
            </div>
          </header>

          <div className="mb-6 border-b border-border/40 pb-1">
            <Suspense fallback={<StockResearchNavFallback symbol={lower} />}>
              <StockResearchNav symbol={lower} />
            </Suspense>
          </div>

          {ov ? (
            <div className="space-y-6">
              <section aria-label="Price snapshot" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                  <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Price</p>
                  <p className="text-base sm:text-xl font-bold mt-1">{fmtUsd(ov.currentPrice)}</p>
                </div>
                <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                  <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Change</p>
                  <p className={`text-base sm:text-xl font-bold mt-1 ${ov.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fmtSigned(ov.changePercent)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtSigned(ov.change)} vs prev close</p>
                </div>
                <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                  <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Market</p>
                  <p className="text-base sm:text-xl font-bold mt-1">{ov.marketStatus || 'Unknown'}</p>
                </div>
                <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                  <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Trend Score</p>
                  <p className="text-base sm:text-xl font-bold mt-1">{trendScore !== null ? trendScore : 'N/A'}</p>
                  {trendLabel && <p className="text-xs text-muted-foreground mt-0.5">{trendLabel}</p>}
                </div>
              </section>

              <p className="text-xs text-muted-foreground">
                {snapshot.updatedAt
                  ? `Market data computed ${fmtUtc(snapshot.updatedAt)}${snapshot.overviewStale ? ' (served from cache while a refresh runs)' : ''}. Prices may be delayed.`
                  : 'Market data refreshed regularly and may be delayed.'}
              </p>

              <section aria-labelledby="tech-snapshot">
                <h2 id="tech-snapshot" className="text-lg font-semibold mb-3">Technical snapshot</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                    <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">RSI (14)</p>
                    <p className="text-base sm:text-xl font-bold mt-1">{tech?.rsi !== null && tech?.rsi !== undefined ? tech.rsi.toFixed(1) : 'N/A'}</p>
                    {zone && <p className="text-xs text-muted-foreground mt-0.5 capitalize">{zone}</p>}
                  </div>
                  <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                    <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">MACD</p>
                    <p className="text-base sm:text-xl font-bold mt-1">{tech?.macd !== null && tech?.macd !== undefined ? tech.macd.toFixed(2) : 'N/A'}</p>
                    {tech?.macd !== null && tech?.signalLine !== null && tech?.macd !== undefined && tech?.signalLine !== undefined && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tech.macd > tech.signalLine ? 'Above' : 'Below'} signal line ({tech.signalLine.toFixed(2)})
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                    <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">20 / 50-Day SMA</p>
                    <p className="text-base sm:text-xl font-bold mt-1">
                      {tech?.sma20 !== null && tech?.sma20 !== undefined ? fmtUsd(tech.sma20) : 'N/A'} /{' '}
                      {tech?.sma50 !== null && tech?.sma50 !== undefined ? fmtUsd(tech.sma50) : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3 sm:p-4 bg-card/50">
                    <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Price vs 50-Day</p>
                    <p className="text-base sm:text-xl font-bold mt-1">
                      {tech?.close !== null && tech?.sma50 !== null && tech?.close !== undefined && tech?.sma50 !== undefined
                        ? tech.close > tech.sma50
                          ? 'Above'
                          : 'Below'
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {zone && tech?.rsi !== null && tech?.rsi !== undefined && (
                    <li>
                      RSI of {tech.rsi.toFixed(1)} is in the {zone} range on conventional 30/70 thresholds.
                      <Link href="/learn/what-is-rsi" className="text-primary hover:underline ml-1">How RSI works</Link>
                    </li>
                  )}
                  {tech?.macd !== null && tech?.signalLine !== null && tech?.macd !== undefined && tech?.signalLine !== undefined && (
                    <li>
                      MACD ({tech.macd.toFixed(2)}) is {tech.macd > tech.signalLine ? 'above' : 'below'} its signal line ({tech.signalLine.toFixed(2)}), indicating {tech.macd > tech.signalLine ? 'positive' : 'negative'} momentum by this measure.
                      <Link href="/learn/what-is-macd" className="text-primary hover:underline ml-1">How MACD works</Link>
                    </li>
                  )}
                  {tech?.close !== null && tech?.sma50 !== null && tech?.close !== undefined && tech?.sma50 !== undefined && (
                    <li>
                      Price ({fmtUsd(tech.close)}) is {tech.close > tech.sma50 ? 'above' : 'below'} the 50-day moving average ({fmtUsd(tech.sma50)}).
                    </li>
                  )}
                  {trendLabel && (
                    <li>Composite trend model: {trendLabel}{trendScore !== null ? ` (score ${trendScore}/100).` : '.'}</li>
                  )}
                </ul>
              </section>

              <section aria-labelledby="sentiment-heading" className="rounded-xl border border-border/60 bg-card p-4">
                <h2 id="sentiment-heading" className="text-lg font-semibold mb-2">News sentiment</h2>
                {hasSentiment ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className={`font-semibold ${sentiment.sentiment_label === 'Positive' ? 'text-green-500' : sentiment.sentiment_label === 'Negative' ? 'text-red-500' : ''}`}>
                        {sentiment.sentiment_label || 'Neutral'}
                      </span>
                      <span className="text-muted-foreground">Score {sentiment.sentiment_score?.toFixed?.(2) ?? '0.00'}</span>
                      <span className="text-muted-foreground">
                        {sentiment.positive_count ?? 0} positive / {sentiment.negative_count ?? 0} negative of {analyzed} articles
                      </span>
                    </div>
                    {sentiment.market_mood && <p className="text-sm text-muted-foreground mt-2">Market mood: {sentiment.market_mood}</p>}
                    {sentiment.news_impact_summary && <p className="text-sm text-muted-foreground mt-1">{sentiment.news_impact_summary}</p>}
                    {Array.isArray(sentiment.news) && sentiment.news.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {sentiment.news.slice(0, 5).map((article: any, i: number) => (
                          <li key={i} className="text-sm">
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                              {article.title}
                            </a>
                            <span className="text-xs text-muted-foreground ml-2">
                              — {article.source}
                              {article.published_at ? `, ${new Date(article.published_at).toISOString().slice(0, 10)}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Sentiment is computed from recent news coverage.{' '}
                      <Link href="/learn/what-is-stock-sentiment" className="text-primary hover:underline">How sentiment scoring works</Link>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent news coverage has been analyzed for {sym}, so no sentiment score is shown. Scores are only published when articles are available — a score is not inferred from price action.
                  </p>
                )}
              </section>

              <section aria-labelledby="risk-heading" className="rounded-xl border border-border/60 bg-card p-4">
                <h2 id="risk-heading" className="text-lg font-semibold mb-2">Risk assessment</h2>
                {risk ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className={`font-semibold ${risk.risk_level === 'High' ? 'text-red-500' : risk.risk_level === 'Low' ? 'text-green-500' : ''}`}>
                        {risk.risk_level || 'Unknown'} risk
                      </span>
                      <span className="text-muted-foreground">Score {risk.risk_score ?? 0}/100</span>
                    </div>
                    {risk.message && <p className="text-sm text-muted-foreground mt-2">{risk.message}</p>}
                    <p className="text-xs text-muted-foreground mt-3">
                      <Link href="/learn/how-to-analyze-stock-risk" className="text-primary hover:underline">How this risk score is built</Link>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Risk assessment is temporarily unavailable for this snapshot.</p>
                )}
              </section>

              {fAvg !== null && fMin !== null && fMax !== null && fChangePct !== null && (
                <section aria-labelledby="forecast-heading" className="rounded-xl border border-border/60 bg-card p-4">
                  <h2 id="forecast-heading" className="text-lg font-semibold mb-2">Model forecast — next {fPrices.length} trading sessions</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Projected average</p>
                      <p className="text-lg font-bold">{fmtUsd(fAvg)}</p>
                      <p className={`text-xs ${fChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmtSigned(fChangePct, 1)}% vs latest close</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Projected range</p>
                      <p className="text-lg font-bold">{fmtUsd(fMin)} – {fmtUsd(fMax)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Window</p>
                      <p className="text-lg font-bold">
                        {fDates.length > 0 ? `${fDates[0]} → ${fDates[fDates.length - 1]}` : `${fPrices.length} sessions`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    LSTM/attention model output based on historical price data — an estimate, not a guaranteed outcome, and not investment advice.{' '}
                    <Link href="/learn/how-lstm-forecasting-works" className="text-primary hover:underline">How the model works</Link> ·{' '}
                    <Link href="/methodology" className="text-primary hover:underline">Methodology</Link> ·{' '}
                    <Link href="/disclaimer" className="text-primary hover:underline">Financial disclaimer</Link>
                  </p>
                </section>
              )}

              <section aria-labelledby="summary-heading" className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <h2 id="summary-heading" className="text-lg font-semibold mb-2">Research summary</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  As of {snapshot.updatedAt ? fmtUtc(snapshot.updatedAt) : 'the latest cached session'}, {displayName} ({sym}) trades at {fmtUsd(ov.currentPrice)} ({fmtSigned(ov.changePercent)}% on the session).
                  {tech?.rsi !== null && tech?.rsi !== undefined && ` The 14-day RSI reads ${tech.rsi.toFixed(1)} (${zone}).`}
                  {tech?.macd !== null && tech?.signalLine !== null && tech?.macd !== undefined && tech?.signalLine !== undefined && ` MACD is ${tech.macd > tech.signalLine ? 'above' : 'below'} its signal line.`}
                  {trendLabel && ` The trend model rates the setup ${trendLabel.toLowerCase()}.`}
                  {hasSentiment
                    ? ` News sentiment across ${analyzed} recent articles is ${sentiment.sentiment_label?.toLowerCase() || 'neutral'}.`
                    : ' No recent news coverage is available for a sentiment reading.'}
                  {risk && ` Composite risk is ${risk.risk_level?.toLowerCase() || 'unknown'} (score ${risk.risk_score ?? 0}/100).`}{' '}
                  {agreement} These observations describe current data for research purposes only and are not investment advice.
                </p>
              </section>

              {faqs.length > 0 && (
                <section aria-labelledby="faq-heading">
                  <h2 id="faq-heading" className="text-lg font-semibold mb-3">Common questions about {sym}</h2>
                  <div className="space-y-3">
                    {faqs.map((f, i) => (
                      <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                        <h3 className="font-semibold text-sm mb-1">{f.q}</h3>
                        <p className="text-sm text-muted-foreground">{f.a}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <section className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="text-lg font-semibold mb-2">Live data temporarily unavailable</h2>
              <p className="text-sm text-muted-foreground">
                The market data service did not return a current snapshot for {sym}. This page will repopulate automatically on its next refresh. Company details and research links below remain available.
              </p>
            </section>
          )}

          <div id="analysis" className="mt-8 scroll-mt-24">
            <h2 className="text-lg font-semibold mb-3">Interactive research workspace</h2>
            <Suspense
              fallback={
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
                  ))}
                </div>
              }
            >
              <StockPageClient symbol={sym} />
            </Suspense>
          </div>

          <div className="mt-8 space-y-6">
            {info ? (
              <section>
                <h2 className="text-lg font-semibold mb-3">About {displayName}</h2>
                <p className="text-sm text-muted-foreground">
                  {displayName} ({sym}) operates in the {info.sector} sector, within the {info.industry} industry. This page provides technical analysis, sentiment data, and forecasting tools to help you research {sym} as part of your broader investment analysis.{' '}
                  <Link href={`/markets/stock?ticker=${sym}`} className="text-primary hover:underline">
                    Open {sym} in the full app
                  </Link>
                  .
                </p>
              </section>
            ) : (
              <section>
                <h2 className="text-lg font-semibold mb-3">Research {sym}</h2>
                <p className="text-sm text-muted-foreground">
                  {sym} is outside the curated directory, but the analysis tools on this page work for any ticker
                  supported by the market data service.{' '}
                  <Link href={`/markets/stock?ticker=${sym}`} className="text-primary hover:underline">
                    Open {sym} in the full app
                  </Link>
                  . You can also{' '}
                  <Link href="/stocks" className="text-primary hover:underline">
                    browse the curated directory
                  </Link>
                  .
                </p>
              </section>
            )}

            {related.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Related stocks</h2>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <Link
                      key={r.symbol}
                      href={`/stocks/${r.symbol.toLowerCase()}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/20 hover:shadow-sm transition-all"
                    >
                      <span className="font-semibold">{r.symbol}</span>
                      <span className="text-muted-foreground">{r.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-3">Learn more about this analysis</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/learn/how-to-analyze-a-stock', label: 'How to analyze a stock' },
                  { href: '/learn/what-is-technical-analysis', label: 'Technical analysis basics' },
                  { href: '/learn/what-is-stock-sentiment', label: 'News sentiment explained' },
                  { href: '/learn/what-is-stock-volatility', label: 'Volatility explained' },
                  { href: '/learn', label: 'All guides' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">Analysis methodology</h2>
              <p className="text-xs text-muted-foreground">
                StockVantex combines technical indicators (RSI, MACD, moving averages, Bollinger Bands, ATR), news-based sentiment analysis, and LSTM/attention-based forecasting models to generate multi-layered stock analysis.{' '}
                <Link href="/methodology" className="text-primary hover:underline">
                  Learn about our methodology
                </Link>
                .
              </p>
            </section>

            <p className="text-xs text-muted-foreground">
              {snapshot.updatedAt
                ? `Market snapshot last computed ${fmtUtc(snapshot.updatedAt)}. `
                : 'Market data is refreshed regularly but may be delayed. '}
              This analysis is for informational purposes only and does not constitute investment advice.{' '}
              <Link href="/disclaimer" className="text-primary hover:underline">Financial disclaimer</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
