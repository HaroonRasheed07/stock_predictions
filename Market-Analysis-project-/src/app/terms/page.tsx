import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Terms and Conditions | ${SITE_NAME}` },
  description: `The rules, disclaimers, and limitations that apply when you use ${SITE_NAME}'s research, forecasts, and educational content.`,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Terms and Conditions | ${SITE_NAME}`,
    description: `The rules, disclaimers, and limitations that apply when you use ${SITE_NAME}'s research, forecasts, and educational content.`,
    url: `${SITE_URL}/terms`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function TermsPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms and Conditions',
    url: `${SITE_URL}/terms`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective date: October 8, 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of these terms</h2>
              <p>
                By using {SITE_NAME} (the &quot;platform&quot;), you agree to these Terms and Conditions. If you
                do not agree, please do not use the platform. These terms apply to every page and feature of the
                platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. The service</h2>
              <p>
                {SITE_NAME} is an independent stock research and education platform. It offers factual market
                overviews and watchlists, technical analysis indicators, news sentiment analysis, risk analysis,
                opportunity discovery, per-stock research pages, AI-assisted forecasting tools, and educational
                articles. A description of how the analysis tools work is published on the{' '}
                <Link href="/methodology" className="text-primary hover:underline">methodology page</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Permitted use</h2>
              <p>
                You may view, browse, and link to the platform&apos;s pages for personal, non-commercial purposes.
                Automated access should respect the rules published in our{' '}
                <Link href="/robots.txt" className="text-primary hover:underline">robots.txt</Link>. You may
                maintain a personal watchlist on your own device.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Prohibited misuse</h2>
              <p>
                You may not scrape the platform at abusive rates, disrupt or overload its operation, attempt to
                bypass access controls, reverse-engineer or extract the underlying models, re-publish our
                educational articles as your own, impersonate any person or entity, introduce malicious code, or
                use the platform for any unlawful purpose or to provide regulated financial services to others.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Financial information and research limitations</h2>
              <p>
                All content on the platform — including technical indicators, sentiment scores, risk assessments,
                forecasts, briefs, discovery lists, research summaries, and learn articles — is provided for
                general education and research only. Nothing on the platform is personalized investment advice, a
                recommendation, or an offer or solicitation to buy or sell any security. You are solely responsible
                for your own financial decisions, and you should consult a suitably qualified professional before
                investing. Read the full{' '}
                <Link href="/disclaimer" className="text-primary hover:underline">Financial Disclaimer</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Data accuracy and availability</h2>
              <p>
                Market data may be delayed, incomplete, or temporarily unavailable, and displayed prices can become
                stale. We do not warrant the accuracy, completeness, or timeliness of any figure shown on the
                platform. You should verify data with an independent source before acting on it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Forecasting limitations</h2>
              <p>
                Forecast outputs are statistical estimates produced by machine-learning models from historical
                data. They are inherently uncertain, are not predictions of future performance, and must not be
                treated as promises. Past performance does not guarantee future results.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Third-party market data and news</h2>
              <p>
                News headlines, market data, and links are provided by third-party publishers and data providers.
                Their content, accuracy, and availability are outside our control, their material is subject to
                their own terms, and their trademarks belong to their respective owners.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Intellectual property</h2>
              <p>
                The {SITE_NAME} name, logo, interface, and original educational content are owned by the
                platform&apos;s creator. Market data and news snippets remain the property of their respective
                data providers and publishers. You may not use our marks in a way that suggests affiliation or
                endorsement without written permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. User-submitted content</h2>
              <p>
                The platform does not host public posts, comments, or uploads. If you contact us by email, you
                agree that your message may be stored and processed as described in our{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. You must not
                send content you do not have the right to share.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">11. Service availability and changes</h2>
              <p>
                We may modify, suspend, or discontinue any part of the platform at any time, without notice. The
                platform is provided on an &quot;as available&quot; basis, and we do not guarantee uninterrupted or
                error-free operation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">12. Third-party links</h2>
              <p>
                The platform links to external websites, including news publishers and our social profiles. We are
                not responsible for the content, products, or practices of any third-party sites.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">13. Disclaimers of warranty</h2>
              <p>
                The platform is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any
                kind, whether express or implied, including implied warranties of merchantability, fitness for a
                particular purpose, and non-infringement, to the maximum extent permitted by applicable law. We do
                not warrant that the platform will meet your requirements or that any output will be accurate or
                reliable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">14. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by applicable law, the creator and operators of {SITE_NAME} are not
                liable for any indirect, incidental, special, consequential, or punitive loss or damage — including
                lost profits or investment losses — arising from use of, or inability to use, the platform or
                reliance on any information it displays. Nothing in these terms excludes or limits liability that
                cannot be excluded or limited under applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">15. Changes to these terms</h2>
              <p>
                These terms may be updated from time to time by revising this page with a new effective date.
                Continued use of the platform after changes means you accept the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">16. Contact</h2>
              <p>
                Questions about these terms can be emailed to{' '}
                <a href="mailto:haroon@stockvantex.com" className="text-primary hover:underline">haroon@stockvantex.com</a>{' '}
                or sent through the <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
                See also our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{' '}
                <Link href="/disclaimer" className="text-primary hover:underline">Financial Disclaimer</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
