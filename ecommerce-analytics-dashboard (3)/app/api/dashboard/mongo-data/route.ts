/**
 * API Route: GET /api/dashboard/mongo-data
 * 
 * Fetches dashboard data from MongoDB
 * This replaces the mock data endpoint once MongoDB is set up
 */

import { NextResponse } from 'next/server';
import { getAnalyticsCollection, getKPICollection } from '@/lib/mongodb';

export async function GET() {
  try {
    const analyticsCollection = await getAnalyticsCollection();
    const kpiCollection = await getKPICollection();

    // Get KPIs
    const kpiData = await kpiCollection.findOne({});

    // Get monthly metrics
    const monthlyData = await analyticsCollection
      .aggregate([
        {
          $group: {
            _id: '$month',
            sales: { $sum: '$sales' },
            reviews: { $sum: '$reviews' },
            avgRating: { $avg: '$rating' },
            fakeReviewCount: { $sum: { $cond: ['$isFakeReview', 1, 0] } },
            positiveCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } },
            neutralCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] } },
            negativeCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // Get products
    const products = await analyticsCollection
      .aggregate([
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$productName' },
            category: { $first: '$category' },
            totalSales: { $sum: '$sales' },
            totalReviews: { $sum: '$reviews' },
            avgRating: { $avg: '$rating' },
            fakeReviewCount: { $sum: { $cond: ['$isFakeReview', 1, 0] } },
            positiveCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } },
            neutralCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] } },
            negativeCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Format response
    const formattedMonthlyData = monthlyData.map((m: any) => ({
      month: m._id,
      date: `${m._id}-01`,
      sales: m.sales,
      reviews: m.reviews,
      avgRating: m.avgRating,
      fakeReviewPercentage: m.reviews > 0 ? (m.fakeReviewCount / m.reviews) * 100 : 0,
      sentimentPositive: m.positiveCount,
      sentimentNeutral: m.neutralCount,
      sentimentNegative: m.negativeCount,
    }));

    const formattedProducts = products.map((p: any) => ({
      id: p._id,
      name: p.productName,
      category: p.category,
      totalSales: p.totalSales,
      totalReviews: p.totalReviews,
      avgRating: p.avgRating,
      fakeReviewCount: p.fakeReviewCount,
      fakeReviewPercentage: p.totalReviews > 0 ? (p.fakeReviewCount / p.totalReviews) * 100 : 0,
      sentimentBreakdown: {
        positive: p.positiveCount,
        neutral: p.neutralCount,
        negative: p.negativeCount,
      },
      monthlyData: formattedMonthlyData,
    }));

    const dashboardData = {
      kpis: kpiData || {
        totalSales: 0,
        totalReviews: 0,
        avgRating: 0,
        fakeReviewPercentage: 0,
        sentimentPositivePercentage: 0,
        sentimentNeutralPercentage: 0,
        sentimentNegativePercentage: 0,
      },
      monthlyMetrics: formattedMonthlyData,
      products: formattedProducts,
      isRealData: true,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
