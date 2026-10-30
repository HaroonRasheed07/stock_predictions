import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LineChart, Wrench } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { getArticle, getArticleCover, getAllArticleSlugs, type LearnContentBlock } from '@/lib/learn-articles';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

/** Renders inline **bold** and *italic* markers as real elements (plain text passes through). */
function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={key++}>{m[1]}</strong>);
    else nodes.push(<em key={key++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function DataTable({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {table.headers.map((header, i) => (
              <th key={i} className="py-2 pr-4 text-left font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/60">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 pr-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function BulletList({ list, mt = true }: { list: { ordered?: boolean; items: string[] }; mt?: boolean }) {
  const Tag: 'ol' | 'ul' = list.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${mt ? 'mt-3 ' : ''}space-y-2 pl-5 text-muted-foreground leading-relaxed ${list.ordered ? 'list-decimal' : 'list-disc'}`}>
      {list.items.map((item, li) => (
        <li key={li}><Inline text={item} /></li>
      ))}
    </Tag>
  );
}

function ContentBlockView({ block }: { block: LearnContentBlock }) {
  if (block.type === 'list' && block.items) return <BulletList list={{ ordered: block.ordered, items: block.items }} />;
  if (block.type === 'table' && block.headers && block.rows)
    return <DataTable table={{ headers: block.headers, rows: block.rows }} />;
  if (block.type === 'p' && block.text)
    return <p className="mt-3 text-muted-foreground leading-relaxed"><Inline text={block.text} /></p>;
  return null;
}

export default async function LearnArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const asTexts = (value?: string | string[]) =>
    value == null ? [] : Array.isArray(value) ? value : [value];

  const tableText = (table?: { headers: string[]; rows: string[][] }) =>
    table ? [...table.headers, ...table.rows.flat()].join(' ') : '';

  const blockText = (block: LearnContentBlock) =>
    block.type === 'p' ? (block.text ?? '')
    : block.type === 'list' ? (block.items ?? []).join(' ')
    : [...(block.headers ?? []), ...(block.rows ?? []).flat()].join(' ');

  const wordCount = [
    article.content.intro ?? '',
    ...(article.content.introParagraphs ?? []),
    ...article.content.sections.flatMap((section) => [
      section.content,
      ...(section.paragraphs ?? []),
      ...(section.list?.items ?? []),
      tableText(section.table),
      ...asTexts(section.afterList),
      ...(section.subsections?.flatMap((sub) => [
        sub.content,
        ...(sub.paragraphs ?? []),
        ...(sub.list?.items ?? []),
        tableText(sub.table),
        ...asTexts(sub.afterList),
      ]) ?? []),
      ...(section.blocks?.map(blockText) ?? []),
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
    ...(article.content.keyTakeaways.length > 0
      ? [{ id: 'key-takeaways', label: 'Key Takeaways' }]
      : []),
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
            {article.byline && (
              <p className="mt-2 text-sm italic text-muted-foreground">{article.byline}</p>
            )}
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

          <div className="prose prose-neutral dark:prose-invert">
            {article.content.intro && (
              <p className="text-lg leading-relaxed"><Inline text={article.content.intro} /></p>
            )}
            {article.content.introParagraphs?.map((paragraph, pi) => (
              <p key={pi} className="text-lg leading-relaxed"><Inline text={paragraph} /></p>
            ))}

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
                {section.content && (
                  <p className={i === 0 && !article.content.intro ? 'text-lg leading-relaxed' : 'text-muted-foreground leading-relaxed'}>
                    <Inline text={section.content} />
                  </p>
                )}
                {section.paragraphs?.map((paragraph, pi) => (
                  <p key={pi} className="mt-3 text-muted-foreground leading-relaxed">
                    <Inline text={paragraph} />
                  </p>
                ))}
                {section.list && <BulletList list={section.list} />}
                {section.table && <DataTable table={section.table} />}
                {section.subsections?.map((sub, j) => (
                  <div key={j} className="mt-4 ml-4">
                    <h3 className="text-lg font-semibold mb-2">{sub.heading}</h3>
                    {sub.content && (
                      <p className="text-muted-foreground leading-relaxed"><Inline text={sub.content} /></p>
                    )}
                    {sub.paragraphs?.map((paragraph, pi) => (
                      <p key={pi} className="mt-3 text-muted-foreground leading-relaxed">
                        <Inline text={paragraph} />
                      </p>
                    ))}
                    {sub.list && <BulletList list={sub.list} />}
                    {sub.table && <DataTable table={sub.table} />}
                    {sub.afterList &&
                      asTexts(sub.afterList).map((paragraph, ai) => (
                        <p key={ai} className="mt-3 text-muted-foreground leading-relaxed">
                          <Inline text={paragraph} />
                        </p>
                      ))}
                  </div>
                ))}
                {section.afterList &&
                  asTexts(section.afterList).map((paragraph, ai) => (
                    <p key={ai} className="mt-3 text-muted-foreground leading-relaxed">
                      <Inline text={paragraph} />
                    </p>
                  ))}
                {section.blocks?.map((block, bi) => (
                  <ContentBlockView key={bi} block={block} />
                ))}
              </section>
            ))}

            {article.content.keyTakeaways.length > 0 && (
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
            )}

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

            {article.relatedTools && article.relatedTools.length > 0 && (
              <section className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-4 not-prose">
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
                  Related tools
                </h2>
                <div className="flex flex-col gap-1.5">
                  {article.relatedTools.map((tool) => (
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
