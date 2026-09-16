'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, BarChart3, Shield, Activity, TrendingUp, Eye } from 'lucide-react';
import Link from 'next/link';

export function AboutClient() {
  const features = [
    {
      icon: BarChart3,
      title: 'Technical Analysis',
      description: 'RSI, MACD, moving averages, Bollinger Bands, ATR, and trend analysis calculated from live market data.',
    },
    {
      icon: Activity,
      title: 'Sentiment Analysis',
      description: 'News-driven sentiment scoring using natural language processing to gauge market mood toward individual stocks.',
    },
    {
      icon: Brain,
      title: 'AI Forecasting',
      description: 'LSTM neural network models with attention mechanisms that project potential future price paths with confidence ranges.',
    },
    {
      icon: Shield,
      title: 'Risk Assessment',
      description: 'Multi-factor risk evaluation combining volatility, trend stability, and drawdown analysis.',
    },
    {
      icon: TrendingUp,
      title: 'Opportunity Scoring',
      description: 'Composite scoring that integrates technical signals, sentiment, and risk into a single research metric.',
    },
    {
      icon: Eye,
      title: 'Explainable Signals',
      description: 'Every brief shows the evidence layers behind its analysis—not just a single number, but the reasoning.',
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
              An AI-powered stock research platform that layers technical analysis, sentiment, forecasting, and risk into evidence-based briefs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What Stock Vanta Does */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">What Stock Vanta Does</h2>
            <div className="space-y-4 text-foreground/80">
              <p>
                Stock Vanta is a stock research platform that combines multiple analytical approaches into a single, unified view. Instead of presenting a single indicator or metric, it layers technical analysis, news-based sentiment, machine learning forecasting, and risk assessment—so you can see the full picture behind each stock.
              </p>
              <p>
                The platform analyzes stocks using technical indicators like RSI, MACD, moving averages, Bollinger Bands, and ATR. It evaluates market sentiment by processing financial news through natural language processing models. It generates probabilistic price forecasts using LSTM neural networks. And it assesses risk through volatility analysis, trend stability, and drawdown evaluation.
              </p>
            </div>
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
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Core Capabilities</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every stock brief combines these analytical layers into a single evidence-based view.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="glass h-full hover:glow-primary transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Was Built */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">How It Was Built</h2>
            <div className="space-y-4 text-foreground/80">
              <p>
                Stock Vanta was built by Haroon Rasheed as a project combining software engineering with financial analysis and machine learning. The frontend is built with Next.js and React, the backend uses FastAPI (Python), and the forecasting pipeline uses LSTM/attention-based neural network models.
              </p>
              <p>
                The platform uses market data from Yahoo Finance and processes financial news for sentiment analysis. All analytical outputs—technical signals, sentiment scores, risk assessments, and forecasts—are generated from this data using the methodologies described on our{' '}
                <Link href="/methodology" className="text-primary hover:underline">
                  methodology page
                </Link>
                .
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Our Goal</h2>
            <p className="text-foreground/80">
              Stock Vanta aims to make multi-layered stock analysis accessible and understandable. Rather than presenting a single number or prediction, it shows the evidence behind each analysis—technical indicators, sentiment data, forecast ranges, and risk factors—so you can form your own informed view.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Limitations */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-6"
          >
            <h2 className="text-xl font-bold mb-3">Important Limitations</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Stock Vanta is a research and analysis tool. It does not provide personalized investment advice. All analysis is based on historical and current market data, and past performance does not guarantee future results.
              </p>
              <p>
                Forecast outputs are probabilistic estimates, not predictions. Historical model evaluation metrics describe past performance and do not guarantee future accuracy. All signals and scores should be used as inputs to your own research—not as the sole basis for investment decisions.
              </p>
              <p>
                Always consider your personal financial situation, risk tolerance, and consult qualified financial advisors before making investment decisions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Technology</h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6 max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Next.js', 'React', 'TypeScript', 'FastAPI', 'Python', 'LSTM', 'Tailwind CSS', 'Yahoo Finance'].map((tech, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm font-semibold">{tech}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
