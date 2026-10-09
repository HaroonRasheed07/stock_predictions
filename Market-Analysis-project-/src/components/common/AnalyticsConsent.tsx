'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GoogleAnalytics } from '@next/third-parties/google';

/** Public GA4 measurement identifier (not a secret); env var takes precedence. */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-87F1WZ9KPF';

/** Browser-local record of the visitor's analytics choice. */
const CONSENT_STORAGE_KEY = 'sv-analytics-consent';

type Consent = 'granted' | 'denied';

/**
 * Consent-gated Google Analytics 4, mounted once in the root layout.
 *
 * - Nothing from Google is loaded (and no request is made) until the visitor
 *   explicitly clicks "Allow analytics"; declining keeps GA fully unloaded.
 * - Initial `page_view`: fired once by the gtag config command when the
 *   GoogleAnalytics component mounts after consent.
 * - Client-side navigation: gtag.js's built-in history tracking
 *   (pushState/replaceState/popstate) sends exactly one page_view per route
 *   transition on its own. The app must NOT emit a manual page_view event —
 *   that would double every navigation (verified by ga-browser-test).
 * - No personal, portfolio, or financial data is ever passed to GA.
 */
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [mounted, setMounted] = useState(false);

  // Restore the stored decision after mount (avoids hydration mismatch).
  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored === 'granted' || stored === 'denied') setConsent(stored);
    } catch {
      // Storage unavailable: the banner simply stays up; GA stays off.
    }
  }, []);

  const decide = (choice: Consent) => {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // Still apply the choice for this session even if storage is blocked.
    }
    setConsent(choice);
  };

  return (
    <>
      {consent === 'granted' && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
      {mounted && consent === null && (
        <div
          role="region"
          aria-label="Analytics consent"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[26rem] z-[60] rounded-xl border border-border/60 bg-card p-4 shadow-xl"
        >
          <p className="text-sm text-muted-foreground mb-3">
            We&apos;d like to use Google Analytics to count anonymous page views and
            improve StockVantex. It loads only if you allow it — no ads, no personal
            or financial data. Details in our{' '}
            <Link href="/privacy" className="underline text-foreground hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => decide('denied')}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => decide('granted')}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Allow analytics
            </button>
          </div>
        </div>
      )}
    </>
  );
}
