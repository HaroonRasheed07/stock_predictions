'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Zap, Shield, TrendingUp, Users, Target } from 'lucide-react';

export default function About() {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Analytics',
      description: 'Advanced machine learning models including LSTM for accurate predictions.',
    },
    {
      icon: Zap,
      title: 'Real-Time Data',
      description: 'Live market updates with sub-second latency from multiple data sources.',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-grade encryption and security protocols to protect your data.',
    },
    {
      icon: TrendingUp,
      title: 'Multi-Market Coverage',
      description: 'Comprehensive analytics across stocks, crypto, and e-commerce platforms.',
    },
    {
      icon: Users,
      title: 'Community Insights',
      description: 'Sentiment analysis from social media, news, and expert opinions.',
    },
    {
      icon: Target,
      title: 'Precise Forecasting',
      description: 'High-confidence predictions with detailed confidence intervals.',
    },
  ];

  const stats = [
    { value: '10M+', label: 'Data Points Daily' },
    { value: '87%', label: 'Prediction Accuracy' },
    { value: '24/7', label: 'Market Monitoring' },
    { value: '50+', label: 'Data Sources' },
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
              About <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">AI Driven Market Analysis</span>
            </h1>
            <p className="text-xl text-foreground/70">
              We're building the future of financial analytics with cutting-edge AI and real-time data processing.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  {stat.value}
                </p>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose AI Driven Market Analysis?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional-grade tools trusted by traders,investors and analysts worldwide
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-foreground/80 mb-6">
              AI Driven Market Analysis democratizes access to institutional-grade market intelligence. We believe that powerful analytics
              should be accessible to everyone, not just Wall Street insiders.
            </p>
            <p className="text-lg text-foreground/80">
              By combining cutting-edge AI, real-time data processing, and intuitive design, we're empowering traders and
              analysts to make data-driven decisions with confidence.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built with Modern Technology</h2>
            <p className="text-lg text-muted-foreground">
              Powered by industry-leading frameworks and tools
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              {['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'Recharts', 'Framer Motion'].map((tech, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-muted/30">
                  <p className="font-semibold">{tech}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
