import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRYPTO_API_BASE = process.env.CRYPTO_API_BASE || "http://127.0.0.1:8001";

function fallbackForecast(symbol: string) {
  return {
    symbol,
    horizonHours: 12,
    timestamps: [],
    predictedReturns: [],
    actualReturns: [],
    sigma: [],
    directionProb: [],
    accuracy: 0,
    latestPredReturn: 0,
    latestPrice: 0,
    predictedPrice: 0,
    latestSigma: null,
    dataPoints: 0,
    seqLen: 72,
    nFeatures: 0,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const upstream = await fetch(`${CRYPTO_API_BASE}/api/crypto/forecast`, {
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
      const symbol = String(body?.symbol || "BTC").toUpperCase().trim();
      return NextResponse.json(fallbackForecast(symbol), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e: any) {
    return NextResponse.json(fallbackForecast("BTC"), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
