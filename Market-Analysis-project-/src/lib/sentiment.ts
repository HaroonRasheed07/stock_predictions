import { cn } from '@/lib/utils';

export type SentimentStatus = 'sufficient' | 'insufficient' | 'error' | 'no_relevant_news' | 'news_unavailable';

/**
 * Unified sentiment color logic used across all pages.
 * Handles the new "Insufficient News" status (no news != neutral).
 */
export function getSentimentColorClass(
  sentimentLabel: string,
  sentimentStatus?: SentimentStatus
): string {
  // Status overrides: insufficient/error → muted
  if (sentimentStatus === 'insufficient') return 'text-muted-foreground';
  if (sentimentStatus === 'error') return 'text-destructive/70';

  // Label-based colors (sufficient status)
  switch (sentimentLabel) {
    case 'Positive':
    case 'Bullish':
      return 'text-success';
    case 'Slightly Bullish':
      return 'text-success/80';
    case 'Negative':
    case 'Bearish':
      return 'text-destructive';
    case 'Slightly Bearish':
      return 'text-destructive/80';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Returns the sentiment color class based on a numeric score.
 * Used when we only have the score (no label/status available).
 */
export function getSentimentScoreColorClass(score: number): string {
  if (score > 0.1) return 'text-success';
  if (score < -0.1) return 'text-destructive';
  return 'text-muted-foreground';
}

/**
 * Format sentiment label for display.
 * Returns "No Data" for insufficient status, "Error" for error status.
 */
export function formatSentimentLabel(
  sentimentLabel: string,
  sentimentStatus?: SentimentStatus
): string {
  if (sentimentStatus === 'insufficient') return 'No Data';
  if (sentimentStatus === 'error') return 'Error';
  return sentimentLabel || 'No Data';
}

/**
 * Get the sentiment display color class based on score thresholds.
 * For pages that display score-based colors (brief, etc).
 */
export function getSentimentBadgeClass(
  sentimentLabel: string,
  sentimentStatus?: SentimentStatus
): string {
  if (sentimentStatus === 'insufficient') return 'bg-muted/50 text-muted-foreground';
  if (sentimentStatus === 'error') return 'bg-destructive/10 text-destructive';

  switch (sentimentLabel) {
    case 'Positive':
    case 'Bullish':
      return 'bg-success/10 text-success';
    case 'Slightly Bullish':
      return 'bg-success/5 text-success/80';
    case 'Negative':
    case 'Bearish':
      return 'bg-destructive/10 text-destructive';
    case 'Slightly Bearish':
      return 'bg-destructive/5 text-destructive/80';
    default:
      return 'bg-muted/50 text-muted-foreground';
  }
}
