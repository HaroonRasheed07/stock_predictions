import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Privacy Policy | ${SITE_NAME}` },
  description: `How ${SITE_NAME} handles market data, analytics, and any information you share with us.`,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Privacy Policy | ${SITE_NAME}`,
    description: `How ${SITE_NAME} handles market data, analytics, and any information you share with us.`,
    url: `${SITE_URL}/privacy`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function PrivacyPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy',
    url: `${SITE_URL}/privacy`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective date: October 8, 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Overview</h2>
              <p>
                {SITE_NAME} is a stock research and education platform created by Haroon Rasheed. This policy explains
                what information the platform uses, what it stores, and what it does not do. The platform has no user
                accounts, no payment processing, and no advertising trackers of our own.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Information we do not collect</h2>
              <p>
                We do not ask for names, email addresses, phone numbers, or payment details to use the site. We do not
                sell, rent, or share personal information with advertisers, because we do not collect it in the first
                place.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Information stored on your device</h2>
              <p>
                Your watchlist, theme preference, and last-viewed ticker are stored in your browser&apos;s local storage.
                That data stays on your device and is never transmitted to us. You can clear it at any time through
                your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Market and news data</h2>
              <p>
                Price, technical, and risk data come from public market data sources retrieved through our backend
                service. News sentiment is computed from articles provided by third-party news data providers. Those
                providers process article content under their own privacy policies. Article headlines shown on the site
                link to the original publisher.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Analytics</h2>
              <p>
                The site uses Vercel Analytics and Vercel Speed Insights to understand aggregate traffic and page
                performance (for example, which pages are slow). These tools collect anonymous usage statistics and do
                not build advertising profiles. No third-party advertising or tracking scripts are included by us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Cookies</h2>
              <p>
                {SITE_NAME} does not set its own cookies. Hosting and analytics providers may use strictly necessary
                or performance cookies to deliver the service; their use is governed by their own policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">External links</h2>
              <p>
                News headlines, learn-articles references, and social links point to external websites. We are not
                responsible for the content or privacy practices of those sites.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Children&apos;s privacy</h2>
              <p>
                The platform is intended for a general adult audience interested in financial education. We do not
                knowingly collect information from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Changes to this policy</h2>
              <p>
                If the platform&apos;s data practices change, this page will be updated with a revised effective date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
              <p>
                Questions about this policy can be sent through the{' '}
                <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
