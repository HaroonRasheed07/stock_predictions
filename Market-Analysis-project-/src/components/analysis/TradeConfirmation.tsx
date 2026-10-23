import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TradeConfirmation as TradeConfirmationData } from '@/lib/api';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Minus,
  BrainCircuit,
  Scale
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TREND_SCORE_BANDS } from '@/lib/signal-bands';
import { sentimentTone } from '@/lib/sentiment';

interface TradeConfirmationProps {
  data: TradeConfirmationData | null;
  isLoading?: boolean;
}

export function TradeConfirmation({ data, isLoading }: TradeConfirmationProps) {
  if (isLoading || !data) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[400px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const {
    signal,
    score,
    confidence,
    components,
    rationale,
    opportunity_score,
    trend,
    technicals,
    risk,
    volatility,
    sentiment,
  } = data;

  // Determine overall verdict presentation based on backend signal. When the
  // backend provides no signal we show Mixed Evidence rather than inventing a
  // direction from the opportunity score (that score is a rank, not a vote).
  const normalizedSignal = signal?.toUpperCase() || 'MIXED';

  let verdict = 'Neutral (Hold)';
  let verdictColor = 'text-warning';
  let verdictBg = 'bg-warning/10';
  let VerdictIcon = MinusCircle;

  if (normalizedSignal.includes('BUY')) {
    verdict = signal || 'Buy Signal';
    verdictColor = 'text-success';
    verdictBg = 'bg-success/10';
    VerdictIcon = CheckCircle2;
  } else if (normalizedSignal.includes('SELL')) {
    verdict = signal || 'Sell Signal';
    verdictColor = 'text-destructive';
    verdictBg = 'bg-destructive/10';
    VerdictIcon = XCircle;
  } else if (normalizedSignal.includes('MIXED') || normalizedSignal.includes('CONFLICT')) {
    verdict = signal || 'Mixed Evidence';
    verdictColor = 'text-warning';
    verdictBg = 'bg-warning/10';
    VerdictIcon = AlertTriangle;
  } else {
    verdict = signal || 'Hold / Neutral';
    verdictColor = 'text-warning';
    verdictBg = 'bg-warning/10';
    VerdictIcon = MinusCircle;
  }

  // Confidence comes only from the backend's own confidence field. The setup
  // score is a different quantity and is never presented as a confidence %.
  const confidenceAvailable = confidence !== undefined && confidence !== null && isFinite(confidence);
  const confidencePct = confidenceAvailable ? Math.round(confidence * 100) : null;

  return (
    <Card className="glass h-full relative overflow-hidden flex flex-col">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${verdictBg} via-transparent to-transparent opacity-60`} />
      
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              Trade Confirmation
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Multi-factor quantitative confirmation</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold">{opportunity_score.toFixed(0)}</span>
            <span className="text-xs text-muted-foreground" title="Setup ranking score (not a probability of profit)">/100 Setup Score</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-5">
        {/* Verdict Banner */}
        <div className={`rounded-xl border border-border/50 p-4 flex items-start gap-4 ${verdictBg}`}>
          <VerdictIcon className={`h-8 w-8 shrink-0 mt-0.5 ${verdictColor}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className={`text-lg font-bold ${verdictColor}`}>{verdict}</h3>
              <Badge variant="outline" className="text-xs font-medium">
                {confidencePct !== null ? `${confidencePct}% Confidence` : 'Confidence n/a'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {rationale || `Consolidated signal for ${data.name || data.ticker} across technicals, risk, and momentum.`}
            </p>
          </div>
        </div>

        {/* Conflict Callout if present */}
        {data.conflict_details?.has_conflict && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning">Divergent Indicators Detected</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">{data.conflict_details.explanation}</p>
            </div>
          </div>
        )}

        {/* Factors Breakdown */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Factor Attribution
            </h4>
            <span className="text-[11px] text-muted-foreground">Weight & Direction</span>
          </div>

          {components && components.length > 0 ? (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {components.map((comp) => {
                const isBuy = comp.signal === 'buy';
                const isSell = comp.signal === 'sell';
                const badgeColor = isBuy
                  ? 'border-success/30 bg-success/10 text-success'
                  : isSell
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-border/60 bg-muted/30 text-muted-foreground';

                return (
                  <div
                    key={comp.name}
                    className="p-3 rounded-lg border border-border/50 bg-card/60 hover:bg-card transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-foreground">{comp.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {(comp.weight * 100).toFixed(0)}% wt
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                          {comp.signal.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      {comp.detail} &mdash; <span className="text-foreground/80">{comp.rationale}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fallback 4-factor grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Trend */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/60">
                <div className={`p-2 rounded-md ${
                  trend?.score >= TREND_SCORE_BANDS.BULLISH_MIN ? 'bg-success/20 text-success' :
                  trend?.score <= TREND_SCORE_BANDS.BEARISH_MAX ? 'bg-destructive/20 text-destructive' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {trend?.score >= TREND_SCORE_BANDS.BULLISH_MIN ? <TrendingUp className="h-4 w-4" /> :
                   trend?.score <= TREND_SCORE_BANDS.BEARISH_MAX ? <TrendingDown className="h-4 w-4" /> :
                   <Minus className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Trend Strength</p>
                  <p className="text-xs font-semibold">{trend?.label || 'Neutral'} ({trend?.score?.toFixed(0) ?? '—'})</p>
                </div>
              </div>

              {/* Momentum / MACD */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/60">
                <div className={`p-2 rounded-md ${technicals?.macd_signal === 'Bullish' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">MACD Signal</p>
                  <p className="text-xs font-semibold">{technicals?.macd_signal || 'Neutral'}</p>
                </div>
              </div>

              {/* Risk */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/60">
                <div className={`p-2 rounded-md ${risk?.level === 'Low' ? 'bg-success/20 text-success' : risk?.level === 'High' ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-500'}`}>
                  {risk?.level === 'Low' ? <ShieldCheck className="h-4 w-4" /> : risk?.level === 'High' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Risk Profile</p>
                  <p className="text-xs font-semibold">{risk?.level || 'Moderate'} ({risk?.score?.toFixed(0) ?? '—'})</p>
                </div>
              </div>

              {/* Sentiment */}
              {sentiment && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/60">
                  <div className={`p-2 rounded-md ${
                    sentimentTone(sentiment.score) === 'bullish' ? 'bg-success/20 text-success' :
                    sentimentTone(sentiment.score) === 'bearish' ? 'bg-destructive/20 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {sentimentTone(sentiment.score) === 'bullish' ? <TrendingUp className="h-4 w-4" /> :
                     sentimentTone(sentiment.score) === 'bearish' ? <TrendingDown className="h-4 w-4" /> :
                     <Minus className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Sentiment</p>
                    <p className="text-xs font-semibold">{sentiment.label || 'Neutral'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confidence Progress Meter (only when the backend provides confidence) */}
        {confidencePct !== null && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-primary" />
                Signal Confidence
              </span>
              <span className="font-semibold">{confidencePct}%</span>
            </div>
            <Progress value={confidencePct} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
