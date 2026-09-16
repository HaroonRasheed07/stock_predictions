import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { learnArticles, getArticleBySlug } from '@/lib/learn-articles';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { BreadcrumbJsonLd } from '@/components/seo/StructuredData';
import Link from 'next/link';
import { ArrowRight, Clock, Calendar } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return learnArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const canonical = `${SITE_URL}/learn/${article.slug}`;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical },
    openGraph: { title: article.title, description: article.description, url: canonical, type: 'article', siteName: SITE_NAME },
    twitter: { card: 'summary_large_image', title: article.title, description: article.description },
  };
}

export default async function LearnArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const canonical = `${SITE_URL}/learn/${article.slug}`;
  const breadcrumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Learn', url: `${SITE_URL}/learn` },
    { name: article.title, url: canonical },
  ];

  const paragraphs = article.content.split('\n\n');

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <div className="min-h-screen">
        <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-14 md:top-16 z-30">
          <div className="container mx-auto px-4 py-2">
            <Breadcrumbs items={[
              { label: 'Home', href: '/' },
              { label: 'Learn', href: '/learn' },
              { label: article.title },
            ]} />
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 sm:py-8">
          <article className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{article.category}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTime}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold mb-3">{article.title}</h1>
            <p className="text-muted-foreground mb-6">{article.description}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8 pb-6 border-b border-border/40">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Published {article.publishDate}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Updated {article.updatedDate}</span>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
              {paragraphs.map((p, i) => {
                if (p.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-8 mb-3">{p.replace('## ', '')}</h2>;
                if (p.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-6 mb-2">{p.replace('### ', '')}</h3>;
                if (p.startsWith('|')) {
                  const rows = p.split('\n').filter((r) => !r.match(/^\|[-\s|]+\|$/));
                  const headers = rows[0]?.split('|').filter(Boolean).map((h) => h.trim()) || [];
                  const dataRows = rows.slice(1).map((r) => r.split('|').filter(Boolean).map((c) => c.trim()));
                  return (
                    <div key={i} className="overflow-x-auto my-4">
                      <table className="w-full text-sm border border-border/40 rounded-lg overflow-hidden">
                        <thead><tr className="bg-muted/30">{headers.map((h, j) => <th key={j} className="text-left px-3 py-2 font-medium text-xs">{h}</th>)}</tr></thead>
                        <tbody>{dataRows.map((row, j) => <tr key={j} className="border-t border-border/30">{row.map((cell, k) => <td key={k} className="px-3 py-2 text-xs">{cell}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  );
                }
                if (p.startsWith('- ') || p.startsWith('1. ')) {
                  const items = p.split('\n').filter(Boolean);
                  const isOrdered = p.startsWith('1.');
                  const Tag = isOrdered ? 'ol' : 'ul';
                  return (
                    <Tag key={i} className={isOrdered ? 'list-decimal list-inside space-y-1' : 'list-disc list-inside space-y-1'}>
                      {items.map((item, j) => <li key={j} className="text-sm">{item.replace(/^[-\d.]+\s*/, '')}</li>)}
                    </Tag>
                  );
                }
                return <p key={i} className="text-sm leading-relaxed">{p}</p>;
              })}
            </div>

            {/* Key Takeaways */}
            <div className="mt-8 p-5 rounded-xl border border-primary/20 bg-primary/5">
              <h3 className="text-sm font-bold mb-3">Key Takeaways</h3>
              <ul className="space-y-2">
                {article.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Related Tickers */}
            {article.relatedTickers.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold mb-3">Related Stocks</h3>
                <div className="flex gap-2 flex-wrap">
                  {article.relatedTickers.map((t) => (
                    <Link key={t} href={`/stocks/${t.toLowerCase()}`} className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors">
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </>
  );
}
