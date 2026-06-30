import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskAssessment } from '@/lib/api';
import { ShieldAlert, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface RiskOverviewProps {
  data: RiskAssessment | null;
  isLoading?: boolean;
}

export function RiskOverview({ data, isLoading }: RiskOverviewProps) {
  if (isLoading || !data) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[250px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-orange-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const { risk_level, risk_score, message, factors } = data;

  let Icon = ShieldAlert;
  let colorClass = 'text-yellow-500';
  let bgClass = 'bg-yellow-500/10';
  let borderClass = 'border-yellow-500/30';

  if (risk_level === 'Low') {
    Icon = ShieldCheck;
    colorClass = 'text-success';
    bgClass = 'bg-success/10';
    borderClass = 'border-success/30';
  } else if (risk_level === 'High') {
    Icon = AlertTriangle;
    colorClass = 'text-destructive';
    bgClass = 'bg-destructive/10';
    borderClass = 'border-destructive/30';
  }

  return (
    <Card className={`glass h-full border-t-4 ${borderClass} relative overflow-hidden`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${bgClass} via-transparent to-transparent`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon className={`h-5 w-5 ${colorClass}`} />
              Risk Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Overall Profile</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${colorClass}`}>{risk_level}</span>
            <p className="text-xs text-muted-foreground mt-1">Score: {risk_score}/100</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium mb-4">{message}</p>
        
        <div className="space-y-4">
          {factors.map((factor, idx) => {
            const factorScore = factor.level === 'High' ? 85 : factor.level === 'Medium' ? 50 : 15;
            let barColor = 'bg-yellow-500';
            if (factor.level === 'Low') barColor = 'bg-success';
            if (factor.level === 'High') barColor = 'bg-destructive';

            // Exception for Trend Stability: High stability is low risk.
            if (factor.name === 'Trend Stability') {
              if (factor.level === 'Strong') barColor = 'bg-success';
              else if (factor.level === 'Weak') barColor = 'bg-destructive';
            }

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1">
                    {factor.name}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px] text-xs">{factor.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-medium text-xs bg-muted px-2 py-0.5 rounded">{factor.value}</span>
                </div>
                <Progress value={factorScore} className="h-1.5" indicatorClassName={barColor} />
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 text-[10px] text-muted-foreground/60 text-center uppercase tracking-wider">
          For informational purposes only • Not financial advice
        </div>
      </CardContent>
    </Card>
  );
}
