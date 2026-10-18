/**
 * GA4 event helper.
 *
 * GA is loaded only by src/components/common/AnalyticsConsent.tsx after a
 * granted regional tier, so window.gtag is undefined until then and every
 * call is a no-op — same guarantee the consent gate gives page views.
 * Never call this with personal data (GA4 policy + consent scope).
 */
type EventValue = string | number | boolean;

export function trackEvent(name: string, params?: Record<string, EventValue>): void {
  if (typeof window === 'undefined') return;
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') gtag('event', name, params ?? {});
  } catch {
    // Analytics must never break the product.
  }
}
