import type { MetadataRoute } from 'next';
import { SITE_URL, SEO_INDEXING_ENABLED } from '@/lib/seo';
import { getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { getAllArticles } from '@/lib/learn-articles';

export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SEO_INDEXING_ENABLED) {
    return [];
  }

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/learn`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/disclaimer`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Ticker pages: market data refreshes hourly (matches their ISR window).
  const tickerPages: MetadataRoute.Sitemap = getAllAllowlistedSymbols().map((symbol) => ({
    url: `${SITE_URL}/stocks/${symbol.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Learn articles: use each article's own updatedAt (honest content date).
  const learnPages: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${SITE_URL}/learn/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...tickerPages, ...learnPages];
}
