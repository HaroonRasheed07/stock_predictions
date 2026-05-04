import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ECOM_API_BASE = process.env.ECOM_API_BASE || "http://127.0.0.1:8003";

function fallbackOverview(year: number) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyMetrics = months.map((m, i) => ({
    date: `${year}-${String(i+1).padStart(2,'0')}`,
    month: m,
    sales: Math.round(30000 + Math.random() * 15000),
    reviews: Math.round(800 + Math.random() * 600),
    avgRating: +(3.8 + Math.random() * 0.8).toFixed(1),
    fakeReviewPercentage: +(8 + Math.random() * 10).toFixed(1),
    sentimentPositive: +(55 + Math.random() * 20).toFixed(1),
    sentimentNeutral: +(15 + Math.random() * 15).toFixed(1),
    sentimentNegative: +(10 + Math.random() * 15).toFixed(1),
  }));
  const totalSales = monthlyMetrics.reduce((s, m) => s + m.sales, 0);
  const totalReviews = monthlyMetrics.reduce((s, m) => s + m.reviews, 0);
  const products = [
    { id:'p1', name:'Wireless Bluetooth Headphones Pro', category:'Electronics', totalSales:68200, totalReviews:2340, avgRating:4.3, fakeReviewCount:45, fakeReviewPercentage:1.9, sentimentBreakdown:{positive:72,neutral:18,negative:10}, monthlyData:[] },
    { id:'p2', name:'Smart Fitness Watch X200', category:'Electronics', totalSales:54100, totalReviews:1890, avgRating:4.1, fakeReviewCount:38, fakeReviewPercentage:2.0, sentimentBreakdown:{positive:65,neutral:22,negative:13}, monthlyData:[] },
    { id:'p3', name:'Organic Green Tea Premium', category:'Food & Beverage', totalSales:42800, totalReviews:1560, avgRating:4.5, fakeReviewCount:22, fakeReviewPercentage:1.4, sentimentBreakdown:{positive:78,neutral:15,negative:7}, monthlyData:[] },
    { id:'p4', name:'Ergonomic Office Chair Deluxe', category:'Furniture', totalSales:38500, totalReviews:1120, avgRating:3.9, fakeReviewCount:67, fakeReviewPercentage:6.0, sentimentBreakdown:{positive:55,neutral:25,negative:20}, monthlyData:[] },
    { id:'p5', name:'Portable Power Bank 20000mAh', category:'Electronics', totalSales:35200, totalReviews:980, avgRating:4.0, fakeReviewCount:29, fakeReviewPercentage:3.0, sentimentBreakdown:{positive:62,neutral:24,negative:14}, monthlyData:[] },
    { id:'p6', name:'Yoga Mat Non-Slip Premium', category:'Sports', totalSales:29800, totalReviews:870, avgRating:4.4, fakeReviewCount:15, fakeReviewPercentage:1.7, sentimentBreakdown:{positive:75,neutral:17,negative:8}, monthlyData:[] },
    { id:'p7', name:'Stainless Steel Water Bottle', category:'Kitchen', totalSales:27500, totalReviews:760, avgRating:4.2, fakeReviewCount:18, fakeReviewPercentage:2.4, sentimentBreakdown:{positive:68,neutral:20,negative:12}, monthlyData:[] },
    { id:'p8', name:'LED Desk Lamp Adjustable', category:'Electronics', totalSales:24100, totalReviews:690, avgRating:3.8, fakeReviewCount:52, fakeReviewPercentage:7.5, sentimentBreakdown:{positive:50,neutral:28,negative:22}, monthlyData:[] },
    { id:'p9', name:'Bamboo Cutting Board Set', category:'Kitchen', totalSales:21800, totalReviews:620, avgRating:4.6, fakeReviewCount:8, fakeReviewPercentage:1.3, sentimentBreakdown:{positive:82,neutral:12,negative:6}, monthlyData:[] },
    { id:'p10', name:'Wireless Charging Pad Fast', category:'Electronics', totalSales:19400, totalReviews:540, avgRating:3.7, fakeReviewCount:41, fakeReviewPercentage:7.6, sentimentBreakdown:{positive:48,neutral:30,negative:22}, monthlyData:[] },
  ];
  return {
    status: "success",
    isMockData: true,
    kpis: {
      totalSales,
      totalReviews,
      avgRating: 4.1,
      fakeReviewPercentage: 13.6,
      sentimentPositivePercentage: 65.0,
      sentimentNeutralPercentage: 20.0,
      sentimentNegativePercentage: 15.1,
    },
    monthlyMetrics,
    topProductsBySales: products.slice(0, 5),
    topProductsByReviews: [...products].sort((a, b) => b.totalReviews - a.totalReviews).slice(0, 5),
    products,
    categories: ['Electronics', 'Food & Beverage', 'Furniture', 'Sports', 'Kitchen'],
    yearsAvailable: [2023, 2024, 2025],
  };
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const upstream = await fetch(`${ECOM_API_BASE}/api/ecommerce/overview`, {
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
      const year = Number(body?.year || 2024);
      return NextResponse.json(fallbackOverview(year), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json(fallbackOverview(2024), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
