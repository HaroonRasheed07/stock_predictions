'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RSIIndicatorProps {
  rsi: number | null;
}

export default function RSIIndicator({ rsi }: RSIIndicatorProps) {
  let rsiStatus = 'Neutral';
  let rsiColor = 'text-yellow-400';
  let bgColor = 'bg-yellow-500/10';
  let borderColor = 'border-yellow-600';
  let rsiValue = rsi ?? 0;

  if (rsi !== null) {
    if (rsi < 30) {
      rsiStatus = 'Oversold (Strong Buy)';
      rsiColor = 'text-green-400';
      bgColor = 'bg-green-500/10';
      borderColor = 'border-green-600';
    } else if (rsi < 50) {
      rsiStatus = 'Weak Momentum';
      rsiColor = 'text-blue-400';
      bgColor = 'bg-blue-500/10';
      borderColor = 'border-blue-600';
    } else if (rsi < 70) {
      rsiStatus = 'Strong Momentum';
      rsiColor = 'text-cyan-400';
      bgColor = 'bg-cyan-500/10';
      borderColor = 'border-cyan-600';
    } else {
      rsiStatus = 'Overbought (Strong Sell)';
      rsiColor = 'text-red-400';
      bgColor = 'bg-red-500/10';
      borderColor = 'border-red-600';
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <Card className={`glass h-full ${bgColor} border ${borderColor}`}>
        <CardHeader>
          <CardTitle>RSI (14)</CardTitle>
          <p className="text-sm text-muted-foreground">Relative Strength Index</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* RSI Value */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-5xl font-bold text-white mb-2"
            >
              {rsi !== null ? rsi.toFixed(2) : '--'}
            </motion.div>
            <p className={`text-sm font-semibold ${rsiColor}`}>{rsiStatus}</p>
          </div>

          {/* RSI Scale Visualization */}
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>

            <div className="relative w-full h-8 rounded-full overflow-hidden bg-muted/30">
              {/* Oversold Zone (0-30) */}
              <div className="absolute left-0 top-0 h-full w-[30%] bg-green-500/40"></div>

              {/* Neutral Zone (30-70) */}
              <div className="absolute left-[30%] top-0 h-full w-[40%] bg-yellow-500/20"></div>

              {/* Overbought Zone (70-100) */}
              <div className="absolute right-0 top-0 h-full w-[30%] bg-red-500/40"></div>

              {/* Indicator Cursor */}
              {rsi !== null && (
                <motion.div
                  initial={{ left: '0%' }}
                  animate={{ left: `${Math.max(0, Math.min(100, rsi))}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute top-0 h-full w-1 bg-white shadow-lg shadow-white/50 transform -translate-x-1/2"
                ></motion.div>
              )}
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Oversold</span>
              <span>Overbought</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2 text-xs border-t border-muted pt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-muted-foreground">0-30: Oversold (Potential Buy)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-muted-foreground">30-70: Neutral Range</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-muted-foreground">70-100: Overbought (Potential Sell)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
