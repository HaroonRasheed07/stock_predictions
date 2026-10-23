'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import {
  fetchMarketOverview,
  fetchCatalysts,
  fetchTimeframeDecision,
  fetchSignalEvidence,
  fetchForecast,
  fetchAssetSearch,
  DEFAULT_FORECAST_DAYS,
  type AssetInfo,
  type MarketOverviewResponse,
  type CatalystResponse,
  type TimeframeResponse,
  type SignalEvidenceResponse,
  type ForecastResponse,
} from '@/lib/api';
import { assessBriefEvidence } from '@/lib/brief-assessment';
import { deriveOutlook } from '@/lib/model-outlook';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Zap,
  BarChart3,
  AlertTriangle,
  Target,
  History,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Eye,
  HelpCircle,
  Compass,
  Newspaper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSentimentScoreColorClass, formatSentimentLabel, getSentimentBadgeClass } from '@/lib/sentiment';
import { TickerLogo } from '@/components/common/TickerLogo';
import { WatchlistButton } from '@/components/common/WatchlistButton';
import dynamic from 'next/dynamic';

const MiniChart = dynamic(() => import('recharts').then((mod) => {
  const { LineChart, Line, ResponsiveContainer } = mod;
  return function MiniChart({ data }: { data: number[] }) {
    if (!data || data.length < 2) return <div className="h-10 w-full" />;
    return (
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={data.map((v, i) => ({ i, v }))}>
          <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };
}), { ssr: false });

// ─── Signal Badge ──────────────────────────────────────────────────────────
function SignalBadge({ signal, score }: { signal: string; score?: number }) {
  const config: Record<string, { bg: string; icon: any }> = {
    'Strong Buy': { bg: 'bg-success/10 border-success/20 text-success', icon: TrendingUp },
    'Buy': { bg: 'bg-success/8 border-success/15 text-success', icon: TrendingUp },
    'Hold': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus },
    'Neutral': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: Minus },
    'Mixed Evidence': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: AlertTriangle },
    'Conflicting Signals': { bg: 'bg-warning/10 border-warning/20 text-warning', icon: AlertTriangle },
    'Insufficient Data': { bg: 'bg-muted/50 border-border/60 text-muted-foreground', icon: AlertTriangle },
    'Sell': { bg: 'bg-destructive/8 border-destructive/15 text-destructive', icon: TrendingDown },
    'Strong Sell': { bg: 'bg-destructive/10 border-destructive/20 text-destructive', icon: TrendingDown },
  };
  const c = config[signal] || config['Insufficient Data'];
  const Icon = c.icon;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5', c.bg)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-sm font-semibold">{signal}</span>
      {score !== undefined && (
        <span className="text-xs font-medium opacity-80" title="Setup ranking score (not a probability of profit)">Setup: {score}/100</span>
      )}
    </div>
  );
}

// ─── Timeframe Card ────────────────────────────────────────────────────────
function TimeframeCard({ label, signal, confidence }: { label: string; signal: string; confidence: number }) {
  const signalColor: Record<string, string> = {
    'Buy': 'text-success',
    'Sell': 'text-destructive',
    'Hold': 'text-warning',
  };
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-semibold', signalColor[signal] || 'text-muted-foreground')}>
          {signal}
        </span>
        <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full', signal === 'Buy' ? 'bg-success' : signal === 'Sell' ? 'bg-destructive' : 'bg-warning')}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Expandable Section ────────────────────────────────────────────────────
function ExpandableSection({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border/40">{children}</div>}
    </div>
  );
}

// ─── Search Component ──────────────────────────────────────────────────────
function StockSearch({ onSelect }: { onSelect: (ticker: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchAssetSearch(q);
        setResults(data.slice(0, 8));
        setShowResults(true);
      } catch { setResults([]); }
    }, 300);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search ticker or company..."
            className="pl-9 h-10 text-sm bg-background border-border/60"
            onFocus={() => results.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
        </div>
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.ticker}
              onClick={() => { onSelect(r.ticker); setQuery(''); setShowResults(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <TickerLogo ticker={r.ticker} size="sm" />
              <div>
                <p className="text-sm font-medium">{r.ticker}</p>
                <p className="text-xs text-muted-foreground truncate">{r.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Stock Brief Page ─────────────────────────────────────────────────
export default function StockBriefPage() {
  const router = useRouter();
  const { selectedTicker, setSelectedTicker } = useStockStore();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const [timeframe, setTimeframe] = useState<string>('swing');

  const ticker = selectedTicker || 'AAPL';

  const { data: overview, isLoading: overviewLoading } = useQuery<MarketOverviewResponse>({
    queryKey: ['market-overview', ticker, '1y'],
    queryFn: () => fetchMarketOverview(ticker, '1y'),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: catalysts } = useQuery<CatalystResponse>({
    queryKey: ['catalysts', ticker],
    queryFn: () => fetchCatalysts(ticker),
    staleTime: 300000,
  });

  const { data: timeframes } = useQuery<TimeframeResponse>({
    queryKey: ['timeframe', ticker, '1y'],
    queryFn: () => fetchTimeframeDecision(ticker, '1y'),
    staleTime: 300000,
  });

  const { data: evidence, isLoading: evidenceLoading, error: evidenceError } = useQuery<SignalEvidenceResponse>({
    queryKey: ['signal-evidence', ticker, '1y'],
    queryFn: () => fetchSignalEvidence(ticker, '1y'),
    staleTime: 600000,
    retry: 1,
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery<ForecastResponse | null>({
    queryKey: ['forecast', ticker, 'brief'],
    queryFn: () => fetchForecast(ticker, DEFAULT_FORECAST_DAYS, '1y'),
    staleTime: 600000,
    retry: 1,
  });

  const tradeConfirmation = overview?.tradeConfirmation;
  const sentiment = overview?.sentiment;
  const risk = overview?.risk;
  const tf = timeframes?.timeframes?.[timeframe];

  const whyReasons = useMemo(() => {
    if (!tradeConfirmation?.components) return [];
    return tradeConfirmation.components
      .filter((c: any) => c.signal !== 'neutral')
      .sort((a: any, b: any) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 4)
      .map((c: any) => ({
        label: c.name,
        detail: c.detail,
        signal: c.signal,
      }));
  }, [tradeConfirmation]);

  // ── Overall Assessment & Signal Agreement ──────────────────────────────
  const overallAssessment = useMemo(() => {
    if (!tradeConfirmation) return null;
    return assessBriefEvidence({
      signal: tradeConfirmation.signal,
      evidenceState: tradeConfirmation.evidence_state,
      hasConflict: tradeConfirmation.conflict_details?.has_conflict,
      conflictExplanation: tradeConfirmation.conflict_details?.explanation,
      riskWarning: tradeConfirmation.conflict_details?.risk_warning,
      sentimentStatus: sentiment?.status,
      sentimentLabel: sentiment?.status === 'sufficient' ? sentiment.sentiment_label : null,
      timeframeConsensus: timeframes?.consensus,
      riskLevel: risk?.risk_level,
      riskScore: risk?.risk_score,
    });
  }, [tradeConfirmation, timeframes, sentiment, risk]);

  const outlook = useMemo(
    () => deriveOutlook(forecast, overview?.currentPrice),
    [forecast, overview?.currentPrice]
  );

  const investigateNext = useMemo(() => {
    const items: Array<{ icon: any; title: string; description: string }> = [];
    if (sentiment?.status === 'insufficient' || sentiment?.status === 'no_relevant_news') {
      items.push({
        icon: Newspaper,
        title: 'Check news coverage',
        description: 'Sentiment data is limited. Review recent news articles to understand the current narrative.',
      });
    }
    if (risk?.risk_level === 'High') {
      items.push({
        icon: Shield,
        title: 'Review risk factors',
        description: 'This stock has elevated risk. Check volatility, drawdown, and factor breakdowns before deciding.',
      });
    }
    if (overallAssessment?.agreement === 'diverging' || overallAssessment?.agreement === 'mixed') {
      items.push({
        icon: HelpCircle,
        title: 'Investigate signal disagreement',
        description: 'Technical, sentiment, and timeframe signals are not aligned. This often indicates a stock at a turning point or with conflicting catalysts.',
      });
    }
    if (evidence && evidence.overall_accuracy < 0.55) {
      items.push({
        icon: History,
        title: 'Low historical accuracy',
        description: 'Past signals for this stock have been less reliable. Consider the broader context before acting on any single indicator.',
      });
    }
    if (catalysts?.catalysts && catalysts.catalysts.length > 0) {
      items.push({
        icon: Target,
        title: 'Review active catalysts',
        description: `${catalysts.catalysts.length} catalyst${catalysts.catalysts.length > 1 ? 's' : ''} detected. Events like earnings or product launches can override technical signals.`,
      });
    }
    if (items.length === 0) {
      items.push({
        icon: Compass,
        title: 'Compare across timeframes',
        description: 'Switch between short-term, swing, and position views to see how the outlook changes over different horizons.',
      });
    }
    return items.slice(0, 4);
  }, [sentiment, risk, overallAssessment, evidence, catalysts]);

  const showData = overview && !overviewLoading;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Search */}
      <StockSearch onSelect={(t) => { setSelectedTicker(t); }} />

      {/* Stock Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TickerLogo ticker={ticker} size="lg" />
          <div>
            <h1 className="text-xl font-bold">{ticker}</h1>
            <p className="text-sm text-muted-foreground">{overview?.ticker || ticker}</p>
          </div>
        </div>
        <WatchlistButton ticker={ticker} />
      </div>

      {/* Price + Signal */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            {overviewLoading ? '—' : `$${overview?.currentPrice?.toFixed(2) || '—'}`}
          </p>
          {!overviewLoading && overview?.change !== undefined && overview.change !== 0 && (
            <div className={cn('flex items-center gap-1 text-sm font-medium', overview.change > 0 ? 'text-success' : 'text-destructive')}>
              {overview.change > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {overview.change > 0 ? '+' : ''}{overview.change.toFixed(2)} ({overview.changePercent?.toFixed(2)}%)
            </div>
          )}
        </div>
        {tradeConfirmation && (
          <SignalBadge
            signal={tradeConfirmation.signal || 'Insufficient Data'}
            score={tradeConfirmation.opportunity_score}
          />
        )}
      </div>

      {/* Overall Assessment */}
      {showData && overallAssessment && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Overall Assessment</span>
          </div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={cn('text-2xl font-bold', overallAssessment.colorClass)}>
              {overallAssessment.label}
            </span>
            {overallAssessment.timeframeConsensus && (
              <span className="text-xs text-muted-foreground">
                Timeframe consensus: <span className="font-medium">{overallAssessment.timeframeConsensus}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {overallAssessment.chips.map((s) => (
              <div key={s.name} className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1',
                !s.available ? 'border-border/40 bg-muted/30 text-muted-foreground' :
                s.direction === 'bullish' ? 'border-success/20 bg-success/5 text-success' :
                s.direction === 'bearish' ? 'border-destructive/20 bg-destructive/5 text-destructive' :
                'border-warning/20 bg-warning/5 text-warning'
              )}>
                <span className="font-medium">{s.name}:</span>
                <span className="capitalize">{!s.available ? 'No data' : s.display}</span>
              </div>
            ))}
            {risk && (
              <div
                title="Risk is assessed independently of the directional evidence and is never converted into a Buy or Sell label"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1',
                  risk.risk_level === 'High' ? 'border-destructive/40 bg-destructive/5 text-destructive' :
                  risk.risk_level === 'Low' ? 'border-success/40 bg-success/5 text-success' :
                  'border-warning/40 bg-warning/5 text-warning'
                )}
              >
                <span className="font-medium">Risk: {risk.risk_level || 'Unknown'}</span>
                <span className="opacity-70">(independent)</span>
              </div>
            )}
          </div>
          {overallAssessment.riskNote && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-3">{overallAssessment.riskNote}</p>
          )}
          {overallAssessment.limitations.length > 0 && (
            <ul className="mt-2 space-y-1">
              {overallAssessment.limitations.map((l) => (
                <li key={l} className="text-[11px] text-muted-foreground leading-relaxed">• {l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Signal Disagreement Explanation */}
      {showData && overallAssessment && (overallAssessment.agreement === 'mixed' || overallAssessment.agreement === 'diverging' || overallAssessment.hasConflict) && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning mb-1">
                Signals are {overallAssessment.agreement === 'diverging' ? 'diverging' : 'mixed'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {overallAssessment.conflictExplanation
                  ? overallAssessment.conflictExplanation
                  : `Some indicators lean bullish (${overallAssessment.counts.bullish}) while others lean bearish (${overallAssessment.counts.bearish}). Each signal uses different data over different time horizons, so divergence is expected and informative.`}
                {' '}Consider the timeframe that matches your research horizon and do not interpret this as a unanimous conclusion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeframe Selector */}
      {!overviewLoading && timeframes && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeframe View</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'short_term', label: '1-5D' },
              { key: 'swing', label: '1-4W' },
              { key: 'position', label: '1-3M' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTimeframe(t.key)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-center transition-all duration-150',
                  timeframe === t.key
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/30'
                )}
              >
                <p className="text-xs font-medium">{t.label}</p>
                <p className={cn(
                  'text-sm font-semibold mt-0.5',
                  timeframes.timeframes?.[t.key]?.signal === 'Buy' ? 'text-success' :
                  timeframes.timeframes?.[t.key]?.signal === 'Sell' ? 'text-destructive' : 'text-warning'
                )}>
                  {timeframes.timeframes?.[t.key]?.signal || '—'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Why? */}
      {!overviewLoading && whyReasons.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Why This Signal?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {whyReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={cn(
                  'mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0',
                  r.signal === 'buy' ? 'bg-success' : 'bg-destructive'
                )} />
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Catalyst + Risk Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Catalyst */}
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Catalyst</span>
          </div>
          {catalysts?.catalysts && catalysts.catalysts.length > 0 ? (
            <div>
              <p className="text-xs font-medium capitalize">{catalysts.catalysts[0].type.replace(/_/g, ' ')}</p>
              <p className={cn(
                'text-xs mt-0.5',
                catalysts.catalysts[0].impact === 'positive' ? 'text-success' :
                catalysts.catalysts[0].impact === 'negative' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {catalysts.catalysts[0].impact}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">None detected</p>
          )}
        </div>

        {/* Risk */}
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Risk</span>
          </div>
          {risk ? (
            <div>
              <p className={cn(
                'text-xs font-medium',
                risk.risk_level === 'High' ? 'text-destructive' :
                risk.risk_level === 'Low' ? 'text-success' : 'text-warning'
              )}>
                {risk.risk_level}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{risk.risk_score?.toFixed(0)}/100</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-2">
        {/* Timeframe Detail */}
        {!overviewLoading && tf && (
          <ExpandableSection title={`${tf.label} Analysis`} icon={Clock} defaultOpen>
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Signal</span>
                <span className={cn(
                  'text-sm font-semibold',
                  tf.signal === 'Buy' ? 'text-success' : tf.signal === 'Sell' ? 'text-destructive' : 'text-warning'
                )}>
                  {tf.signal} ({(tf.confidence * 100).toFixed(0)}% confidence)
                </span>
              </div>
              {tf.components && tf.components.length > 0 && (
                <div className="space-y-1.5">
                  {tf.components.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{c.name}</span>
                      <span className={cn(
                        'font-medium',
                        c.signal === 'buy' ? 'text-success' : c.signal === 'sell' ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {c.signal} ({(c.strength * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {tf.rationale && (
                <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">{tf.rationale}</p>
              )}
            </div>
          </ExpandableSection>
        )}

        {/* Sentiment */}
        <ExpandableSection title="Sentiment" icon={BarChart3}>
          <div className="space-y-2 pt-3">
            {sentiment ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Market Mood</span>
                  <Badge variant="secondary" className={cn('text-xs', getSentimentBadgeClass(sentiment.sentiment_label || '', sentiment.status))}>
                    {formatSentimentLabel(sentiment.sentiment_label || '', sentiment.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Score</span>
                  <span className={cn('text-sm font-semibold', getSentimentScoreColorClass(sentiment.sentiment_score || 0))}>
                    {sentiment.status === 'insufficient' ? '—' : sentiment.sentiment_score?.toFixed(2)}
                  </span>
                </div>
                {sentiment.news_impact_summary && (
                  <p className="text-xs text-muted-foreground">{sentiment.news_impact_summary}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No sentiment data</p>
            )}
          </div>
        </ExpandableSection>

        {/* Model Outlook */}
        <ExpandableSection title="Model Outlook" icon={TrendingUp}>
          <div className="space-y-2 pt-3">
            {outlook ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Direction (next {outlook.horizonDays} trading days)</span>
                  <span className={cn('text-sm font-semibold', outlook.direction === 'up' ? 'text-success' : outlook.direction === 'down' ? 'text-destructive' : 'text-warning')}>
                    {outlook.direction === 'up' ? 'Upward' : outlook.direction === 'down' ? 'Downward' : 'Flat'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model path</span>
                  <span className="text-sm font-semibold tabular-nums">
                    ${outlook.first.toFixed(2)} → ${outlook.last.toFixed(2)}{' '}
                    {(() => {
                      const ref = overview?.currentPrice && overview.currentPrice > 0 ? overview.currentPrice : outlook.first;
                      const pct = ((outlook.last - ref) / ref) * 100;
                      return <span className={pct > 0 ? 'text-success' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>;
                    })()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                  Point estimates only — the model provides no confidence intervals, so the spread around this path is unknown. This is the model's own projection, not a recommendation. Methodology explains how it is produced.
                </p>
              </>
            ) : forecastLoading ? (
              <p className="text-xs text-muted-foreground">Loading model outlook…</p>
            ) : (
              <p className="text-xs text-muted-foreground">Model outlook unavailable for this ticker.</p>
            )}
          </div>
        </ExpandableSection>

        {/* Signal Evidence */}
        <ExpandableSection title="Historical Evidence" icon={History}>
          <div className="space-y-2 pt-3">
            {evidenceLoading ? (
              <p className="text-xs text-muted-foreground">Analyzing historical patterns…</p>
            ) : evidence ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overall Accuracy</span>
                  <span className="text-sm font-semibold">{(evidence.overall_accuracy * 100).toFixed(1)}%</span>
                </div>
                <Badge variant="secondary" className="text-xs">{evidence.evidence_label} Evidence</Badge>
                {evidence.indicators && Object.entries(evidence.indicators).map(([key, ind]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground uppercase">{key}</span>
                    <span className="font-medium">{(ind.accuracy * 100).toFixed(0)}% ({ind.sample_size} signals)</span>
                  </div>
                ))}
              </>
            ) : evidenceError ? (
              <p className="text-xs text-muted-foreground">Historical analysis is temporarily unavailable.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Not enough historical data for this analysis.</p>
            )}
          </div>
        </ExpandableSection>

        {/* Catalysts */}
        <ExpandableSection title="Catalysts" icon={Target}>
          <div className="space-y-2 pt-3">
            {catalysts?.catalysts && catalysts.catalysts.length > 0 ? (
              catalysts.catalysts.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0',
                    c.impact === 'positive' ? 'bg-success' : c.impact === 'negative' ? 'bg-destructive' : 'bg-muted-foreground'
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{c.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No major catalysts detected</p>
            )}
          </div>
        </ExpandableSection>

        {/* Risk Detail */}
        <ExpandableSection title="Risk Assessment" icon={AlertTriangle}>
          <div className="space-y-2 pt-3">
            {risk?.factors && risk.factors.length > 0 ? (
              risk.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.name}</span>
                  <span className={cn(
                    'font-medium',
                    f.level === 'High' ? 'text-destructive' : f.level === 'Low' ? 'text-success' : 'text-warning'
                  )}>
                    {f.value}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No risk data</p>
            )}
          </div>
        </ExpandableSection>
      </div>

      {/* What to Investigate Next */}
      {showData && investigateNext.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">What to Investigate Next</span>
          </div>
          <div className="space-y-3">
            {investigateNext.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Disclaimer */}
      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This Research Brief is an evidence aggregation, not a recommendation. Each signal comes from a different data source and methodology. Data refreshes periodically — check timestamps on individual sections for freshness.
          </p>
        </div>
      </div>

      {/* Bottom spacer for mobile nav */}
      <div className="h-8" />
    </div>
  );
}
