export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stockvantex.com';
export const SITE_NAME = 'StockVantex';
export const SITE_DESCRIPTION = 'StockVantex connects technical analysis, news sentiment, LSTM forecasting, and risk assessment into one evidence-based Research Brief. See the full picture behind every stock.';

export const SEO_INDEXING_ENABLED = process.env.SEO_INDEXING_ENABLED !== 'false';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.png`;

export function buildCanonical(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export function buildOGImageUrl(path: string): string {
  return `${SITE_URL}/og-cover.png`;
}

export const STRUCTURED_DATA_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: SITE_DESCRIPTION,
  sameAs: [
    'https://www.linkedin.com/in/haroon-rasheed-55022427a',
    'https://github.com/HaroonRasheed07',
  ],
};

export const STRUCTURED_DATA_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: 'Stock Vantex',
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
};
