/**
 * API Route: POST /api/upload
 * 
 * Handles CSV file uploads and processes them into MongoDB
 * 
 * Usage:
 * const formData = new FormData();
 * formData.append('file', csvFile);
 * formData.append('type', 'reviews'); // or 'sales'
 * 
 * const response = await fetch('/api/upload', {
 *   method: 'POST',
 *   body: formData,
 * });
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsCollection, getKPICollection } from '@/lib/mongodb';
import Papa from 'papaparse';

interface ReviewRow {
  product_id?: string;
  productId?: string;
  review_text?: string;
  reviewText?: string;
  rating?: number;
  date?: string;
  [key: string]: any;
}

interface SalesRow {
  product_id?: string;
  productId?: string;
  product_name?: string;
  productName?: string;
  category?: string;
  price?: number;
  sales?: number;
  [key: string]: any;
}

// Simple sentiment analysis
function analyzeSentiment(text: string, rating: number): 'positive' | 'neutral' | 'negative' {
  if (!text) {
    return rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
  }

  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'best', 'awesome', 'wonderful'];
  const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'worst', 'disappointing', 'useless', 'broken'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((word) => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter((word) => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';

  return rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
}

// Detect fake reviews
function detectFakeReview(text: string, rating: number): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const suspiciousPatterns = [
    /\b(buy now|click here|link in bio)\b/i,
    /\b(free|discount|coupon)\b/gi,
    /\b(pm|dm|message me)\b/i,
    /\b(fake|scam|spam)\b/i,
  ];

  const matchedPatterns = suspiciousPatterns.filter((pattern) => pattern.test(lowerText)).length;

  // If text is very short but rating is extreme (1 or 5), likely fake
  if (text.length < 20 && (rating === 1 || rating === 5)) return true;

  // If multiple suspicious patterns found
  if (matchedPatterns >= 2) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string; // 'reviews' or 'sales'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!fileType || !['reviews', 'sales'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Must be "reviews" or "sales"' }, { status: 400 });
    }

    // Read file content
    const fileContent = await file.text();

    // Parse CSV
    const { data: rows, errors } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: 'CSV parsing error', details: errors }, { status: 400 });
    }

    const analyticsCollection = await getAnalyticsCollection();
    let processedCount = 0;

    if (fileType === 'reviews') {
      // Process reviews
      for (const row of rows as ReviewRow[]) {
        const productId = row.product_id || row.productId || 'unknown';
        const reviewText = row.review_text || row.reviewText || '';
        const rating = row.rating || 3;
        const date = row.date || new Date().toISOString();

        const sentiment = analyzeSentiment(reviewText, rating);
        const isFakeReview = detectFakeReview(reviewText, rating);

        await analyticsCollection.insertOne({
          productId,
          productName: `Product ${productId}`,
          category: 'Electronics',
          date: new Date(date).toISOString(),
          month: new Date(date).toISOString().substring(0, 7),
          year: new Date(date).getFullYear(),
          sales: 0,
          reviews: 1,
          rating,
          sentiment,
          isFakeReview,
          reviewText,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        processedCount++;
      }
    } else if (fileType === 'sales') {
      // Process sales data
      for (const row of rows as SalesRow[]) {
        const productId = row.product_id || row.productId || 'unknown';
        const productName = row.product_name || row.productName || `Product ${productId}`;
        const category = row.category || 'Electronics';
        const price = row.price || 0;
        const sales = row.sales || 0;

        await analyticsCollection.insertOne({
          productId,
          productName,
          category,
          date: new Date().toISOString(),
          month: new Date().toISOString().substring(0, 7),
          year: new Date().getFullYear(),
          sales,
          reviews: 0,
          rating: 0,
          sentiment: 'neutral',
          isFakeReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        processedCount++;
      }
    }

    // Recalculate KPIs
    const kpiCollection = await getKPICollection();
    const totalSales = await analyticsCollection.aggregate([{ $group: { _id: null, total: { $sum: '$sales' } } }]).toArray();
    const totalReviews = await analyticsCollection.countDocuments();
    const avgRating = await analyticsCollection.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]).toArray();
    const fakeReviews = await analyticsCollection.countDocuments({ isFakeReview: true });
    const sentimentCounts = await analyticsCollection.aggregate([{ $group: { _id: '$sentiment', count: { $sum: 1 } } }]).toArray();

    const kpiData = {
      totalSales: totalSales[0]?.total || 0,
      totalReviews,
      avgRating: avgRating[0]?.avg || 0,
      fakeReviewPercentage: totalReviews > 0 ? (fakeReviews / totalReviews) * 100 : 0,
      sentimentPositivePercentage: totalReviews > 0 ? ((sentimentCounts.find((s) => s._id === 'positive')?.count || 0) / totalReviews) * 100 : 0,
      sentimentNeutralPercentage: totalReviews > 0 ? ((sentimentCounts.find((s) => s._id === 'neutral')?.count || 0) / totalReviews) * 100 : 0,
      sentimentNegativePercentage: totalReviews > 0 ? ((sentimentCounts.find((s) => s._id === 'negative')?.count || 0) / totalReviews) * 100 : 0,
      lastUpdated: new Date(),
    };

    await kpiCollection.deleteMany({});
    await kpiCollection.insertOne(kpiData as any);

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} records`,
      processedCount,
      kpis: kpiData,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
