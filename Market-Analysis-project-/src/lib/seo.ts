export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stockvanta.vercel.app';
export const SITE_NAME = 'Stock Vanta';
export const SITE_DESCRIPTION = 'AI-powered stock research and decision intelligence with technical analysis, sentiment, forecasting, market opportunities, volatility insights and explainable stock signals.';

export const SEO_INDEXING_ENABLED = process.env.SEO_INDEXING_ENABLED !== 'false';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png`;

export function buildCanonical(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export function buildOGImageUrl(path: string): string {
  return `${SITE_URL}/icon-512.png`;
}

export const STRUCTURED_DATA_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
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
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/stocks?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
