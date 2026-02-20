import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STOCK_API_BASE = process.env.STOCK_API_BASE || "http://127.0.0.1:8000";

function fallbackIndicators(ticker: string) {
  return {
    ticker,
    data: [],
    totalMarketCap: 0,
    tradingVolume: 0,
    activeStocks: 0,
    topStocks: [],
    currentPrice: 0,
    change: 0,
    changePercent: 0,
  };
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const upstream = await fetch(`${STOCK_API_BASE}/api/data/indicators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const ticker = String(body?.ticker || "AAPL").toUpperCase().trim();
      return NextResponse.json(fallbackIndicators(ticker), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    const ticker = String(body?.ticker || "AAPL").toUpperCase().trim();
    return NextResponse.json(fallbackIndicators(ticker), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
