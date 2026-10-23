import type { EnhancedSentiment } from './api';

/**
 * Adapts the `sentiment` object embedded in `/api/market/overview` to the
 * `EnhancedSentiment` shape so the hero/Explorer still have sentiment when the
 * dedicated `/api/data/sentiment` call is slow or fails.
 */
export function normalizeOverviewSentiment(ov: unknown): EnhancedSentiment | null {
  if (!ov || typeof ov !== 'object') return null;
  const o = ov as Record<string, any>;
  const label = o.sentiment_label || o.label;
  if (!label) return null;
  const status = (o.status as EnhancedSentiment['status']) || 'sufficient';
  if (status === 'error') return null;
  const positive = Number(o.positive_count) || 0;
  const negative = Number(o.negative_count) || 0;
  const neutralField = Number(o.neutral_count) || 0;
  const newsCount = Number(o.news_count) || 0;
  const total = newsCount || positive + negative + neutralField;
  const neutral = newsCount > 0 ? newsCount - positive - negative : neutralField;
  const score = Number(o.sentiment_score ?? o.score) || 0;
  return {
    ticker: o.ticker,
    sentiment_score: score,
    sentiment_label: label,
    status,
    score,
    label,
    positive_count: positive,
    negative_count: negative,
    neutral_count: neutral,
    positive_pct: total > 0 ? (positive / total) * 100 : 0,
    neutral_pct: total > 0 ? (neutral / total) * 100 : 0,
    negative_pct: total > 0 ? (negative / total) * 100 : 0,
    news_count: total,
    source_providers: Array.isArray(o.source_providers) ? o.source_providers : [],
    news: Array.isArray(o.news) ? o.news : [],
    sentiment_trend_7d: Array.isArray(o.sentiment_trend_7d)
      ? o.sentiment_trend_7d.map((t: any) => ({
          date: t.date || t.timestamp || '',
          timestamp: t.timestamp,
          score: Number(t.score) || 0,
          label: t.label,
        }))
      : [],
    drivers: [],
    explanation: o.news_impact_summary || '',
    news_impact_summary: o.news_impact_summary || '',
    market_mood: o.market_mood || label,
  };
}
