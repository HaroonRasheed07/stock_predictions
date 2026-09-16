import { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { BarChart3, Activity, Brain, Shield, Target, TrendingUp, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Learn how Stock Vanta analyzes stocks using technical indicators, market sentiment, AI forecasting, and risk assessment.',
  alternates: { canonical: `${SITE_URL}/methodology` },
  openGraph: { title: `Methodology | ${SITE_NAME}`, description: 'How Stock Vanta analyzes stocks.', url: `${SITE_URL}/methodology` },
};

const sections = [
  {
    icon: BarChart3,
    title: 'Technical Analysis',
    description: 'We compute standard technical indicators including RSI, MACD, Bollinger Bands, moving averages (SMA/EMA), ATR, and trend strength from historical OHLCV data.',
    details: ['RSI (14-period) for momentum', 'MACD for trend-following signals', 'Bollinger Bands for volatility', 'SMA 20/50 for trend direction', 'ATR for expected range'],
  },
  {
    icon: Activity,
    title: 'Sentiment Analysis',
    description: 'We aggregate recent news headlines and classify them as positive, negative, or neutral using NLP. The overall sentiment score reflects the balance of coverage.',
    details: ['Automated headline classification', 'Positive/negative/neutral scoring', 'Market mood assessment', 'News impact summary', 'Source attribution'],
  },
  {
    icon: Brain,
    title: 'AI Forecasting',
    description: 'An LSTM neural network with attention mechanisms generates price predictions based on historical patterns. The model processes OHLCV data and technical indicators.',
    details: ['LSTM + Attention architecture', '10-day price forecast horizon', 'Historical pattern recognition', 'Confidence estimation', 'Clear limitations disclosure'],
  },
  {
    icon: Shield,
    title: 'Risk Assessment',
    description: 'Multi-factor risk evaluation considers volatility, drawdown history, market correlation (beta), and concentration to assign a risk level.',
    details: ['Volatility-based risk scoring', 'Maximum drawdown analysis', 'Market correlation (beta)', 'Risk level classification', 'Factor breakdown'],
  },
  {
    icon: Target,
    title: 'Trade Confirmation',
    description: 'A composite score combining technical, sentiment, forecast, risk, and volatility signals into a single directional recommendation with supporting rationale.',
    details: ['Multi-signal aggregation', 'Weighted scoring model', 'Buy/Sell/Hold recommendation', 'Confidence scoring', 'Supporting rationale'],
  },
];

const limitations = [
  'All analysis is based on historical data and statistical models — not financial advice.',
  'Past performance does not guarantee future results.',
  'AI forecasts can be wrong. Unprecedented events break any model.',
  'Sentiment analysis may misinterpret context, sarcasm, or domain-specific language.',
  'Technical indicators are lagging — they describe the past, not the future.',
  'Stock Vanta does not execute trades or hold assets.',
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-14 md:top-16 z-30">
        <div className="container mx-auto px-4 py-2">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }]} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold">Methodology</h1>
          <p className="text-muted-foreground mt-2">
            Stock Vanta layers multiple forms of analysis to provide evidence-based stock research. Every signal includes its reasoning.
          </p>
        </div>

        <div className="space-y-6 max-w-3xl">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="rounded-xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h2 className="text-base font-bold">{section.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{section.description}</p>
                <ul className="space-y-1.5">
                  {section.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Limitations */}
        <div className="max-w-3xl rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-bold">Important Limitations</h2>
          </div>
          <ul className="space-y-2">
            {limitations.map((l, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
