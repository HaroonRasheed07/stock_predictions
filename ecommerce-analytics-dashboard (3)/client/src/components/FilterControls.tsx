/**
 * Filter Controls Component
 * 
 * Interactive controls for filtering dashboard data:
 * - Year selector (2023-2025)
 * - Product dropdown
 * - Sentiment filter
 * 
 * Design: Minimalist with teal accent highlights
 * Interaction: Smooth transitions and hover effects
 */

import React from "react";
import { ChevronDown } from "lucide-react";
import { Product } from "@/lib/mockData";

interface FilterControlsProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedProduct: string;
  onProductChange: (productId: string) => void;
  selectedSentiment: "all" | "positive" | "neutral" | "negative";
  onSentimentChange: (sentiment: "all" | "positive" | "neutral" | "negative") => void;
  products: Product[];
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  selectedYear,
  onYearChange,
  selectedProduct,
  onProductChange,
  selectedSentiment,
  onSentimentChange,
  products,
}) => {
  const years = [2023, 2024, 2025];
  const sentiments = [
    { value: "all" as const, label: "All Sentiments" },
    { value: "positive" as const, label: "Positive" },
    { value: "neutral" as const, label: "Neutral" },
    { value: "negative" as const, label: "Negative" },
  ];

  return (
    <div className="bg-white border border-teal-200 rounded-lg p-6 mb-8">
      <h3 className="text-sm font-semibold text-teal-900 uppercase tracking-wide mb-6">
        Filters
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Year Selector */}
        <div>
          <label className="block text-xs font-medium text-teal-700 uppercase tracking-wide mb-3">
            Year
          </label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              className="
                w-full px-4 py-2 bg-white border border-gray-200 rounded-lg
                text-sm font-medium text-gray-900
                appearance-none cursor-pointer
                hover:border-teal-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                transition-colors duration-200
              "
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Product Dropdown */}
        <div>
          <label className="block text-xs font-medium text-teal-700 uppercase tracking-wide mb-3">
            Product
          </label>
          <div className="relative">
            <select
              value={selectedProduct}
              onChange={(e) => onProductChange(e.target.value)}
              className="
                w-full px-4 py-2 bg-white border border-gray-200 rounded-lg
                text-sm font-medium text-gray-900
                appearance-none cursor-pointer
                hover:border-teal-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                transition-colors duration-200
              "
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Sentiment Filter */}
        <div>
          <label className="block text-xs font-medium text-teal-700 uppercase tracking-wide mb-3">
            Sentiment
          </label>
          <div className="relative">
            <select
              value={selectedSentiment}
              onChange={(e) =>
                onSentimentChange(
                  e.target.value as "all" | "positive" | "neutral" | "negative"
                )
              }
              className="
                w-full px-4 py-2 bg-white border border-gray-200 rounded-lg
                text-sm font-medium text-gray-900
                appearance-none cursor-pointer
                hover:border-teal-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                transition-colors duration-200
              "
            >
              {sentiments.map((sentiment) => (
                <option key={sentiment.value} value={sentiment.value}>
                  {sentiment.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Active filters display */}
      <div className="mt-6 pt-6 border-t border-teal-100 flex flex-wrap gap-2">
        {selectedYear !== 2024 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
            Year: {selectedYear}
          </span>
        )}
        {selectedProduct && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
            Product: {products.find((p) => p.id === selectedProduct)?.name}
          </span>
        )}
        {selectedSentiment !== "all" && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
            Sentiment: {selectedSentiment}
          </span>
        )}
      </div>
    </div>
  );
};

export default FilterControls;
