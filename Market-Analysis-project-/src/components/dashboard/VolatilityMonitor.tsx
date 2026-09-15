import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, TrendingUp, ArrowUpDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface VolatilityData {
  ticker: string;
  name: string;
  daily_volatility: number;
  weekly_volatility: number;
  atr: number;
}

interface VolatilityMonitorProps {
  data: VolatilityData[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAssetClick?: (ticker: string) => void;
}

type ViewMode = 'daily' | 'weekly' | 'atr';

export function VolatilityMonitor({ data, isLoading, onRefresh, onAssetClick }: VolatilityMonitorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  const getVolatilityColor = (value: number, mode: ViewMode) => {
    const thresholds = {
      daily: { high: 30, medium: 15 },
      weekly: { high: 25, medium: 12 },
      atr: { high: 5, medium: 2 } // ATR as percentage of price
    };
    
    const threshold = thresholds[mode];
    if (value >= threshold.high) return 'text-destructive bg-destructive/10 border-destructive/30';
    if (value >= threshold.medium) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-success bg-success/10 border-success/30';
  };

  const getVolatilityLabel = (value: number, mode: ViewMode) => {
    const thresholds = {
      daily: { high: 30, medium: 15 },
      weekly: { high: 25, medium: 12 },
      atr: { high: 5, medium: 2 }
    };
    
    const threshold = thresholds[mode];
    if (value >= threshold.high) return 'High';
    if (value >= threshold.medium) return 'Moderate';
    return 'Low';
  };

  const getSortValue = (item: VolatilityData) => {
    switch (viewMode) {
      case 'daily': return item.daily_volatility;
      case 'weekly': return item.weekly_volatility;
      case 'atr': return item.atr;
    }
  };

  const sortedData = [...data].sort((a, b) => getSortValue(b) - getSortValue(a));

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Volatility Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Volatility Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No volatility data available</p>
            <Button onClick={onRefresh} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Volatility Monitor
          </CardTitle>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Assets ranked by volatility levels
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 sm:h-9 px-2.5 sm:px-3 shrink-0 ${
              viewMode === 'daily'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => setViewMode('daily')}
          >
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Daily Vol</span>
          </button>
          <button
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 sm:h-9 px-2.5 sm:px-3 shrink-0 ${
              viewMode === 'weekly'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => setViewMode('weekly')}
          >
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Weekly Vol</span>
          </button>
          <button
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 sm:h-9 px-2.5 sm:px-3 shrink-0 ${
              viewMode === 'atr'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => setViewMode('atr')}
          >
            <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>ATR</span>
          </button>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] sm:w-[100px] text-[10px] sm:text-xs">#</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Asset</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">
                  {viewMode === 'daily' ? 'Daily %' : viewMode === 'weekly' ? 'Weekly %' : 'ATR'}
                </TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((item, index) => {
                const value = getSortValue(item);
                const colorClass = getVolatilityColor(value, viewMode);
                const label = getVolatilityLabel(value, viewMode);
                
                return (
                  <motion.tr
                    key={item.ticker}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => onAssetClick?.(item.ticker)}
                  >
                    <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3">#{index + 1}</TableCell>
                    <TableCell className="py-2 sm:py-3">
                      <div>
                        <div className="font-semibold text-xs sm:text-sm">{item.ticker}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{item.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-3">
                      <span className="font-bold text-xs sm:text-sm">{value.toFixed(2)}%</span>
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-3">
                      <Badge variant="outline" className={`${colorClass} text-[10px] sm:text-xs`}>
                        {label}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Simple bar chart visualization */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50">
          <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Distribution</h4>
          <div className="space-y-1.5 sm:space-y-2">
            {sortedData.slice(0, 5).map((item, index) => {
              const value = getSortValue(item);
              const maxValue = Math.max(...sortedData.map(getSortValue));
              const percentage = (value / maxValue) * 100;
              const colorClass = getVolatilityColor(value, viewMode);
              
              return (
                <div key={item.ticker} className="flex items-center gap-2 sm:gap-3">
                  <span className="text-[10px] sm:text-xs font-medium w-12 sm:w-16 truncate">{item.ticker}</span>
                  <div className="flex-1 h-4 sm:h-6 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      className={`h-full ${colorClass.split(' ')[1] || 'bg-primary'}`}
                    />
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium w-10 sm:w-12 text-right">{value.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}