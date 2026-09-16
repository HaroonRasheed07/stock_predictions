import type { MetadataRoute } from 'next';
import { SITE_URL, SEO_INDEXING_ENABLED } from '@/lib/seo';
import { getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { getAllArticleSlugs } from '@/lib/learn-articles';

const LAST_MODIFIED = new Date('2026-09-16');

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SEO_INDEXING_ENABLED) {
    return [];
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/stocks`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/methodology`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/learn`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const tickerPages: MetadataRoute.Sitemap = getAllAllowlistedSymbols().map((symbol) => ({
    url: `${SITE_URL}/stocks/${symbol.toLowerCase()}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const learnPages: MetadataRoute.Sitemap = getAllArticleSlugs().map((slug) => ({
    url: `${SITE_URL}/learn/${slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...tickerPages, ...learnPages];
}
