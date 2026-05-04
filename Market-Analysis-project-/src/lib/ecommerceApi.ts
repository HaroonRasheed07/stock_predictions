/**
 * E-commerce Analytics API Client
 * Proxies through Next.js API routes to the Python backend on port 8002
 */

export interface MonthlyMetric {
  date: string;
  month: string;
  sales: number;
  reviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewCount: number;
  fakeReviewPercentage: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  monthlyData: MonthlyMetric[];
}

export interface KPIs {
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositivePercentage: number;
  sentimentNeutralPercentage: number;
  sentimentNegativePercentage: number;
}

export interface OverviewResponse {
  status: string;
  isMockData: boolean;
  kpis: KPIs;
  monthlyMetrics: MonthlyMetric[];
  topProductsBySales: Product[];
  topProductsByReviews: Product[];
  products: Product[];
  categories: string[];
  yearsAvailable: number[];
}

export interface SentimentResult {
  status: string;
  label: "positive" | "negative" | "neutral";
  confidence: number;
  keywords: string[];
}

const API_BASE = "";

export async function fetchOverview(year: number = 2024): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE}/api/ecommerce/overview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
}

export async function fetchProducts(
  year: number = 2024,
  category?: string,
  sortBy: string = "sales",
  limit: number = 10
): Promise<{ status: string; products: Product[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/ecommerce/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, category, sort_by: sortBy, limit }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
}

export async function classifySentiment(
  text: string,
  rating?: number
): Promise<SentimentResult> {
  const res = await fetch(`${API_BASE}/api/ecommerce/sentiment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, rating }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
