import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LineChart } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getArticle, getArticleCover, getAllArticleSlugs } from '@/lib/learn-articles';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

export async function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  const cover = getArticleCover(article);
  const coverUrl = cover.src.startsWith('http') ? cover.src : `${SITE_URL}${cover.src}`;

  return {
    title: { absolute: `${article.title} | ${SITE_NAME}` },
    description: article.description,
    alternates: { canonical: `${SITE_URL}/learn/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      images: [{ url: coverUrl, width: 1200, height: 630, alt: cover.alt }],
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
      images: [{ url: coverUrl, width: 1200, height: 630, alt: cover.alt }],
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

  const wordCount = [
    article.content.intro,
    ...article.content.sections.flatMap((section) => [
      section.content,
      ...(section.paragraphs ?? []),
      ...(section.list?.items ?? []),
      section.afterList ?? '',
      ...(section.subsections?.map((sub) => sub.content) ?? []),
    ]),
    ...article.content.keyTakeaways,
    ...(article.content.faq ?? []).flatMap((item) => [item.question, item.answer]),
    article.content.limitations,
  ]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  const tocItems = [
    ...article.content.sections.map((section) => ({
      id: slugifyHeading(section.heading),
      label: section.heading,
    })),
    { id: 'key-takeaways', label: 'Key Takeaways' },
    ...(article.content.faq && article.content.faq.length > 0
      ? [{ id: 'frequently-asked-questions', label: 'Frequently Asked Questions' }]
      : []),
    ...(article.resources && article.resources.length > 0
      ? [{ id: 'further-reading', label: 'Further Reading' }]
      : []),
  ];

  const cover = getArticleCover(article);
  const coverUrl = cover.src.startsWith('http') ? cover.src : `${SITE_URL}${cover.src}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.h1,
    description: article.description,
    url: `${SITE_URL}/learn/${slug}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    wordCount,
    inLanguage: 'en',
    image: coverUrl,
    author: {
      '@type': 'Person',
      name: article.author,
      url: `${SITE_URL}/about`,
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

  const faqStructuredData =
    article.content.faq && article.content.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.content.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : null;

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
      {faqStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      )}
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
              <Link href="/about" className="hover:text-primary transition-colors">By {article.author}</Link>
              <span>·</span>
              <time dateTime={article.publishedAt}>Published {article.publishedAt}</time>
              <span>·</span>
              <time dateTime={article.updatedAt}>Updated {article.updatedAt}</time>
              <span>·</span>
              <span>{article.readingTime} read</span>
            </div>
          </header>

          <Image
            src={cover.src}
            alt={cover.alt}
            width={1200}
            height={630}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="mb-8 h-auto w-full rounded-xl border border-border/60"
          />

          <nav aria-label="Table of contents" className="mb-8 rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="mb-2 text-sm font-semibold">On this page</p>
            <ul className="space-y-1">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed">{article.content.intro}</p>

            {article.toolLinks && article.toolLinks.length > 0 && (
              <section className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 not-prose">
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-primary" aria-hidden="true" />
                  Apply it in StockVantex
                </h2>
                <div className="flex flex-col gap-1.5">
                  {article.toolLinks.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {tool.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {article.content.sections.map((section, i) => (
              <section key={i} className="mt-8">
                <h2 id={slugifyHeading(section.heading)} className="mb-3 scroll-mt-24 text-xl font-bold">
                  {section.heading}
                </h2>
                {section.content && <p className="text-muted-foreground leading-relaxed">{section.content}</p>}
                {section.paragraphs?.map((paragraph, pi) => (
                  <p key={pi} className="mt-3 text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {section.list &&
                  (section.list.ordered ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground leading-relaxed">
                      {section.list.items.map((item, li) => (
                        <li key={li}>{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed">
                      {section.list.items.map((item, li) => (
                        <li key={li}>{item}</li>
                      ))}
                    </ul>
                  ))}
                {section.afterList && (
                  <p className="mt-3 text-muted-foreground leading-relaxed">{section.afterList}</p>
                )}
                {section.subsections?.map((sub, j) => (
                  <div key={j} className="mt-4 ml-4">
                    <h3 className="text-lg font-semibold mb-2">{sub.heading}</h3>
                    <p className="text-muted-foreground leading-relaxed">{sub.content}</p>
                  </div>
                ))}
              </section>
            ))}

            <section className="mt-8">
              <h2 id="key-takeaways" className="mb-3 scroll-mt-24 text-xl font-bold">
                Key Takeaways
              </h2>
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
                <h2 id="frequently-asked-questions" className="mb-3 scroll-mt-24 text-xl font-bold">
                  Frequently Asked Questions
                </h2>
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

            {article.resources && article.resources.length > 0 && (
              <section className="mt-8">
                <h2 id="further-reading" className="mb-3 scroll-mt-24 text-xl font-bold">
                  Further Reading
                </h2>
                <ul className="space-y-2">
                  {article.resources.map((resource) => (
                    <li key={resource.href} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      {resource.external ? (
                        <a
                          href={resource.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {resource.label}
                        </a>
                      ) : (
                        <Link href={resource.href} className="text-primary hover:underline">
                          {resource.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8 rounded-lg border border-border/60 bg-muted/30 p-4">
              <h3 className="font-semibold mb-2 text-sm">Important Limitations</h3>
              <p className="text-xs text-muted-foreground">{article.content.limitations}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Educational content only, not investment advice.{' '}
                <Link href="/disclaimer" className="text-primary hover:underline">Financial disclaimer</Link>
              </p>
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
