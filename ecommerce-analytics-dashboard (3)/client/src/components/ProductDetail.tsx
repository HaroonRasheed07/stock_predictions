/**
 * Product Detail Section
 * 
 * Displays detailed information for a selected product:
 * - Product overview with key metrics
 * - Sentiment distribution pie chart
 * - Fake review detection summary
 * - Product performance indicators
 * 
 * Design: Minimalist cards with teal accents
 */

import React from "react";
import { AlertTriangle, Star, BarChart3, TrendingUp } from "lucide-react";
import { Product } from "@/lib/mockData";
import { SentimentPieChart } from "./Charts";

interface ProductDetailProps {
  product: Product;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ product }) => {
  const sentimentTotal =
    product.sentimentBreakdown.positive +
    product.sentimentBreakdown.neutral +
    product.sentimentBreakdown.negative;

  const sentimentPositivePercent =
    ((product.sentimentBreakdown.positive / sentimentTotal) * 100).toFixed(1);
  const sentimentNegativePercent =
    ((product.sentimentBreakdown.negative / sentimentTotal) * 100).toFixed(1);

  const fakeReviewRiskLevel =
    product.fakeReviewPercentage > 15
      ? "high"
      : product.fakeReviewPercentage > 10
        ? "medium"
        : "low";

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <div className="bg-white border border-gray-100 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {product.name}
            </h2>
            <p className="text-sm text-gray-600">{product.category}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={
                    i < Math.floor(product.avgRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }
                />
              ))}
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {product.avgRating} / 5.0
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Total Sales
            </p>
            <p className="text-lg font-bold text-gray-900">
              ${(product.totalSales / 1000).toFixed(0)}K
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Total Reviews
            </p>
            <p className="text-lg font-bold text-gray-900">
              {product.totalReviews.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Avg Rating
            </p>
            <p className="text-lg font-bold text-gray-900">
              {product.avgRating}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Fake Reviews
            </p>
            <p className="text-lg font-bold text-gray-900">
              {product.fakeReviewPercentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Sentiment and Fake Review Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sentiment Distribution */}
        <div>
          <SentimentPieChart
            positive={product.sentimentBreakdown.positive}
            neutral={product.sentimentBreakdown.neutral}
            negative={product.sentimentBreakdown.negative}
            title="Sentiment Distribution"
          />
        </div>

        {/* Fake Review Detection */}
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
            Fake Review Detection
          </h3>

          {/* Risk Level Indicator */}
          <div className="mb-6 p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle
                size={20}
                className={
                  fakeReviewRiskLevel === "high"
                    ? "text-red-600"
                    : fakeReviewRiskLevel === "medium"
                      ? "text-yellow-600"
                      : "text-green-600"
                }
              />
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Risk Level
                </p>
                <p
                  className={`text-sm font-bold ${
                    fakeReviewRiskLevel === "high"
                      ? "text-red-600"
                      : fakeReviewRiskLevel === "medium"
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  {fakeReviewRiskLevel.charAt(0).toUpperCase() +
                    fakeReviewRiskLevel.slice(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Detection Metrics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">Detected Fake Reviews</span>
              <span className="text-sm font-bold text-gray-900">
                {product.fakeReviewCount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">Fake Review Rate</span>
              <span className="text-sm font-bold text-gray-900">
                {product.fakeReviewPercentage}%
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">Authentic Reviews</span>
              <span className="text-sm font-bold text-gray-900">
                {(product.totalReviews - product.fakeReviewCount).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Authenticity Score</span>
              <span className="text-sm font-bold text-teal-600">
                {(100 - product.fakeReviewPercentage).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="mt-6 pt-6 border-t border-gray-50">
            <p className="text-xs text-gray-600 leading-relaxed">
              {fakeReviewRiskLevel === "high"
                ? "⚠️ High fake review rate detected. Consider implementing additional verification measures."
                : fakeReviewRiskLevel === "medium"
                  ? "⚡ Moderate fake review activity. Monitor trends closely."
                  : "✓ Low fake review rate. Product reputation appears authentic."}
            </p>
          </div>
        </div>
      </div>

      {/* Sentiment Insights */}
      <div className="bg-white border border-gray-100 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
          Sentiment Insights
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Positive Sentiment */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Positive
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 mb-1">
              {sentimentPositivePercent}%
            </p>
            <p className="text-xs text-gray-600">
              {product.sentimentBreakdown.positive.toLocaleString()} reviews
            </p>
          </div>

          {/* Neutral Sentiment */}
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-purple-600" />
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Neutral
              </p>
            </div>
            <p className="text-2xl font-bold text-purple-700 mb-1">
              {(
                (product.sentimentBreakdown.neutral / sentimentTotal) *
                100
              ).toFixed(1)}
              %
            </p>
            <p className="text-xs text-gray-600">
              {product.sentimentBreakdown.neutral.toLocaleString()} reviews
            </p>
          </div>

          {/* Negative Sentiment */}
          <div className="p-4 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Negative
              </p>
            </div>
            <p className="text-2xl font-bold text-red-700 mb-1">
              {sentimentNegativePercent}%
            </p>
            <p className="text-xs text-gray-600">
              {product.sentimentBreakdown.negative.toLocaleString()} reviews
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
