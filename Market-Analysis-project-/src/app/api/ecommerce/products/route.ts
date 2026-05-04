import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ECOM_API_BASE = process.env.ECOM_API_BASE || "http://127.0.0.1:8003";

function fallbackProducts() {
  const products = [
    { id:'p1', name:'Wireless Bluetooth Headphones Pro', category:'Electronics', totalSales:68200, totalReviews:2340, avgRating:4.3, fakeReviewCount:45, fakeReviewPercentage:1.9, sentimentBreakdown:{positive:72,neutral:18,negative:10}, monthlyData:[] },
    { id:'p2', name:'Smart Fitness Watch X200', category:'Electronics', totalSales:54100, totalReviews:1890, avgRating:4.1, fakeReviewCount:38, fakeReviewPercentage:2.0, sentimentBreakdown:{positive:65,neutral:22,negative:13}, monthlyData:[] },
    { id:'p3', name:'Organic Green Tea Premium', category:'Food & Beverage', totalSales:42800, totalReviews:1560, avgRating:4.5, fakeReviewCount:22, fakeReviewPercentage:1.4, sentimentBreakdown:{positive:78,neutral:15,negative:7}, monthlyData:[] },
    { id:'p4', name:'Ergonomic Office Chair Deluxe', category:'Furniture', totalSales:38500, totalReviews:1120, avgRating:3.9, fakeReviewCount:67, fakeReviewPercentage:6.0, sentimentBreakdown:{positive:55,neutral:25,negative:20}, monthlyData:[] },
    { id:'p5', name:'Portable Power Bank 20000mAh', category:'Electronics', totalSales:35200, totalReviews:980, avgRating:4.0, fakeReviewCount:29, fakeReviewPercentage:3.0, sentimentBreakdown:{positive:62,neutral:24,negative:14}, monthlyData:[] },
  ];
  return { status: "success", isMockData: true, products, total: products.length };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const upstream = await fetch(`${ECOM_API_BASE}/api/ecommerce/products`, {
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
      return NextResponse.json(fallbackProducts(), { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json(fallbackProducts(), { status: 200 });
  }
}
