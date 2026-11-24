'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function Analysis() {
  const tools = [
    {
      icon: Brain,
      title: 'AI Sentiment Analysis',
      description: 'Recent financial-news sentiment with headline drivers and source attribution.',
      link: '/markets/stock/sentiment',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: TrendingUp,
      title: 'Price Forecasting',
      description: 'Point-estimate price outlooks from a historical-close LSTM model, with documented limitations.',
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
      description: 'Cached market snapshots and key performance metrics.',
      link: '/markets/stock',
      gradient: 'from-green-500 to-teal-500',
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-20">
        <div
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Analysis <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Tools</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Educational research tools for comparing technical, sentiment, forecast, and risk evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {tools.map((tool, idx) => (
            <div
              key={idx}
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
            </div>
          ))}
        </div>

        <div
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
              <p className="font-semibold">Backtesting Concepts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
