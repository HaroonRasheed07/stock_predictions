import { NextResponse } from "next/server";
import { fetchHomeMarketSnapshot } from "@/lib/home-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const snapshot = await fetchHomeMarketSnapshot();
    return NextResponse.json(snapshot, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        stocks: [],
        opportunities: [],
        breadth: null,
        scan: null,
        highRiskCount: 0,
        available: false,
        hasSnapshot: false,
        updatedAt: null,
        isStale: true,
        degraded: true,
        refreshFailed: true,
        errors: ["market snapshot unavailable"],
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
