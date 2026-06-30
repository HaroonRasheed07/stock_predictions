import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VolatilitySummary } from '@/lib/api';
import { Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ExpectedRangeProps {
  data: VolatilitySummary['expected_range'];
  isLoading?: boolean;
}

export function ExpectedRange({ data, isLoading }: ExpectedRangeProps) {
  if (isLoading || !data) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[200px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-secondary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const { current_price, expected_high, expected_low, range_percent, atr } = data;

  return (
    <Card className="glass h-full relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent" />
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-secondary" />
          Expected Trading Range
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Daily range estimation based on Average True Range (ATR)
        </p>
      </CardHeader>
      <CardContent>
        <div className="mt-4 space-y-6">
          
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Price</p>
              <p className="text-3xl font-bold">${current_price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Daily Swing Range</p>
              <p className="text-lg font-semibold text-secondary">± {range_percent.toFixed(2)}%</p>
            </div>
          </div>

          <div className="relative pt-6 pb-2">
            {/* Visual Range Indicator */}
            <div className="absolute top-0 w-full flex justify-between text-xs font-medium">
              <span className="text-destructive flex items-center"><ArrowDownRight className="h-3 w-3 mr-1" /> ${expected_low.toFixed(2)}</span>
              <span className="text-success flex items-center">${expected_high.toFixed(2)} <ArrowUpRight className="h-3 w-3 ml-1" /></span>
            </div>
            
            <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden relative border border-border/50 mt-1">
              {/* Highlight the range between low and high */}
              <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-destructive/20 via-primary/20 to-success/20" />
            </div>
            
            {/* Current Price Marker (Centered because range is ±ATR) */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-1 h-5 bg-foreground rounded-full shadow-sm" />
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
             <span>ATR Value: ${atr.toFixed(2)}</span>
             <span>Volatility estimate, not a prediction</span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
