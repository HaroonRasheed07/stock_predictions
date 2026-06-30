import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TradeConfirmation as TradeConfirmationData } from '@/lib/api';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, Activity, Minus, BrainCircuit } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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

  const { opportunity_score, trend, technicals, risk, volatility, sentiment, relative_volume } = data;

  // Determine overall verdict
  let verdict = 'Neutral';
  let verdictColor = 'text-muted-foreground';
  let verdictBg = 'bg-muted/20';
  let VerdictIcon = MinusCircle;

  if (opportunity_score > 70 && trend.score > 60 && risk.level !== 'High') {
    verdict = 'Strong Buy Signal';
    verdictColor = 'text-success';
    verdictBg = 'bg-success/10';
    VerdictIcon = CheckCircle2;
  } else if (opportunity_score > 55) {
    verdict = 'Weak Buy Signal';
    verdictColor = 'text-success/80';
    verdictBg = 'bg-success/5';
    VerdictIcon = CheckCircle2;
  } else if (opportunity_score < 30 && trend.score < 40) {
    verdict = 'Strong Sell Signal';
    verdictColor = 'text-destructive';
    verdictBg = 'bg-destructive/10';
    VerdictIcon = XCircle;
  } else if (opportunity_score < 45) {
    verdict = 'Weak Sell Signal';
    verdictColor = 'text-destructive/80';
    verdictBg = 'bg-destructive/5';
    VerdictIcon = XCircle;
  }

  return (
    <Card className="glass h-full relative overflow-hidden flex flex-col">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${verdictBg} via-transparent to-transparent`} />
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              Trade Confirmation
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Consolidated signal analysis</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold">{opportunity_score.toFixed(0)}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Verdict Banner */}
        <div className={`rounded-lg border border-border/50 p-4 flex items-center gap-4 mb-6 ${verdictBg}`}>
          <VerdictIcon className={`h-10 w-10 ${verdictColor}`} />
          <div>
            <h3 className={`text-lg font-bold ${verdictColor}`}>{verdict}</h3>
            <p className="text-sm text-muted-foreground">Based on {data.name}'s current technical and risk profile.</p>
          </div>
        </div>

        {/* Factors Breakdown */}
        <div className="space-y-4 flex-1">
          <h4 className="text-sm font-semibold border-b border-border/50 pb-2">Analysis Breakdown</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trend */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${trend.score > 50 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {trend.score > 50 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trend Strength</p>
                <p className="text-sm font-medium">{trend.label}</p>
              </div>
            </div>

            {/* Momentum / MACD */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${technicals.macd_signal === 'Bullish' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MACD Signal</p>
                <p className="text-sm font-medium">{technicals.macd_signal}</p>
              </div>
            </div>

            {/* Risk */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${risk.level === 'Low' ? 'bg-success/20 text-success' : risk.level === 'High' ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-500'}`}>
                {risk.level === 'Low' ? <ShieldCheck className="h-4 w-4" /> : risk.level === 'High' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risk Profile</p>
                <p className="text-sm font-medium">{risk.level}</p>
              </div>
            </div>

            {/* Sentiment (if available) */}
            {sentiment && (
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${sentiment.score > 0 ? 'bg-success/20 text-success' : sentiment.score < 0 ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                  {sentiment.score > 0 ? <TrendingUp className="h-4 w-4" /> : sentiment.score < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sentiment</p>
                  <p className="text-sm font-medium">{sentiment.label}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Confidence Score</span>
            <span className="text-sm font-medium">{opportunity_score.toFixed(0)}%</span>
          </div>
          <Progress value={opportunity_score} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
