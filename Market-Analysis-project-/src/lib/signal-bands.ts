/**
 * Canonical threshold bands for StockVantex signal presentation.
 *
 * Every band documents its source of truth. The UI must read thresholds from
 * here so cards, charts, tooltips, and the Stock Brief cannot drift apart.
 */

/** Risk composite bands — source: methodology page + backend risk.py (<35 Low, 35–65 Medium, ≥65 High). */
export const RISK_BANDS = {
  MEDIUM_MIN: 35,
  HIGH_MIN: 65,
} as const;

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

export function riskLevelFor(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined || !isFinite(score)) return 'Unknown';
  if (score >= RISK_BANDS.HIGH_MIN) return 'High';
  if (score >= RISK_BANDS.MEDIUM_MIN) return 'Medium';
  return 'Low';
}

/** Opportunity score display bands — presentation only, never a probability. */
export const OPPORTUNITY_BANDS = {
  LOW_MAX: 40,
  HIGH_MIN: 70,
} as const;

export type OpportunityBand = 'high' | 'moderate' | 'low';

export function opportunityBandFor(score: number | null | undefined): OpportunityBand {
  if (score === null || score === undefined || !isFinite(score)) return 'low';
  if (score >= OPPORTUNITY_BANDS.HIGH_MIN) return 'high';
  if (score < OPPORTUNITY_BANDS.LOW_MAX) return 'low';
  return 'moderate';
}

/**
 * Neutral band around the composite sentiment score (-1..+1). Source: backend
 * label derivation (api.py) — score > 0.15 positive, < -0.15 negative, else
 * neutral. Frontend colours must agree with the label the backend returns.
 */
export const SENTIMENT_NEUTRAL_BAND = 0.15;

export type SentimentTone = 'bullish' | 'bearish' | 'neutral';

export function sentimentTone(score: number | null | undefined): SentimentTone {
  if (score === null || score === undefined || !isFinite(score)) return 'neutral';
  if (score >= SENTIMENT_NEUTRAL_BAND) return 'bullish';
  if (score <= -SENTIMENT_NEUTRAL_BAND) return 'bearish';
  return 'neutral';
}

/**
 * Trend strength label bands — source: backend trend label
 * (Bullish > 60, Bearish < 40, else Neutral). Display colours use the same
 * boundaries so a "Neutral" label never renders with a directional colour.
 */
export const TREND_SCORE_BANDS = {
  BULLISH_MIN: 60,
  BEARISH_MAX: 40,
} as const;

/**
 * Flat band for forecast direction — final modelled close vs reference price
 * (current price when available, otherwise the first forecast step).
 * Within ±0.3% the direction is reported as flat.
 */
export const FORECAST_FLAT_PCT = 0.003;
