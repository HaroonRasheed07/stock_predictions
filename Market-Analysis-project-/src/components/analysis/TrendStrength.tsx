import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendStrength as TrendStrengthData } from '@/lib/api';
import { Activity, ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrendStrengthProps {
  data: TrendStrengthData;
  isLoading?: boolean;
}

export function TrendStrength({ data, isLoading }: TrendStrengthProps) {
  if (isLoading) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[200px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const { trend_score, trend_label } = data;

  // Determine colors based on score
  let colorClass = 'text-muted-foreground';
  let barColorClass = 'bg-muted';
  let Icon = Minus;

  if (trend_score > 70) {
    colorClass = 'text-success';
    barColorClass = 'bg-success';
    Icon = TrendingUp;
  } else if (trend_score > 55) {
    colorClass = 'text-success/80';
    barColorClass = 'bg-success/80';
    Icon = ArrowRight; // Up-right ideally, using ArrowRight for simplicity
  } else if (trend_score < 30) {
    colorClass = 'text-destructive';
    barColorClass = 'bg-destructive';
    Icon = TrendingDown;
  } else if (trend_score < 45) {
    colorClass = 'text-destructive/80';
    barColorClass = 'bg-destructive/80';
    Icon = ArrowRight; // Down-right ideally
  }

  return (
    <Card className="glass h-full relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Trend Strength
          </CardTitle>
          <Badge variant="outline" className={colorClass}>
            {trend_label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mt-4 flex flex-col items-center justify-center space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Simple Gauge representation */}
            <svg className="w-32 h-16" viewBox="0 0 100 50">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                className="text-muted/30"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(trend_score / 100) * 125} 125`}
                className={colorClass}
              />
            </svg>
            <div className="absolute bottom-0 flex flex-col items-center">
              <span className="text-3xl font-bold">{trend_score.toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="w-full space-y-2 mt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Strong Bearish</span>
              <span>Neutral</span>
              <span>Strong Bullish</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden flex">
              <div className="h-full bg-destructive w-1/4" />
              <div className="h-full bg-destructive/60 w-1/4" />
              <div className="h-full bg-success/60 w-1/4" />
              <div className="h-full bg-success w-1/4" />
            </div>
            <div 
              className="relative w-full h-4"
            >
               <div 
                className="absolute top-0 w-3 h-3 rotate-45 border-l-2 border-t-2 border-foreground bg-background -mt-1"
                style={{ left: `calc(${trend_score}% - 6px)` }}
               />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
