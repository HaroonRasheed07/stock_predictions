import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { getArticle } from '@/lib/learn-articles';

const TEASER_SLUGS = [
  'what-is-technical-analysis',
  'what-is-stock-sentiment',
  'how-lstm-forecasting-works',
];

/** Section 11 — three static guide teasers (guides themselves are frozen). */
export function LearnTeasers() {
  const articles = TEASER_SLUGS.map((slug) => getArticle(slug)).filter(
    (a): a is NonNullable<typeof a> => Boolean(a)
  );

  return (
    <section id="learn" aria-labelledby="learn-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id="learn-heading" className="text-xl font-semibold md:text-2xl">
            Learn the methods behind the numbers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plain-language guides to every reading on this site.
          </p>
        </div>
        <Link href="/learn" className="shrink-0 text-sm font-medium text-primary hover:underline">
          All guides
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/learn/${a.slug}`}
            className="group rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {a.readingTime}
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-snug group-hover:text-primary">{a.title}</h3>
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{a.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Read the guide <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
