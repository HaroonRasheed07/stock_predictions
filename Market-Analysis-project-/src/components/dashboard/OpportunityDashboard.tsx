import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OpportunityScore } from '@/lib/api';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface OpportunityDashboardProps {
  data: OpportunityScore[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAssetClick?: (ticker: string) => void;
}

export function OpportunityDashboard({ data, isLoading, onRefresh, onAssetClick }: OpportunityDashboardProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (ticker: string) => {
    setExpandedRow(expandedRow === ticker ? null : ticker);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success bg-success/10 border-success/30';
    if (score >= 40) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-destructive bg-destructive/10 border-destructive/30';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'High Opportunity';
    if (score >= 40) return 'Moderate';
    return 'Low Opportunity';
  };

  const getAssetClassIcon = (assetClass: string) => {
    switch (assetClass) {
      case 'forex': return '💱';
      case 'commodity': return '🪙';
      case 'index': return '📊';
      case 'etf': return '📈';
      default: return '🏢';
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Opportunity Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
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
            <Star className="h-5 w-5 text-primary" />
            Opportunity Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No opportunity data available</p>
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
            <Star className="h-5 w-5 text-primary" />
            Opportunity Discovery
          </CardTitle>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Assets ranked by opportunity score (0-100)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, index) => {
            const isExpanded = expandedRow === item.ticker;
            const scoreColorClass = getScoreColor(item.score);
            
            return (
              <motion.div
                key={item.ticker}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    isExpanded ? 'bg-primary/5 border-primary/30' : 'bg-card/50 border-border/50'
                  }`}
                  onClick={() => toggleRow(item.ticker)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                      <span className="text-xl">{getAssetClassIcon(item.asset_class)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.ticker}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.asset_class}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">${item.price.toFixed(2)}</p>
                        <p className={`text-sm font-medium ${item.change_percent >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {item.change_percent >= 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                        </p>
                      </div>
                      
                      <div className={`px-4 py-2 rounded-lg border-2 text-center min-w-[100px] ${scoreColorClass}`}>
                        <p className="text-2xl font-bold">{item.score.toFixed(0)}</p>
                        <p className="text-xs font-medium uppercase tracking-wider">{getScoreLabel(item.score)}</p>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-border/50"
                    >
                      <h4 className="text-sm font-semibold mb-3">Contributing Factors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.factors.map((factor, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex items-center gap-2">
                              {factor.impact > 0 ? (
                                <TrendingUp className="h-4 w-4 text-success" />
                              ) : factor.impact < 0 ? (
                                <TrendingDown className="h-4 w-4 text-destructive" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{factor.name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{factor.value}</p>
                              <p className="text-xs text-muted-foreground">{factor.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssetClick?.(item.ticker);
                        }}
                        className="w-full mt-4"
                        size="sm"
                      >
                        View Detailed Analysis
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}