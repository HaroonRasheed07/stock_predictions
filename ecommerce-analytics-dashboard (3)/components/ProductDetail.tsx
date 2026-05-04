'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { Product } from '@/types';

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const sentimentData = [
    { name: 'Positive', value: product.sentimentBreakdown.positive },
    { name: 'Neutral', value: product.sentimentBreakdown.neutral },
    { name: 'Negative', value: product.sentimentBreakdown.negative },
  ];

  const COLORS = ['#00a896', '#b2dfdb', '#ff6b6b'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sentiment Distribution */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-6">
          Sentiment Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={sentimentData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {sentimentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Product Summary */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-6">
          Product Summary
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Product Name</p>
            <p className="text-lg font-semibold text-foreground mt-1">{product.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Total Reviews</p>
              <p className="text-2xl font-bold text-foreground mt-1">{product.totalReviews.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Avg Rating</p>
              <p className="text-2xl font-bold text-foreground mt-1">{product.avgRating.toFixed(2)}/5.0</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Fake Reviews</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{product.fakeReviewPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold text-foreground mt-1">${(product.totalSales / 1000).toFixed(1)}K</p>
            </div>
          </div>

          {/* Fake Review Detection Summary */}
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4">
            <p className="text-sm font-semibold text-red-900 mb-2">Fake Review Detection</p>
            <p className="text-sm text-red-700">
              {product.fakeReviewCount} out of {product.totalReviews} reviews flagged as potentially fake based on sentiment-rating mismatch and temporal anomalies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
