import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STOCK_API_BASE = process.env.STOCK_API_BASE || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const upstream = await fetch(`${STOCK_API_BASE}/api/market/status`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Backend unreachable — compute locally using edge-compatible logic
      const now = new Date();
      const etHour = parseInt(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now)
      );
      const etMinute = parseInt(
        new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now)
      );
      const etDay = parseInt(
        new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(now)
      );
      const isWeekend = etDay === 0 || etDay === 6;
      const etMinutes = etHour * 60 + etMinute;

      let status = 'closed';
      let label = 'Market Closed';

      if (isWeekend) {
        status = 'closed';
        label = 'Market Closed';
      } else if (etMinutes < 570) {
        status = 'closed';
        label = 'Market Closed';
      } else if (etMinutes < 600) {
        status = 'pre_market';
        label = 'Pre-Market';
      } else if (etMinutes <= 960) {
        status = 'open';
        label = 'Market Open';
      } else if (etMinutes <= 1200) {
        status = 'after_hours';
        label = 'After Hours';
      } else {
        status = 'closed';
        label = 'Market Closed';
      }

      return NextResponse.json(
        { market: 'US', status, label, timezone: 'America/New_York' },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json(
      { market: 'US', status: 'unknown', label: 'Unknown', timezone: 'America/New_York' },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
