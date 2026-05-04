'use client';

import type { Product } from '@/types';

interface FilterControlsProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedProduct: string;
  onProductChange: (productId: string) => void;
  selectedSentiment: 'all' | 'positive' | 'neutral' | 'negative';
  onSentimentChange: (sentiment: 'all' | 'positive' | 'neutral' | 'negative') => void;
  products: Product[];
}

export default function FilterControls({
  selectedYear,
  onYearChange,
  selectedProduct,
  onProductChange,
  selectedSentiment,
  onSentimentChange,
  products,
}: FilterControlsProps) {
  const years = [2023, 2024, 2025];
  const sentiments = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'positive', label: 'Positive' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'negative', label: 'Negative' },
  ];

  return (
    <div className="card bg-teal-50 border-2 border-primary-light mb-8">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-6">Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Year Filter */}
        <div>
          <label className="block text-xs font-semibold text-primary uppercase tracking-wide mb-3">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="w-full px-4 py-2 border-2 border-primary-light rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 bg-white text-foreground"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Product Filter */}
        <div>
          <label className="block text-xs font-semibold text-primary uppercase tracking-wide mb-3">
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => onProductChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-primary-light rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 bg-white text-foreground"
          >
            <option value="">All Products</option>
            {products.slice(0, 20).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name.substring(0, 50)}
              </option>
            ))}
          </select>
        </div>

        {/* Sentiment Filter */}
        <div>
          <label className="block text-xs font-semibold text-primary uppercase tracking-wide mb-3">
            Sentiment
          </label>
          <select
            value={selectedSentiment}
            onChange={(e) => onSentimentChange(e.target.value as any)}
            className="w-full px-4 py-2 border-2 border-primary-light rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 bg-white text-foreground"
          >
            {sentiments.map((sentiment) => (
              <option key={sentiment.value} value={sentiment.value}>
                {sentiment.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
