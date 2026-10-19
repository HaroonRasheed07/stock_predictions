import Link from 'next/link';

/** Section 12 — static, honest research framing. No offers, no counts. */
export function TrustStrip() {
  return (
    <section aria-labelledby="trust-heading" className="container mx-auto px-4 py-10 md:py-14">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
        <h2 id="trust-heading" className="text-lg font-semibold">
          Built for research, not recommendations
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          StockVantex shows its evidence: indicator inputs, news-sentiment drivers, model methodology, and
          risk factors are all documented so you can judge the reasoning yourself. Nothing on this site is
          personalized investment advice.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/methodology"
            className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/30 hover:text-primary"
          >
            Methodology
          </Link>
          <Link
            href="/learn"
            className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/30 hover:text-primary"
          >
            Learning guides
          </Link>
          <Link
            href="/disclaimer"
            className="rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/30 hover:text-primary"
          >
            Financial disclaimer
          </Link>
        </div>
      </div>
    </section>
  );
}
