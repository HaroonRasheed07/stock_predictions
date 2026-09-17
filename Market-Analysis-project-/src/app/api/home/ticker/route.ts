import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STOCK_API_BASE = process.env.STOCK_API_BASE || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const upstream = await fetch(`${STOCK_API_BASE}/api/home/ticker`, {
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
      return NextResponse.json(
        { marketStatus: "Unknown", topStocks: [] },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json(
      { marketStatus: "Unknown", topStocks: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
