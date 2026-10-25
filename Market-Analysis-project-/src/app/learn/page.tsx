import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getAllArticles, getArticleCover } from '@/lib/learn-articles';

export const metadata: Metadata = {
  title: { absolute: `Learn — Stock Market Analysis Guides & Financial Education | ${SITE_NAME}` },
  description: `Free educational guides on technical analysis, RSI, MACD, volatility, sentiment analysis, and AI forecasting. Built by ${SITE_NAME}.`,
  alternates: { canonical: `${SITE_URL}/learn` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Learn | ${SITE_NAME}`,
    description: 'Free educational guides on stock market analysis, technical indicators, and AI forecasting.',
    url: `${SITE_URL}/learn`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function LearnPage() {
  const articles = getAllArticles();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Learn Stock Analysis | ${SITE_NAME}`,
    description: 'Free educational guides on technical analysis, sentiment, volatility, and AI forecasting.',
    url: `${SITE_URL}/learn`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mt-6 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Learn Stock Analysis</h1>
            <p className="text-muted-foreground max-w-2xl">
              Understand the concepts behind StockVantex&apos;s analysis. These guides cover technical indicators, sentiment analysis, risk assessment, and AI forecasting—explained clearly for all experience levels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => {
              const cover = getArticleCover(article);
              return (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="group rounded-xl border border-border/60 bg-card p-5 hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="mb-4 aspect-[1200/630] overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                    <Image
                      src={cover.src}
                      alt={cover.alt}
                      width={1200}
                      height={630}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {article.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-base font-semibold mb-2 group-hover:text-primary transition-colors">
                    {article.h1}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">{article.description}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{article.publishedAt}</span>
                    <span>·</span>
                    <span>{article.readingTime}</span>
                    <span>·</span>
                    <span>{article.author}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
