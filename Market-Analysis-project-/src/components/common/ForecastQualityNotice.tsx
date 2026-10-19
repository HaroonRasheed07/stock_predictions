import Link from 'next/link';
import { Info } from 'lucide-react';

/**
 * Calm, informational state shown when the server-side quality guard withheld
 * a forecast (ForecastQualityError). This is an expected outcome — never
 * styled or announced as an error, and never logged as one.
 */
export function ForecastQualityNotice({ ticker }: { ticker: string }) {
  const base = `/stocks/${ticker.toLowerCase()}`;
  const linkCls =
    'inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs sm:text-sm text-foreground hover:border-primary/30 hover:text-primary transition-colors';

  return (
    <div
      role="status"
      aria-label="Forecast withheld by quality checks"
      className="rounded-xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <p className="text-sm font-semibold flex items-center gap-2">
        <Info className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
        Forecast not shown today
      </p>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Our model's projection for {ticker} didn't pass quality checks today, so we're not showing
        it. Technical, risk and sentiment analysis remain available.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`${base}?view=technical`} className={linkCls}>
          Technical analysis
        </Link>
        <Link href={`${base}?view=risk`} className={linkCls}>
          Risk assessment
        </Link>
        <Link href="/methodology" className={linkCls}>
          Methodology
        </Link>
      </div>
    </div>
  );
}
