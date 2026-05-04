/**
 * Data Processing Utilities
 * 
 * USAGE GUIDE:
 * This file contains functions to process your CSV datasets
 * 
 * Step 1: Load your CSV files
 * Step 2: Parse and validate data
 * Step 3: Perform sentiment analysis
 * Step 4: Detect fake reviews
 * Step 5: Aggregate metrics
 * Step 6: Save to database
 * 
 * INTEGRATION:
 * Replace the mock data in /app/api/dashboard/data/route.ts with calls to these functions
 */

import type { ProcessedReview, MonthlyMetric, Product, KPIMetrics } from '@/types';

/**
 * Parse CSV file and return array of objects
 * @param csvContent - Raw CSV file content
 * @returns Array of parsed records
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    return record;
  });
}

/**
 * Perform sentiment analysis on review text
 * @param text - Review text
 * @param rating - Star rating (1-5)
 * @returns Sentiment classification and confidence score
 */
export function analyzeSentiment(
  text: string,
  rating: number
): { sentiment: 'positive' | 'neutral' | 'negative'; confidence: number } {
  // Simple keyword-based sentiment analysis
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'awesome'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'poor', 'worst', 'useless'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;

  // Combine with rating
  let sentiment: 'positive' | 'neutral' | 'negative';
  let confidence = 0.5;

  if (rating >= 4) {
    sentiment = 'positive';
    confidence = 0.7 + positiveCount * 0.1;
  } else if (rating <= 2) {
    sentiment = 'negative';
    confidence = 0.7 + negativeCount * 0.1;
  } else {
    sentiment = 'neutral';
    confidence = 0.6;
  }

  return {
    sentiment,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Detect fake reviews using multiple heuristics
 * @param review - Review data
 * @returns Fake review score (0-1)
 */
export function detectFakeReview(review: {
  text: string;
  rating: number;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}): number {
  let fakeScore = 0;

  // Heuristic 1: Rating-Sentiment Mismatch
  if (
    (review.rating >= 4 && review.sentiment === 'negative') ||
    (review.rating <= 2 && review.sentiment === 'positive')
  ) {
    fakeScore += 0.3;
  }

  // Heuristic 2: Suspiciously short or long text
  if (review.text.length < 10 || review.text.length > 5000) {
    fakeScore += 0.2;
  }

  // Heuristic 3: All caps or excessive punctuation
  const capsRatio = (review.text.match(/[A-Z]/g) || []).length / review.text.length;
  if (capsRatio > 0.5) {
    fakeScore += 0.15;
  }

  // Heuristic 4: Excessive punctuation
  const punctuationRatio = (review.text.match(/[!?]{2,}/g) || []).length;
  if (punctuationRatio > 3) {
    fakeScore += 0.15;
  }

  return Math.min(fakeScore, 1);
}

/**
 * Aggregate reviews into monthly metrics
 * @param reviews - Array of processed reviews
 * @returns Monthly aggregated metrics
 */
export function aggregateMonthlyMetrics(reviews: ProcessedReview[]): MonthlyMetric[] {
  const monthlyData: Record<string, MonthlyMetric> = {};

  reviews.forEach((review) => {
    const date = new Date(review.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthLabel,
        date: monthKey,
        sales: 0,
        reviews: 0,
        avgRating: 0,
        fakeReviewPercentage: 0,
        sentimentPositive: 0,
        sentimentNeutral: 0,
        sentimentNegative: 0,
      };
    }

    const metric = monthlyData[monthKey];
    metric.reviews += 1;
    metric.avgRating += review.rating;
    metric.sales += 500; // Estimated sales per review

    if (review.sentiment === 'positive') metric.sentimentPositive += 1;
    if (review.sentiment === 'neutral') metric.sentimentNeutral += 1;
    if (review.sentiment === 'negative') metric.sentimentNegative += 1;

    if (review.isFake) metric.fakeReviewPercentage += 1;
  });

  // Normalize averages
  Object.values(monthlyData).forEach((metric) => {
    metric.avgRating = metric.avgRating / metric.reviews;
    metric.fakeReviewPercentage = (metric.fakeReviewPercentage / metric.reviews) * 100;
  });

  return Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate reviews by product
 * @param reviews - Array of processed reviews
 * @returns Product metrics
 */
export function aggregateProductMetrics(reviews: ProcessedReview[]): Product[] {
  const productData: Record<string, Product> = {};

  reviews.forEach((review) => {
    if (!productData[review.productId]) {
      productData[review.productId] = {
        id: review.productId,
        name: review.productName,
        category: 'Electronics',
        totalSales: 0,
        totalReviews: 0,
        avgRating: 0,
        fakeReviewCount: 0,
        fakeReviewPercentage: 0,
        sentimentBreakdown: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
      };
    }

    const product = productData[review.productId];
    product.totalReviews += 1;
    product.avgRating += review.rating;
    product.totalSales += 500;

    if (review.sentiment === 'positive') product.sentimentBreakdown.positive += 1;
    if (review.sentiment === 'neutral') product.sentimentBreakdown.neutral += 1;
    if (review.sentiment === 'negative') product.sentimentBreakdown.negative += 1;

    if (review.isFake) product.fakeReviewCount += 1;
  });

  // Normalize
  Object.values(productData).forEach((product) => {
    product.avgRating = product.avgRating / product.totalReviews;
    product.fakeReviewPercentage = (product.fakeReviewCount / product.totalReviews) * 100;
  });

  return Object.values(productData);
}

/**
 * Calculate overall KPI metrics
 * @param reviews - Array of processed reviews
 * @returns KPI metrics
 */
export function calculateKPIMetrics(reviews: ProcessedReview[]): KPIMetrics {
  const totalReviews = reviews.length;
  const totalSales = totalReviews * 500; // Estimated
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

  const sentimentCounts = {
    positive: reviews.filter((r) => r.sentiment === 'positive').length,
    neutral: reviews.filter((r) => r.sentiment === 'neutral').length,
    negative: reviews.filter((r) => r.sentiment === 'negative').length,
  };

  const fakeReviewCount = reviews.filter((r) => r.isFake).length;

  return {
    totalSales,
    totalReviews,
    avgRating,
    fakeReviewPercentage: (fakeReviewCount / totalReviews) * 100,
    sentimentPositivePercentage: (sentimentCounts.positive / totalReviews) * 100,
    sentimentNeutralPercentage: (sentimentCounts.neutral / totalReviews) * 100,
    sentimentNegativePercentage: (sentimentCounts.negative / totalReviews) * 100,
  };
}

/**
 * Process raw review data
 * @param rawData - Raw review records from CSV
 * @returns Processed reviews with sentiment and fake detection
 */
export function processReviews(
  rawData: Record<string, string>[]
): ProcessedReview[] {
  return rawData.map((record, index) => {
    const text = record.text || record.review_text || '';
    const rating = parseInt(record.rating || record.stars || '3');
    const date = record.date || record.review_date || new Date().toISOString();

    const { sentiment, confidence } = analyzeSentiment(text, rating);
    const fakeScore = detectFakeReview({ text, rating, date, sentiment });

    return {
      id: `review-${index}`,
      productId: record.product_id || record.asin || `prod-${index}`,
      productName: record.product_name || record.title || 'Unknown Product',
      text,
      rating,
      date,
      sentiment,
      sentimentConfidence: confidence,
      isFake: fakeScore > 0.65,
      fakeScore,
    };
  });
}
