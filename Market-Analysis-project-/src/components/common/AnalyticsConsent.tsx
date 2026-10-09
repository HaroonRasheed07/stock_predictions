'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ConsentTier } from '@/lib/consent-region';
import {
  CONSENT_CHANGED_EVENT,
  GA_MEASUREMENT_ID,
  OPEN_SETTINGS_EVENT,
  type ConsentChoice,
  applyOptOutRuntime,
  clearOptOutRuntime,
  globalPrivacyControl,
  readConsent,
  resolveConsentTier,
  writeConsent,
} from '@/lib/analytics-consent';

/**
 * Regional analytics gate, mounted once in the root layout.
 *
 * Visitor flow:
 *  - Tier is resolved from /api/region (Vercel edge country, fail-closed):
 *      strict  → prior consent required: a minimal one-time notice appears
 *                and Google Analytics stays completely unloaded until the
 *                visitor clicks "Allow analytics".
 *      standard → analytics is allowed by default where law does not require
 *                prior consent; visitors opt out any time via the footer's
 *                Privacy Settings. A Global Privacy Control signal is honoured
 *                as an opt-out everywhere.
 *  - Initial page_view: fired once by the gtag config command when the
 *    GoogleAnalytics component mounts (on load or first grant).
 *  - Client-side navigation: gtag.js's built-in history tracking
 *    (pushState/replaceState/popstate) sends exactly one page_view per route
 *    transition on its own. The app must NOT emit a manual page_view event —
 *    that would double every navigation (verified by ga-browser-test).
 *  - Re-enabling after an opt-out reloads the page so gtag initializes once.
 *  - No personal, portfolio, or financial data is ever passed to GA.
 */
export function AnalyticsConsent() {
  const [mounted, setMounted] = useState(false);
  const [tier, setTier] = useState<ConsentTier | 'unknown'>('unknown');
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [gpc, setGpc] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gaEverMountedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setChoice(readConsent());
    setGpc(globalPrivacyControl());

    let cancelled = false;
    resolveConsentTier().then(({ tier: resolved }) => {
      if (!cancelled) setTier(resolved);
    });

    const onChanged = () => setChoice(readConsent());
    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChanged);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChanged);
      window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    };
  }, []);

  // 'on'  — analytics allowed (explicit grant, or default in standard tier)
  // 'off' — declined / GPC signal / tier not yet resolved
  // 'ask' — strict tier with no decision yet (notice shown, GA never loaded)
  const effective: 'on' | 'off' | 'ask' =
    choice === 'granted'
      ? 'on'
      : choice === 'denied'
        ? 'off'
        : gpc
          ? 'off'
          : tier === 'standard'
            ? 'on'
            : tier === 'strict'
              ? 'ask'
              : 'off';

  const gaActive = effective === 'on';
  useEffect(() => {
    if (gaActive) gaEverMountedRef.current = true;
  }, [gaActive]);

  const decide = (next: ConsentChoice) => {
    if (next === 'granted' && gaEverMountedRef.current) {
      clearOptOutRuntime();
      writeConsent('granted');
      window.location.reload();
      return;
    }
    if (next === 'denied') applyOptOutRuntime();
    else clearOptOutRuntime();
    writeConsent(next);
    setSettingsOpen(false);
    if (next === 'granted') toast.success('Analytics enabled');
    else toast('Analytics disabled — you can re-enable it any time in Privacy Settings');
  };

  const bannerVisible = mounted && effective === 'ask';

  return (
    <>
      {gaActive && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}

      {bannerVisible && (
        <div
          role="region"
          aria-label="Analytics consent"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[24rem] z-[60] rounded-lg border border-border/60 bg-card p-3 shadow-lg"
        >
          <p className="text-xs leading-relaxed text-muted-foreground mb-2.5">
            We&apos;d like to use Google Analytics to count anonymous page views and improve
            StockVantex. Nothing loads unless you allow it — no ads, no personal or financial
            data. Details in our{' '}
            <Link href="/privacy" className="underline text-foreground hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => decide('denied')}
              className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => decide('granted')}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Allow analytics
            </button>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Privacy Settings</DialogTitle>
            <DialogDescription>
              Manage how StockVantex measures anonymous usage. Google Analytics counts page
              views only — no personal, portfolio, or financial data is ever sent, and no
              advertising cookies are set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Google Analytics</span>
              <span
                className={`text-sm font-medium ${
                  effective === 'on'
                    ? 'text-emerald-500'
                    : effective === 'ask'
                      ? 'text-amber-500'
                      : 'text-muted-foreground'
                }`}
              >
                {effective === 'on' ? 'Enabled' : effective === 'ask' ? 'Awaiting your choice' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Depending on your location, analytics may require your consent before it loads,
              or may be enabled by default with this opt-out. Your choice is stored on this
              device only.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Link
              href="/privacy"
              className="rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Privacy Policy
            </Link>
            {effective !== 'on' && (
              <button
                type="button"
                onClick={() => decide('granted')}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Enable analytics
              </button>
            )}
            {effective !== 'off' && (
              <button
                type="button"
                onClick={() => decide('denied')}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Disable analytics
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
