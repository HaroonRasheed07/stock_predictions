'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Activity, Brain, Shield, TrendingUp, Search,
  ArrowRight, Eye, Zap, LineChart, Target, Sparkles,
} from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true } as const,
};

export function AboutClient() {
  return (
    <div className="min-h-screen">

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden gradient-hero py-20 md:py-28">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">About Stock Vanta</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              A clearer way to{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                understand the market.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto">
              Stock Vanta brings technical analysis, market sentiment, AI-assisted forecasting and risk intelligence into one focused stock-research experience.
            </p>
          </motion.div>

          {/* Abstract signal cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-12 flex justify-center gap-3 md:gap-4 flex-wrap max-w-2xl mx-auto"
          >
            {[
              { icon: BarChart3, label: 'Technical', color: 'from-blue-500/20 to-blue-600/10', iconColor: 'text-blue-500' },
              { icon: Activity, label: 'Sentiment', color: 'from-green-500/20 to-green-600/10', iconColor: 'text-green-500' },
              { icon: Brain, label: 'Forecast', color: 'from-purple-500/20 to-purple-600/10', iconColor: 'text-purple-500' },
              { icon: Shield, label: 'Risk', color: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-500' },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br ${item.color} border border-border/40 backdrop-blur-sm`}
              >
                <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ WHY STOCK VANTA ═══ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
              Built to turn market data into context.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Investors and traders often need to interpret price action, technical indicators, news sentiment, volatility and risk across separate tools. Stock Vanta brings these analytical layers together.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Eye,
                title: 'See the full picture',
                desc: 'Technical indicators, sentiment signals, forecast projections and risk factors evaluated together — not in isolation.',
              },
              {
                icon: Zap,
                title: 'One research workflow',
                desc: 'Instead of switching between charts, news feeds, indicator tools and spreadsheets, everything is organized into a single brief.',
              },
              {
                icon: Target,
                title: 'Form your own view',
                desc: 'Stock Vanta presents evidence layers so you can evaluate a stock from multiple perspectives — not rely on a single number.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                {...fadeUp}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border/60 bg-card p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CORE INTELLIGENCE ═══ */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">Core Intelligence</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three primary analysis layers, each built on real market data.
            </p>
          </motion.div>

          {/* Primary features — large cards */}
          <div className="space-y-6 mb-8">
            {/* Technical Analysis */}
            <motion.div {...fadeUp}>
              <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 hover:shadow-lg hover:border-primary/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                      <BarChart3 className="h-7 w-7 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">Technical Analysis</h3>
                    <p className="text-muted-foreground mb-3">
                      RSI, MACD, moving averages, Bollinger Bands, ATR, trend strength and volume analysis — all computed from real OHLCV market data.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['RSI', 'MACD', 'SMA/EMA', 'Bollinger Bands', 'ATR', 'Trend'].map((t) => (
                        <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">{t}</span>
                      ))}
                    </div>
                    <Link href="/markets/stock/technical" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                      Explore Technical Analysis <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sentiment Analysis */}
            <motion.div {...fadeUp}>
              <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 hover:shadow-lg hover:border-primary/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
                      <Activity className="h-7 w-7 text-green-500" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">Market Sentiment</h3>
                    <p className="text-muted-foreground mb-3">
                      Financial-news sentiment classification — Positive, Neutral, or Negative — with catalyst identification and market context.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['NLP Processing', 'News Analysis', 'Positive / Neutral / Negative', 'Catalyst Detection'].map((t) => (
                        <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">{t}</span>
                      ))}
                    </div>
                    <Link href="/markets/stock/sentiment" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                      Explore Sentiment <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* AI Forecasting */}
            <motion.div {...fadeUp}>
              <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 hover:shadow-lg hover:border-primary/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                      <Brain className="h-7 w-7 text-purple-500" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">AI-Assisted Forecasting</h3>
                    <p className="text-muted-foreground mb-3">
                      Historical price-pattern analysis using LSTM neural networks with attention mechanisms, projecting potential price paths over a forecast horizon.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['LSTM / Attention Model', 'Price Projections', 'Confidence Ranges', 'Model Limitations Disclosed'].map((t) => (
                        <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">{t}</span>
                      ))}
                    </div>
                    <Link href="/markets/stock/forecast" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                      Explore Forecasting <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Secondary features — smaller cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Shield, title: 'Risk Intelligence', desc: 'Volatility, drawdown, trend stability and downside exposure analysis.', link: '/markets/stock' },
              { icon: Search, title: 'Opportunity Discovery', desc: 'Screen and filter stocks by signal, momentum, risk level and more.', link: '/markets/discover' },
              { icon: LineChart, title: 'Stock Brief', desc: 'A single unified view combining signal, sentiment, catalysts and risk.', link: '/markets/brief' },
            ].map((item, i) => (
              <motion.div key={item.title} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <Link href={item.link} className="block rounded-xl border border-border/60 bg-card p-5 hover:shadow-md hover:border-primary/20 transition-all h-full">
                  <item.icon className="h-5 w-5 text-primary mb-3" />
                  <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW STOCK VANTA WORKS ═══ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">How Stock Vanta Works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A focused research workflow — from discovery to evidence-based analysis.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: '01',
                title: 'Select a Stock',
                desc: 'Search or discover a company you want to analyze.',
                icon: Search,
              },
              {
                step: '02',
                title: 'Understand the Market',
                desc: 'Review price behavior, technical indicators, trend and volatility.',
                icon: BarChart3,
              },
              {
                step: '03',
                title: 'Add Market Context',
                desc: 'Understand financial-news sentiment and relevant catalysts.',
                icon: Activity,
              },
              {
                step: '04',
                title: 'Form Your Own View',
                desc: 'Use technical, sentiment, forecasting and risk information together rather than relying on one isolated signal.',
                icon: Target,
              },
            ].map((item, i) => (
              <motion.div key={item.step} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <div className="flex gap-4 p-5 rounded-xl border border-border/60 bg-card/50 h-full">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TECHNOLOGY ═══ */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">Built with modern analytical infrastructure</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A full-stack research platform combining real-time market data processing with machine-learning analysis.
            </p>
          </motion.div>

          <motion.div {...fadeUp}>
            <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Next.js', category: 'Frontend' },
                  { name: 'React', category: 'Frontend' },
                  { name: 'TypeScript', category: 'Frontend' },
                  { name: 'Tailwind CSS', category: 'Frontend' },
                  { name: 'FastAPI', category: 'Backend' },
                  { name: 'Python', category: 'Backend' },
                  { name: 'ONNX Runtime', category: 'ML Inference' },
                  { name: 'Custom LSTM', category: 'Forecasting' },
                  { name: 'Financial NLP', category: 'Sentiment' },
                  { name: 'Yahoo Query', category: 'Market Data' },
                ].map((tech) => (
                  <div key={tech.name} className="text-center p-3 rounded-xl bg-muted/30">
                    <p className="text-sm font-semibold">{tech.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{tech.category}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ TRANSPARENCY ═══ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-6 flex items-center justify-center">
              <Eye className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Transparent by design</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Stock Vanta should help you understand where an insight comes from — not simply display a score without context.
            </p>
            <Link href="/methodology">
              <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 gap-2">
                Explore Our Methodology <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ CREATOR ═══ */}
      <section className="py-16 md:py-20 bg-muted/20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div {...fadeUp}>
            <div className="flex flex-col md:flex-row items-center gap-8 p-8 rounded-2xl border border-border/60 bg-card">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">HR</span>
                </div>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Built from research into a real product</p>
                <h3 className="text-xl font-bold mb-2">Haroon Rasheed</h3>
                <p className="text-sm text-muted-foreground">
                  AI Developer &amp; Creator of Stock Vanta. Stock Vanta began as an AI-focused market-analysis project and evolved into a broader stock research platform combining technical analysis, sentiment intelligence, forecasting and risk context.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            {...fadeUp}
            className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto glow-primary"
          >
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">
              See the market from more than one angle.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Use technical analysis, sentiment, forecasting and risk context to research your next stock.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/markets/brief">
                <Button size="lg" className="bg-gradient-primary text-white hover:opacity-90 transition-opacity text-base px-7 gap-2 w-full sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  Analyze a Stock
                </Button>
              </Link>
              <Link href="/markets/discover">
                <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-base px-7 gap-2 w-full sm:w-auto">
                  <Search className="h-4 w-4" />
                  Discover Stocks
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ DISCLAIMER ═══ */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-xl border border-border/40 bg-card/30 p-5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Stock Vanta provides market research and analytical information for educational and informational purposes. Forecasts, scores and signals involve uncertainty and should not be treated as guarantees or personalized financial advice. Always consider your personal financial situation, risk tolerance, and consult qualified financial advisors before making investment decisions.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
