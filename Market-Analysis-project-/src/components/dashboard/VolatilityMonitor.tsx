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
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === 'daily' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('daily')}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Daily Vol
          </Button>
          <Button
            variant={viewMode === 'weekly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('weekly')}
          >
            <Activity className="h-4 w-4 mr-2" />
            Weekly Vol
          </Button>
          <Button
            variant={viewMode === 'atr' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('atr')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            ATR
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rank</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">
                  {viewMode === 'daily' ? 'Daily Vol %' : viewMode === 'weekly' ? 'Weekly Vol %' : 'ATR'}
                </TableHead>
                <TableHead className="text-right">Level</TableHead>
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
                    <TableCell className="font-medium">#{index + 1}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{item.ticker}</div>
                        <div className="text-xs text-muted-foreground">{item.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold">{value.toFixed(2)}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={colorClass}>
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
        <div className="mt-6 pt-4 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-3">Volatility Distribution</h4>
          <div className="space-y-2">
            {sortedData.slice(0, 5).map((item, index) => {
              const value = getSortValue(item);
              const maxValue = Math.max(...sortedData.map(getSortValue));
              const percentage = (value / maxValue) * 100;
              const colorClass = getVolatilityColor(value, viewMode);
              
              return (
                <div key={item.ticker} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-16 truncate">{item.ticker}</span>
                  <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      className={`h-full ${colorClass.split(' ')[1] || 'bg-primary'}`}
                    />
                  </div>
                  <span className="text-xs font-medium w-12 text-right">{value.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}