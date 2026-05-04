import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ECOM_API_BASE = process.env.ECOM_API_BASE || "http://127.0.0.1:8003";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const upstream = await fetch(`${ECOM_API_BASE}/api/ecommerce/sentiment`, {
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
      return NextResponse.json({ status: "error", label: "neutral", confidence: 0.5, keywords: [] }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json({ status: "error", label: "neutral", confidence: 0.5, keywords: [] }, { status: 200 });
  }
}
