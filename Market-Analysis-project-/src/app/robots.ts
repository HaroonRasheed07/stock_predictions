import type { MetadataRoute } from 'next';
import { SITE_URL, SEO_INDEXING_ENABLED } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!SEO_INDEXING_ENABLED) {
    return {
      rules: { userAgent: '*', disallow: '/' },
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }

  return {
    rules: [
      // Search and answer engines: fully allowed.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/test-chart/'],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'ClaudeBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
