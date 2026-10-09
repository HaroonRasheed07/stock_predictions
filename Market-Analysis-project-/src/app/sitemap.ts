import type { MetadataRoute } from 'next';
import { SITE_URL, SEO_INDEXING_ENABLED } from '@/lib/seo';
import { getAllAllowlistedSymbols } from '@/lib/stock-allowlist';
import { getAllArticles } from '@/lib/learn-articles';

export const revalidate = 3600;

/**
 * Single canonical sitemap for https://stockvantex.com.
 *
 * Timestamp policy (honest `<lastmod>` only):
 * - Learn articles: real editorial `updatedAt` from the article registry —
 *   the same value their page metadata reports as `modifiedTime`.
 * - Stock research pages: OMITTED. Their market data refreshes hourly, but a
 *   cache refresh is not a content edit; a generation-time stamp would change
 *   on every rebuild and misrepresent modifications.
 * - Static pages: OMITTED (no tracked revision date — not invented).
 *
 * Generation is pure: local registries only, zero network/backend/API calls,
 * deterministic across builds, cold starts, and consecutive requests.
 * Google ignores `priority`/`changefreq`, so they are not emitted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SEO_INDEXING_ENABLED) {
    return [];
  }

  const entries: MetadataRoute.Sitemap = [
    // Core pages
    { url: SITE_URL },
    { url: `${SITE_URL}/stocks` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/contact` },
    { url: `${SITE_URL}/methodology` },
    { url: `${SITE_URL}/learn` },
    // Legal pages
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    { url: `${SITE_URL}/disclaimer` },
    // Stock research (52-symbol SEO allowlist, lowercase canonical routes)
    ...getAllAllowlistedSymbols().map((symbol) => ({
      url: `${SITE_URL}/stocks/${symbol.toLowerCase()}`,
    })),
    // Educational content (every published Learn article)
    ...getAllArticles().map((article) => ({
      url: `${SITE_URL}/learn/${article.slug}`,
      lastModified: new Date(article.updatedAt),
    })),
  ];

  // Deterministic output: deduplicate by URL, then sort by URL codepoint.
  const seen = new Set<string>();
  const deduped = entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
  deduped.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return deduped;
}
