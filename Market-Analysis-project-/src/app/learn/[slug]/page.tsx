import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getArticle, getAllArticleSlugs } from '@/lib/learn-articles';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: { absolute: `${article.title} | ${SITE_NAME}` },
    description: article.description,
    alternates: { canonical: `${SITE_URL}/learn/${slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${SITE_URL}/learn/${slug}`,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
  };
}

export default async function LearnArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.h1,
    description: article.description,
    url: `${SITE_URL}/learn/${slug}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/learn/${slug}`,
    },
  };

  const breadcrumbStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn` },
      { '@type': 'ListItem', position: 3, name: article.h1, item: `${SITE_URL}/learn/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />

      <div className="min-h-screen">
        <article className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <header className="mt-6 mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags.map((tag) => (
                <span key={tag} className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{article.h1}</h1>
            <p className="text-lg text-muted-foreground">{article.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span>By {article.author}</span>
              <span>·</span>
              <time dateTime={article.publishedAt}>Published {article.publishedAt}</time>
              {article.updatedAt !== article.publishedAt && (
                <>
                  <span>·</span>
                  <time dateTime={article.updatedAt}>Updated {article.updatedAt}</time>
                </>
              )}
              <span>·</span>
              <span>{article.readingTime} read</span>
            </div>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed">{article.content.intro}</p>

            {article.content.sections.map((section, i) => (
              <section key={i} className="mt-8">
                <h2 className="text-xl font-bold mb-3">{section.heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                {section.subsections?.map((sub, j) => (
                  <div key={j} className="mt-4 ml-4">
                    <h3 className="text-lg font-semibold mb-2">{sub.heading}</h3>
                    <p className="text-muted-foreground leading-relaxed">{sub.content}</p>
                  </div>
                ))}
              </section>
            ))}

            <section className="mt-8">
              <h2 className="text-xl font-bold mb-3">Key Takeaways</h2>
              <ul className="space-y-2">
                {article.content.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </section>

            {article.content.faq && article.content.faq.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold mb-3">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {article.content.faq.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-card p-4">
                      <h3 className="font-semibold mb-2">{item.question}</h3>
                      <p className="text-sm text-muted-foreground">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8 rounded-lg border border-border/60 bg-muted/30 p-4">
              <h3 className="font-semibold mb-2 text-sm">Important Limitations</h3>
              <p className="text-xs text-muted-foreground">{article.content.limitations}</p>
            </section>
          </div>

          <footer className="mt-8 pt-6 border-t border-border/60">
            <div className="flex flex-wrap gap-2 mb-4">
              {article.relatedTickers.map((ticker) => (
                <Link
                  key={ticker}
                  href={`/stocks/${ticker.toLowerCase()}`}
                  className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                >
                  {ticker} Analysis
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {article.relatedArticles.map((relatedSlug) => (
                <Link
                  key={relatedSlug}
                  href={`/learn/${relatedSlug}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {relatedSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} →
                </Link>
              ))}
            </div>
          </footer>
        </article>
      </div>
    </>
  );
}
