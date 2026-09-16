import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { learnArticles } from '@/lib/learn-articles';

const SEO_INDEXING_ENABLED = process.env.SEO_INDEXING_ENABLED === 'true';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SEO_INDEXING_ENABLED) {
    return [];
  }

  const base = SITE_URL;

  const staticPages = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1 },
    { url: `${base}/stocks`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${base}/learn`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
  ];

  const stockPages = getAllAllowlistedSymbols().map((symbol) => ({
    url: `${base}/stocks/${symbol.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  const learnPages = learnArticles.map((article) => ({
    url: `${base}/learn/${article.slug}`,
    lastModified: new Date(article.updatedDate),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...stockPages, ...learnPages];
}
