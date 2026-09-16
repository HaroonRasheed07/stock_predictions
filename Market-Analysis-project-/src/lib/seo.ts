export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stockvanta.vercel.app';
export const SITE_NAME = 'Stock Vanta';
export const SITE_DESCRIPTION =
  'AI-powered stock research and decision intelligence with technical analysis, sentiment, forecasting, and explainable signals.';

export function buildCanonical(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
