'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface Signal {
  buySignal: boolean;
  sellSignal: boolean;
  signalStrength: number;
  lastSignalDate: string | null;
}

export default function SignalsPanel({ signals }: { signals: Signal }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="glass h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Live Trading Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Buy Signal */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              signals.buySignal
                ? 'bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20'
                : 'bg-muted/30 border-muted'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    signals.buySignal ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
                  }`}
                ></div>
                <span
                  className={`font-semibold ${
                    signals.buySignal ? 'text-green-400' : 'text-muted-foreground'
                  }`}
                >
                  BUY Signal
                </span>
              </div>
              {signals.buySignal && (
                <span className="text-green-400 text-sm font-bold">ACTIVE</span>
              )}
            </div>
            {signals.buySignal && (
              <p className="text-green-300 text-xs">
                Oversold conditions or bullish crossover detected
              </p>
            )}
          </div>

          {/* Sell Signal */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              signals.sellSignal
                ? 'bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20'
                : 'bg-muted/30 border-muted'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    signals.sellSignal ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'
                  }`}
                ></div>
                <span
                  className={`font-semibold ${
                    signals.sellSignal ? 'text-red-400' : 'text-muted-foreground'
                  }`}
                >
                  SELL Signal
                </span>
              </div>
              {signals.sellSignal && (
                <span className="text-red-400 text-sm font-bold">ACTIVE</span>
              )}
            </div>
            {signals.sellSignal && (
              <p className="text-red-300 text-xs">
                Overbought conditions or bearish crossover detected
              </p>
            )}
          </div>

          {/* Neutral */}
          {!signals.buySignal && !signals.sellSignal && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-600">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="font-semibold text-yellow-400">NEUTRAL</span>
              </div>
              <p className="text-yellow-300 text-xs mt-2">
                No clear buy or sell signals at this time
              </p>
            </div>
          )}

          {/* Signal Strength */}
          <div className="pt-4 border-t border-muted">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Signal Strength</span>
              <span className="text-sm font-bold text-primary">
                {signals.signalStrength}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${signals.signalStrength}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-primary to-secondary"
              ></motion.div>
            </div>
          </div>

          {/* Last Update */}
          {signals.lastSignalDate && (
            <div className="pt-2 text-xs text-muted-foreground">
              Last Update: {new Date(signals.lastSignalDate).toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
