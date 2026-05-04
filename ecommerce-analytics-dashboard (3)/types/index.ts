/**
 * Dashboard Data Types
 * Defines all TypeScript interfaces for the analytics dashboard
 */

export interface MonthlyMetric {
  month: string;
  date: string;
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
  monthlyData?: MonthlyMetric[];
}

export interface KPIMetrics {
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositivePercentage: number;
  sentimentNeutralPercentage: number;
  sentimentNegativePercentage: number;
}

export interface DashboardData {
  kpis: KPIMetrics;
  monthlyMetrics: MonthlyMetric[];
  products: Product[];
  isRealData: boolean;
  lastUpdated?: string;
}

export interface SentimentAnalysis {
  text: string;
  rating: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  isFake: boolean;
  fakeScore: number;
}

export interface ProcessedReview {
  id: string;
  productId: string;
  productName: string;
  text: string;
  rating: number;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentConfidence: number;
  isFake: boolean;
  fakeScore: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
