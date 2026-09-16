import { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { learnArticles } from '@/lib/learn-articles';
import { BookOpen, ArrowRight, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Free educational guides on technical analysis, market sentiment, risk assessment, and AI-powered stock forecasting.',
  alternates: { canonical: `${SITE_URL}/learn` },
  openGraph: { title: `Learn | ${SITE_NAME}`, description: 'Free educational guides on stock analysis.', url: `${SITE_URL}/learn` },
};

export default function LearnPage() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-14 md:top-16 z-30">
        <div className="container mx-auto px-4 py-2">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Learn' }]} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Learn</h1>
          <p className="text-muted-foreground mt-1">Educational guides to help you understand stock analysis.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {learnArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="group rounded-xl border border-border/50 bg-card p-5 hover:shadow-md hover:border-primary/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{article.category}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{article.readTime}</span>
              </div>
              <h2 className="text-sm font-bold group-hover:text-primary transition-colors">{article.title}</h2>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{article.description}</p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 font-medium">
                Read <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
