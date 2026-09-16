'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Zap, Shield, TrendingUp, Users, Target, BarChart3, Activity, AlertTriangle } from 'lucide-react';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export default function About() {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Analytics',
      description: 'LSTM neural networks with attention mechanisms analyze historical patterns to generate price forecasts.',
    },
    {
      icon: BarChart3,
      title: 'Technical Indicators',
      description: 'RSI, MACD, Bollinger Bands, moving averages, ATR, and trend strength computed from real OHLCV data.',
    },
    {
      icon: Activity,
      title: 'Sentiment Analysis',
      description: 'Automated news headline classification using NLP to gauge market mood as Positive, Neutral, or Negative.',
    },
    {
      icon: Shield,
      title: 'Risk Assessment',
      description: 'Multi-factor risk evaluation considers volatility, drawdown, market correlation, and concentration.',
    },
    {
      icon: TrendingUp,
      title: 'Trade Confirmation',
      description: 'Composite signals combining technical, sentiment, forecast, and risk into actionable recommendations.',
    },
    {
      icon: Target,
      title: 'Explainable Analysis',
      description: 'Every signal includes its reasoning — we show the evidence, not just the conclusion.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="gradient-hero py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Stock Vanta</span>
            </h1>
            <p className="text-xl text-foreground/70">
              AI-powered stock research that shows its work — technical indicators, sentiment, forecasting, and risk, all built on real market data.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">What Stock Vanta Does</h2>
            <p className="text-foreground/80 mb-4">
              Stock Vanta is a stock research platform that layers multiple forms of analysis to provide evidence-based insights. Every brief includes technical indicators, market sentiment, AI-generated forecasts, and risk assessment.
            </p>
            <p className="text-foreground/80">
              We use real market data from Yahoo Query and analyze it with technical indicators (RSI, MACD, Bollinger Bands), NLP-based sentiment analysis, and LSTM neural network forecasting models.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Core Capabilities</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Six analysis layers built around evidence and transparency.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
              >
                <Card className="glass h-full hover:glow-primary transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-base font-bold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Are Not */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h2 className="text-2xl font-bold">What Stock Vanta Is Not</h2>
            </div>
            <ul className="space-y-3 text-foreground/80">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">•</span>
                <span><strong>Not financial advice.</strong> Stock Vanta provides analysis and research tools, not investment recommendations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">•</span>
                <span><strong>Not a crystal ball.</strong> AI forecasts are based on historical patterns and can be wrong. Past performance does not guarantee future results.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">•</span>
                <span><strong>Not a broker.</strong> Stock Vanta does not execute trades, hold assets, or manage portfolios.</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-foreground/80 mb-4">
              Stock Vanta aims to make stock research more transparent. We believe analysis should show its work — not just give a number and hope.
            </p>
            <p className="text-foreground/80">
              Every brief layers technical indicators, sentiment, forecast models, and risk so you can see the full picture before deciding.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
