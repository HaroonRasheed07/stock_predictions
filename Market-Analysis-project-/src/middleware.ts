import { NextResponse, type NextRequest } from 'next/server';

/**
 * Canonicalizes stock research URLs before routing (and before any
 * prerendered/ISR output can serve a case-variant): /stocks/MSFT → /stocks/msft
 * with the query string preserved. Runs at the edge, so it never touches
 * server-component dynamic APIs. Invalid segments are left to the page's
 * pattern gate (genuine 404).
 */
const SYMBOL_SEGMENT = /^\/stocks\/([A-Za-z0-9][A-Za-z0-9.\-_]{0,9})$/;

export function middleware(request: NextRequest) {
  const match = SYMBOL_SEGMENT.exec(request.nextUrl.pathname);
  if (!match) return;
  const segment = match[1];
  const canonical = segment.toLowerCase();
  if (segment === canonical) return;
  const url = request.nextUrl.clone();
  url.pathname = `/stocks/${canonical}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/stocks/:path*',
};
