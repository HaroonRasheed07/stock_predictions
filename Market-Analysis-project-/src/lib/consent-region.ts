/**
 * Consent tier by visitor country.
 *
 * The country comes from Vercel's edge network header (x-vercel-ip-country),
 * read server-side by /api/region — not from a third-party IP-lookup call.
 * When the country is unavailable the caller must fail closed to 'strict'.
 *
 * 'strict'  — prior (opt-in) consent is legally required before analytics
 *             cookies may be set (GDPR/ePrivacy scope and other regimes with
 *             an explicit opt-in requirement).
 * 'standard' — analytics may run by default under applicable law, with a
 *             clear opt-out (Privacy Settings in the footer).
 *
 * The list is deliberately explicit and auditable. Adding a jurisdiction here
 * only makes the site ask more often (fails safe); removing one relaxes it.
 */
export type ConsentTier = 'strict' | 'standard';

const STRICT_CONSENT_COUNTRIES: ReadonlySet<string> = new Set([
  // European Union (27)
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES',
  // EEA
  'IS', 'LI', 'NO',
  // UK + Switzerland
  'GB', 'CH',
  // Canada — PIPEDA (OPC: analytics cookies require consent)
  'CA',
  // Brazil — LGPD
  'BR',
  // Japan — APPI
  'JP',
  // South Korea — PIPA
  'KR',
  // India — DPDP rules (tracking technologies require consent)
  'IN',
  // Australia — Privacy Act
  'AU',
  // Singapore — PDPA advisory on analytics cookies
  'SG',
  // Türkiye — KVKK
  'TR',
  // South Africa — POPIA
  'ZA',
  // Nigeria — NDPR/NDPA
  'NG',
  // Kenya — Data Protection Act
  'KE',
  // UAE / Saudi Arabia — PDPL
  'AE', 'SA',
]);

export function consentTierForCountry(country?: string | null): ConsentTier {
  if (!country) return 'strict';
  return STRICT_CONSENT_COUNTRIES.has(country.toUpperCase()) ? 'strict' : 'standard';
}

export function isStrictCountry(country?: string | null): boolean {
  return consentTierForCountry(country) === 'strict';
}
