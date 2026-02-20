import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRYPTO_API_BASE = process.env.CRYPTO_API_BASE || "http://127.0.0.1:8001";

function fallbackOverview(symbol: string) {
  return {
    symbol,
    livePrice: null,
    change24h: 0,
    predictedReturn: 0,
    predictedPrice: null,
    sigma: null,
    fearGreed: { value: 50, classification: "Neutral" },
    signal: {
      signal: "HOLD",
      score: 0,
      color: "#FFC107",
      reasons: [],
      confidence: 0,
    },
    risk: {
      score: 50,
      level: "Medium",
      color: "#FFC107",
      factors: [],
    },
    topCoins: [],
    chartData: [],
    supportedSymbols: [
      "BTC",
      "ETH",
      "SOL",
      "BNB",
      "XRP",
      "ADA",
      "DOGE",
      "AVAX",
      "DOT",
      "LINK",
      "LTC",
      "MATIC",
      "ATOM",
      "BCH",
      "ETC",
      "FIL",
      "HBAR",
      "NEAR",
      "TRX",
      "XLM",
    ],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const upstream = await fetch(`${CRYPTO_API_BASE}/api/crypto/overview`, {
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
    } catch (e: any) {
      const symbol = String(body?.symbol || "BTC").toUpperCase().trim();
      return NextResponse.json(fallbackOverview(symbol), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e: any) {
    const symbol = "BTC";
    return NextResponse.json(fallbackOverview(symbol), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
