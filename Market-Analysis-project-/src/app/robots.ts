import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const SEO_INDEXING_ENABLED = process.env.SEO_INDEXING_ENABLED === 'true';

export default function robots(): MetadataRoute.Robots {
  const rules: MetadataRoute.Robots['rules'] = SEO_INDEXING_ENABLED
    ? [
        { userAgent: '*', allow: '/', disallow: ['/api/', '/test-chart/', '/markets/stock/watchlist'] },
        { userAgent: 'GPTBot', allow: '/' },
        { userAgent: 'CCBot', disallow: '/' },
      ]
    : [{ userAgent: '*', disallow: '/' }];

  return {
    rules,
    sitemap: SEO_INDEXING_ENABLED ? `${SITE_URL}/sitemap.xml` : undefined,
  };
}
