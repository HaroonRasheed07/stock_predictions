'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function Analysis() {
  const tools = [
    {
      icon: Brain,
      title: 'AI Sentiment Analysis',
      description: 'Real-time sentiment tracking across news and social media.',
      link: '/markets/stock/sentiment',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: TrendingUp,
      title: 'Price Forecasting',
      description: 'Advanced ML models for accurate price predictions.',
      link: '/markets/stock/forecast',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Activity,
      title: 'Technical Indicators',
      description: 'Comprehensive technical analysis with RSI, MACD, and more.',
      link: '/markets/stock/technical',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: BarChart3,
      title: 'Market Overview',
      description: 'Real-time market data and key performance metrics.',
      link: '/markets/stock',
      gradient: 'from-green-500 to-teal-500',
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Analysis <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Tools</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional-grade analytics and forecasting tools for data-driven trading decisions
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {tools.map((tool, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link href={tool.link}>
                <Card className="glass hover:glow-primary transition-all duration-300 cursor-pointer h-full group">
                  <CardHeader>
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <tool.icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{tool.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 glass rounded-2xl p-8 max-w-3xl mx-auto text-center"
        >
          <h3 className="text-2xl font-bold mb-4">Coming Soon</h3>
          <p className="text-muted-foreground mb-6">
            We're constantly adding new analysis tools and features. Stay tuned for:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="font-semibold">Portfolio Optimizer</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="font-semibold">Risk Calculator</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="font-semibold">Backtesting Engine</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
