import { NextResponse, type NextRequest } from 'next/server';
import { consentTierForCountry } from '@/lib/consent-region';

export const runtime = 'edge';

/**
 * Coarse consent tier for the visitor's connection.
 *
 * `x-vercel-ip-country` is attached by Vercel's own edge network to every
 * request — no third-party geolocation service is queried and no per-request
 * IP leaves the platform. The response is `no-store` so a country can never
 * be cached for another visitor.
 *
 * Fails closed: if the header is missing (local dev, misconfiguration) the
 * tier is 'strict', i.e. prior consent is required and nothing loads until
 * the visitor allows it.
 */
export function GET(request: NextRequest) {
  const country = (request.headers.get('x-vercel-ip-country') || '').trim().toUpperCase();
  const tier = consentTierForCountry(country || null);
  return NextResponse.json(
    { country: country || null, tier },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
