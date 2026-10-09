import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `Privacy Policy | ${SITE_NAME}` },
  description: `How ${SITE_NAME} handles watchlist data, cookies, analytics, server logs, market data, and any information you share with us.`,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Privacy Policy | ${SITE_NAME}`,
    description: `How ${SITE_NAME} handles watchlist data, cookies, analytics, server logs, market data, and any information you share with us.`,
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
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Who we are</h2>
              <p>
                {SITE_NAME} ({SITE_URL}) is a stock research and education platform created and developed by
                Haroon Rasheed. It provides market overviews, watchlists, technical analysis, news sentiment,
                risk analysis, opportunity discovery, forecasts, and educational articles. This policy explains
                what the platform stores, what it does not store, and what third parties process when you use
                the site.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Information you choose to provide</h2>
              <p>
                The platform has no accounts, no registration, and no contact form. If you want to reach us, you
                can email us at{' '}
                <a href="mailto:haroon@stockvantex.com" className="text-primary hover:underline">haroon@stockvantex.com</a>{' '}
                using your own email program. We then receive only what you choose to send: your email address and
                the contents of your message. We use that information to respond to you and nothing else. We do not
                add you to any mailing list, because the platform has no mailing list.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. What we do not collect</h2>
              <p>
                You do not need to give us your name, phone number, payment details, or any other personal
                information to browse the platform. We do not operate user databases or profiles, we do not run
                accounts or logins, and we do not sell, rent, or share personal information with advertisers — we
                have no advertising on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Watchlist and preferences stored on your device</h2>
              <p>
                Features that remember your choices — your watchlist, the stock you last viewed, your theme
                preference, and your crypto view preference — are saved in your browser&apos;s local storage on
                your own device. This data is never transmitted to us; there is no server-side copy of your
                watchlist. It is device-specific, so it does not follow you to other browsers or computers.
                You can remove it at any time by clearing your browser&apos;s site data for {SITE_NAME}.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Cookies</h2>
              <p>
                The platform sets one functional cookie: <code className="text-foreground">sidebar:state</code>,
                which remembers whether the navigation sidebar is open and expires after seven days. Your
                analytics choice is stored in this browser&apos;s local storage under{' '}
                <code className="text-foreground">sv-analytics-consent</code>, and a short-lived record of the
                consent tier derived from your connection&apos;s country is stored under{' '}
                <code className="text-foreground">sv-analytics-region</code> (refreshed at most every 30 days).
                Non-essential measurement cookies are set only by Google Analytics when analytics is active
                for your visit — after you allow it in regions that require prior consent, or by default in
                regions where it may run until you opt out. We do not set advertising, marketing, or
                cross-site tracking cookies. Hosting and analytics providers may use strictly necessary or
                performance cookies to deliver their services; those uses are governed by the providers&apos; own
                policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Analytics and performance</h2>
              <p>
                The site uses Vercel Analytics and Vercel Speed Insights to understand aggregate traffic and page
                performance (for example, which pages are slow). These tools collect anonymous, aggregated usage
                statistics and do not build advertising profiles.
              </p>
              <p className="mt-3">
                We also use Google Analytics 4 to count aggregate page views (measurement ID{' '}
                <code className="text-foreground">G-87F1WZ9KPF</code>). It receives no personal information,
                portfolio holdings, or financial data, and no advertising features are enabled. Whether and
                when it loads depends on where you are:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <span className="text-foreground">Regions that require prior consent</span> (including the
                  EU/EEA, the UK, Switzerland, Canada, and several other jurisdictions — the full list is in{' '}
                  <code className="text-foreground">src/lib/consent-region.ts</code>): a minimal one-time
                  notice appears, and Google Analytics is not requested at all — no script, no cookie — until
                  you click &quot;Allow analytics&quot;. Declining keeps it unloaded.
                </li>
                <li>
                  <span className="text-foreground">All other regions</span>: analytics may be enabled by
                  default where applicable law permits it, and you can turn it off at any time with the
                  footer&apos;s <span className="text-foreground">Privacy Settings</span>. Disabling takes effect
                  immediately (the tag is stopped, its cookies are removed, and it stays off on future visits).
                </li>
                <li>
                  If your browser sends a Global Privacy Control signal, analytics stays off by default
                  everywhere; you can still enable it yourself in Privacy Settings.
                </li>
              </ul>
              <p className="mt-3">
                The country used for this decision comes from the hosting edge (Vercel&apos;s own request
                header) and never leaves our platform — no third-party geolocation service is queried. If the
                country cannot be determined, we fail closed and treat the visit as requiring prior consent.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Server logs</h2>
              <p>
                Like most websites, the platform is delivered through hosting providers (Vercel for the frontend,
                Render for the backend service). When a request reaches them, their systems automatically record
                technical details such as your IP address, the page requested, the time, and your browser&apos;s
                user agent. Our backend service also keeps ordinary operational logs of API requests. These logs
                are used to deliver the service, diagnose errors, and protect against abuse — not to build
                profiles of visitors.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Market and news data</h2>
              <p>
                Price, technical, and risk data come from public market data sources retrieved through our backend
                service. News sentiment is computed from articles provided by third-party news data providers.
                Those providers process article content under their own privacy policies. Article headlines shown
                on the site link to the original publisher.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Third-party links</h2>
              <p>
                News headlines, learn-article references, and social links point to external websites. We are not
                responsible for the content or privacy practices of those sites.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. Data retention</h2>
              <p>
                Because there are no accounts, we hold almost nothing about you. Email correspondence you send us
                is kept only as long as needed to handle your request and maintain ordinary records. Server logs
                are retained for operational periods set by our hosting providers&apos; configurations. If you want
                correspondence you sent us deleted, ask us using the contact details below and we will remove it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">11. Security</h2>
              <p>
                The platform is served over HTTPS, so data in transit between your browser and the site is
                encrypted in transit. No method of transmitting or storing information over the Internet is
                completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">12. Your choices and rights</h2>
              <p>
                You can browse the platform without providing any personal information. You can clear the watchlist
                and preference data and the functional cookie at any time through your browser&apos;s settings.
                Analytics can be turned on or off at any time from{' '}
                <span className="text-foreground">Privacy Settings</span> in the footer — disabling stops Google
                Analytics immediately, removes its cookies, and is remembered on this device. If
                you have emailed us, you may ask what information we hold about you, request correction or
                deletion, or ask questions about this policy by contacting us below, and we will respond to your
                request.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">13. International visitors</h2>
              <p>
                The platform is accessible worldwide. To decide whether prior consent is needed before analytics
                loads, we read your connection&apos;s coarse country from the hosting edge (Vercel&apos;s request
                header) on our own infrastructure; the result is cached in your browser&apos;s local storage and
                no third-party geolocation service is used. Hosting and analytics providers may process technical
                information in countries other than your own, under their own terms and privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">14. Children&apos;s privacy</h2>
              <p>
                The platform is intended for a general audience interested in financial education. We do not
                knowingly collect information from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">15. Changes to this policy</h2>
              <p>
                If the platform&apos;s data practices change, this page will be updated with a revised effective
                date. Continued use of the platform after changes means you accept the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">16. Contact</h2>
              <p>
                Questions about this policy can be emailed to{' '}
                <a href="mailto:haroon@stockvantex.com" className="text-primary hover:underline">haroon@stockvantex.com</a>,
                sent through the <Link href="/contact" className="text-primary hover:underline">contact page</Link>,
                or raised via our social links on that page. See also our{' '}
                <Link href="/terms" className="text-primary hover:underline">Terms and Conditions</Link> and{' '}
                <Link href="/disclaimer" className="text-primary hover:underline">Financial Disclaimer</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
