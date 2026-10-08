import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Terms of Use | ${SITE_NAME}` },
  description: `The rules and disclaimers that apply when you use ${SITE_NAME}'s research, forecasts, and educational content.`,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Terms of Use | ${SITE_NAME}`,
    description: `The rules and disclaimers that apply when you use ${SITE_NAME}'s research, forecasts, and educational content.`,
    url: `${SITE_URL}/terms`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function TermsPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Use',
    url: `${SITE_URL}/terms`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Use</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective date: October 8, 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Acceptance</h2>
              <p>
                By using {SITE_NAME} (the &quot;platform&quot;), you agree to these terms. If you do not agree, please
                do not use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Educational purpose — not financial advice</h2>
              <p>
                All content on the platform — including technical indicators, sentiment scores, risk assessments,
                forecasts, briefs, and learn articles — is provided for general education and research only. Nothing
                on the platform is investment advice, a recommendation, or an offer to buy or sell any security. You
                are solely responsible for your own financial decisions, and you should consult a qualified professional
                before investing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">No guarantees on data or forecasts</h2>
              <p>
                Market data may be delayed, incomplete, or temporarily unavailable. Forecast outputs are statistical
                estimates produced by machine-learning models from historical data; they are inherently uncertain and
                are not predictions of future performance. Past performance does not guarantee future results. We do
                not warrant the accuracy, completeness, or timeliness of any figure shown on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Third-party content</h2>
              <p>
                News headlines and links are provided by third-party publishers and data providers. Their content,
                accuracy, and availability are outside our control, and their trademarks belong to their respective
                owners.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Permitted use</h2>
              <p>
                You may view and link to the platform&apos;s pages for personal, non-commercial purposes. You may not
                scrape the platform at abusive rates, disrupt its operation, attempt to bypass access controls, or
                re-publish our educational articles as your own. Automated access should respect the rules published in
                our <Link href="/robots.txt" className="text-primary hover:underline">robots.txt</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Intellectual property</h2>
              <p>
                The {SITE_NAME} name, logo, and original educational content are owned by the platform&apos;s creator.
                Market data and news snippets remain the property of their respective data providers and publishers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Limitation of liability</h2>
              <p>
                The platform is provided &quot;as is&quot; without warranties of any kind. To the maximum extent
                permitted by law, the creator and operators of {SITE_NAME} are not liable for any loss or damage —
                including lost profits or investment losses — arising from use of, or inability to use, the platform
                or reliance on any information it displays.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Changes</h2>
              <p>
                These terms may be updated from time to time by revising this page with a new effective date.
                Continued use of the platform after changes means you accept the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
              <p>
                Questions about these terms can be sent through the{' '}
                <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
