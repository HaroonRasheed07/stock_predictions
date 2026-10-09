'use client';

/**
 * Shared analytics-consent state: localStorage persistence, cross-component
 * events, region-tier resolution, and applying an opt-out to an already
 * loaded Google tag (disable flag + Google Analytics cookie removal).
 *
 * No Google tag commands or tag-manager queues are used here (or anywhere in
 * src) — page_view ownership stays with the third-parties GoogleAnalytics
 * component's config plus history tracking, which is what prevents
 * duplicate events.
 */
import type { ConsentTier } from './consent-region';

/** Public GA4 measurement identifier (not a secret); env var takes precedence. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-87F1WZ9KPF';

export const CONSENT_STORAGE_KEY = 'sv-analytics-consent';
export const REGION_STORAGE_KEY = 'sv-analytics-region';

/** Fired (on window) whenever the stored consent choice changes. */
export const CONSENT_CHANGED_EVENT = 'sv:analytics-consent-changed';
/** Fired (on window) when the footer's Privacy Settings entry is activated. */
export const OPEN_SETTINGS_EVENT = 'sv:privacy-settings-open';

export type ConsentChoice = 'granted' | 'denied';

export interface RegionCache {
  country: string | null;
  tier: ConsentTier;
  ts: number;
}

const REGION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function readConsent(): ConsentChoice | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this page view via state.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
}

export function dispatchOpenSettings(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

/** Global Privacy Control — an explicit browser-level opt-out signal. */
export function globalPrivacyControl(): boolean {
  try {
    return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  } catch {
    return false;
  }
}

export function readRegionCache(): RegionCache | null {
  try {
    const raw = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegionCache;
    if (!parsed || (parsed.tier !== 'strict' && parsed.tier !== 'standard')) return null;
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > REGION_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolve the visitor's consent tier: cached value → /api/region → fail
 * closed to 'strict' (never fails open, never silently enables GA).
 */
export async function resolveConsentTier(): Promise<{ tier: ConsentTier; country: string | null }> {
  const cached = readRegionCache();
  if (cached) return { tier: cached.tier, country: cached.country };

  try {
    const res = await fetch('/api/region', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { country?: string | null; tier?: ConsentTier };
      const tier: ConsentTier = data.tier === 'standard' ? 'standard' : 'strict';
      try {
        window.localStorage.setItem(
          REGION_STORAGE_KEY,
          JSON.stringify({ country: data.country ?? null, tier, ts: Date.now() } satisfies RegionCache),
        );
      } catch {
        // Cache is an optimization only — decision still applies this visit.
      }
      return { tier, country: data.country ?? null };
    }
  } catch {
    // Network failure: fall through to fail-closed.
  }
  return { tier: 'strict', country: null };
}

/**
 * Apply a choice to an already-running gtag.js (opt-out path). Loading is
 * controlled by the consent gate's component mount — this only
 * stops in-flight/loaded tags and removes their identifiers:
 *  - `ga-disable-<id>` is checked by gtag.js on every send;
 *  - consent-state cookies `_ga*` are expired so no client id remains.
 * On re-enable the page reloads, giving gtag a single clean initialization.
 */
export function applyOptOutRuntime(): void {
  try {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  } catch {
    // Ignore: flag is best-effort on top of the component unmount.
  }
  clearAnalyticsCookies();
}

export function clearOptOutRuntime(): void {
  try {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  } catch {
    // Ignore.
  }
}

export function clearAnalyticsCookies(): void {
  try {
    const names = document.cookie
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter((n) => n === '_ga' || n.startsWith('_ga_'));
    const host = window.location.hostname;
    const expire = `expires=${new Date(0).toUTCString()}; path=/`;
    for (const name of names) {
      document.cookie = `${name}=; ${expire}`;
      document.cookie = `${name}=; ${expire}; domain=.${host}`;
      document.cookie = `${name}=; ${expire}; domain=${host}`;
    }
  } catch {
    // Ignore: cookie clearing is best-effort.
  }
}
