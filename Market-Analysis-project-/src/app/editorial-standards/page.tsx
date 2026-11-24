import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Editorial Standards & Corrections | ${SITE_NAME}` },
  description: `How ${SITE_NAME} owns, reviews, publishes and corrects research content. No credentials, reviewers or accuracy claims are implied.`,
  alternates: { canonical: `${SITE_URL}/editorial-standards` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Editorial Standards & Corrections | ${SITE_NAME}`,
    description: `Our ownership, evidence, review and correction policies for public research content.`,
    url: `${SITE_URL}/editorial-standards`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function EditorialStandardsPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Trust &amp; accountability</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Editorial Standards &amp; Corrections</h1>
          <p className="text-muted-foreground">
            This page explains who is responsible for content on {SITE_NAME}, what evidence standards we
            apply, and how factual errors are reported and corrected. Last reviewed: 24 November 2026.
          </p>
        </header>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
          <h2 className="text-xl font-bold">Ownership and responsibility</h2>
          <p className="text-sm text-muted-foreground">
            {SITE_NAME} is created and maintained by Haroon Rasheed, who is publicly identified on the
            About page as the AI Developer &amp; Creator of the project. He is responsible for technical
            explanations, indicator definitions, model descriptions, data-pipeline disclosures and public
            corrections.
          </p>
          <p className="text-sm text-muted-foreground">
            No editorial board, licensed analyst, certified financial adviser, external reviewer or
            independent audit is claimed. Where a technical claim is made, it is checked against the
            application source code and tests rather than against an unverified external authority.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold">Evidence standards</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Technical and financial claims are separated. A technical description is not financial advice.</li>
            <li>Data freshness is described as snapshot refresh time, not a verified exchange quote timestamp.</li>
            <li>Model outputs are described as point estimates. No confidence interval, probability or accuracy superiority is implied unless a reproducible out-of-sample result is published.</li>
            <li>In-sample fit is labelled as a reconstruction proxy and is never presented as forecast accuracy.</li>
            <li>Missing data, provider failures and insufficient news coverage are displayed as limitations rather than replaced with neutral or bullish defaults.</li>
            <li>Educational articles distinguish general concepts from the specific implementation used by {SITE_NAME}.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold">Review status</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-4 font-semibold">Area</th>
                  <th className="py-2 font-semibold">Current status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="py-2 pr-4">Indicator and risk definitions</td>
                  <td className="py-2">Documented against source code; known differences from canonical variants are disclosed.</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 pr-4">Forecast validation</td>
                  <td className="py-2">Limited chronological holdout report for AAPL and MSFT only; no walk-forward fold results or calibrated uncertainty published.</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 pr-4">News sentiment</td>
                  <td className="py-2">Provider sentiment tags with deterministic keyword fallback; no FinBERT or social-media data used in production.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Financial review</td>
                  <td className="py-2">No independent financial or regulatory review has been obtained.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
          <h2 className="text-xl font-bold">Publishing and revisions</h2>
          <p className="text-sm text-muted-foreground">
            Methodology and educational pages include revision context where material. A change that
            alters a displayed number, formula, forecast horizon or data-source description is treated as
            material and is logged below. Routine wording and accessibility changes may not be logged
            individually.
          </p>
          <p className="text-sm text-muted-foreground">
            Pages are reviewed when the related implementation changes, when a user reports a possible
            error, or when a provider or model artifact changes. This is a best-effort process, not a
            guaranteed publication schedule.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
          <h2 className="text-xl font-bold">Report a correction</h2>
          <p className="text-sm text-muted-foreground">
            Email <a className="text-primary hover:underline" href="mailto:haroon@stockvantex.com?subject=Correction%20request">haroon@stockvantex.com</a>{' '}
            with the subject <strong>Correction request</strong>. Include the page URL, the exact wording
            or number you believe is wrong, the evidence you are relying on, and the date you observed it.
          </p>
          <p className="text-sm text-muted-foreground">
            Confirmed factual errors are corrected in place, dated in the log below and, where material,
            called out on the affected page. We do not remove a correction entry to make the record look
            cleaner.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold">Correction log</h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">24 November 2026 — Public claim alignment</p>
              <p>
                Replaced “accurate price predictions”, “probabilistic projections with confidence
                ranges”, “live feeds active”, “real-time market data” and “language models trained on
                financial text” with point-estimate, cached-snapshot and provider-tag wording.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">24 November 2026 — Forecast terminology</p>
              <p>
                Corrected forecast-date language from exchange-holiday alignment to weekday-only
                business-day generation, relabelled “Overall Accuracy” as a historical signal hit rate,
                and labelled the MAPE-derived figure as an in-sample fit proxy.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">24 November 2026 — Validation disclosure</p>
              <p>
                Stated that no walk-forward fold results, no out-of-sample error table, no directional
                baseline comparison and no calibrated confidence intervals are published.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 space-y-3">
          <h2 className="text-xl font-bold">Not investment advice</h2>
          <p className="text-sm text-muted-foreground">
            Nothing on {SITE_NAME} is personalized investment advice. Outputs are research inputs for
            your own judgment. Read the{' '}
            <Link href="/disclaimer" className="text-primary hover:underline">financial disclaimer</Link>{' '}
            and{' '}
            <Link href="/methodology" className="text-primary hover:underline">methodology</Link>{' '}
            before relying on any figure shown here.
          </p>
        </section>
      </div>
    </div>
  );
}
