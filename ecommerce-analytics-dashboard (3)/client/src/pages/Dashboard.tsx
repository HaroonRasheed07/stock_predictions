/**
 * E-commerce Analytics Dashboard
 * 
 * Main dashboard page integrating all components:
 * - KPI cards with animated counters
 * - Interactive filter controls
 * - Time-series charts for sales, reviews, sentiment
 * - Top products bar charts
 * - Product detail section
 * - CSV export functionality
 * 
 * Design: Modern Data Minimalism with Swiss-style precision
 * 
 * BACKEND INTEGRATION:
 * Replace mock data with API calls:
 * - GET /api/analytics/sales?year={year}&product={productId}
 * - GET /api/analytics/kpis?filters={...}
 * - GET /api/analytics/products/top?metric={metric}
 * - POST /api/analytics/export?format=csv
 */

import React, { useState, useMemo } from "react";
import { Download, BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import {
  filterByYear,
  calculateKPIs,
  exportToCSV,
  getTopProducts,
  MonthlyMetric,
  Product,
} from "@/lib/mockData";
import useAnalyticsData from "@/hooks/useAnalyticsData";
import KPICard from "@/components/KPICard";
import FilterControls from "@/components/FilterControls";
import {
  TimeSeriesChart,
  MultiLineChart,
  TopProductsChart,
  SentimentPieChart,
} from "@/components/Charts";
import ProductDetail from "@/components/ProductDetail";

export default function Dashboard() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSentiment, setSelectedSentiment] = useState<
    "all" | "positive" | "neutral" | "negative"
  >("all");

  // Load real or mock data
  const { products: allProducts, monthlyMetrics: allMetrics, loading, error, isUsingMockData } = useAnalyticsData();

  // ========================================================================
  // DATA PROCESSING
  // ========================================================================

  // Use loaded data instead of mock

  // Filter metrics by year
  const yearFilteredMetrics = useMemo(
    () => filterByYear(allMetrics, selectedYear),
    [allMetrics, selectedYear]
  );

  // Get selected product data
  const currentProduct = useMemo(
    () =>
      selectedProduct
        ? allProducts.find((p) => p.id === selectedProduct)
        : null,
    [selectedProduct, allProducts]
  );

  // Get product-specific metrics if selected
  const displayMetrics = useMemo(() => {
    if (!currentProduct) return yearFilteredMetrics;

    return currentProduct.monthlyData.filter((m) =>
      m.date.startsWith(selectedYear.toString())
    );
  }, [currentProduct, yearFilteredMetrics, selectedYear]);

  // Calculate KPIs
  const kpis = useMemo(() => calculateKPIs(allProducts, displayMetrics), [allProducts, displayMetrics]);

  // Get top products (only if not filtering by specific product)
  const topProductsByReviews = useMemo(
    () => (currentProduct ? [] : getTopProducts(allProducts, "reviews", 5)),
    [currentProduct, allProducts]
  );

  const topProductsBySales = useMemo(
    () => (currentProduct ? [] : getTopProducts(allProducts, "sales", 5)),
    [currentProduct, allProducts]
  );

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleExportCSV = () => {
    const filename = `analytics-${selectedYear}${
      currentProduct ? `-${currentProduct.id}` : ""
    }-${new Date().toISOString().split("T")[0]}.csv`;

    const csv = exportToCSV(allProducts, displayMetrics, selectedProduct);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-serif">
                Analytics Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Amazon Sales & Review Analytics (2023–2025)
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="
                flex items-center gap-2 px-4 py-2
                bg-teal-500 text-white rounded-lg
                hover:bg-teal-600 transition-colors duration-200
                font-medium text-sm
              "
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Filter Controls */}
        {/* Loading State */}
        {loading && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-8 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>
            <p className="text-sm text-teal-700">Loading analytics data...</p>
          </div>
        )}

        {/* Error State - Now shows as warning, not error */}
        {error && !isUsingMockData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 flex items-center gap-3">
            <AlertCircle size={20} className="text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-700">Data loading note</p>
              <p className="text-xs text-yellow-600">{error}</p>
            </div>
          </div>
        )}

        {/* Mock Data Notice */}
        {isUsingMockData && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-yellow-800">
              <strong>Using Demo Data:</strong> To use your own Kaggle datasets, download the CSV files and place them in <code className="bg-yellow-100 px-2 py-1 rounded">client/public/data/</code>. See console for setup instructions.
            </p>
          </div>
        )}

        <FilterControls
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
          selectedSentiment={selectedSentiment}
          onSentimentChange={setSelectedSentiment}
          products={allProducts}
        />

        {/* KPI Cards Section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-teal-900 uppercase tracking-wide mb-6">
            Key Performance Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              label="Total Sales"
              value={kpis.totalSales}
              format="currency"
              icon={<TrendingUp size={20} />}
            />
            <KPICard
              label="Total Reviews"
              value={kpis.totalReviews}
              format="number"
              icon={<BarChart3 size={20} />}
            />
            <KPICard
              label="Average Rating"
              value={kpis.avgRating}
              unit="/ 5.0"
              format="decimal"
            />
            <KPICard
              label="Fake Reviews"
              value={kpis.fakeReviewPercentage}
              format="percentage"
            />
            <KPICard
              label="Positive Sentiment"
              value={kpis.sentimentPositivePercentage}
              format="percentage"
            />
          </div>
        </section>

        {/* Time-Series Charts */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
            Trends & Performance
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart
              data={displayMetrics}
              title="Monthly Sales"
              dataKey="sales"
              unit="USD"
              color="#00d4d4"
            />
            <TimeSeriesChart
              data={displayMetrics}
              title="Monthly Reviews"
              dataKey="reviews"
              color="#00d4d4"
            />
          </div>
        </section>

        {/* Sentiment and Fake Review Trends */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MultiLineChart
              data={displayMetrics}
              title="Sentiment Trend"
              lines={[
                {
                  dataKey: "sentimentPositive",
                  label: "Positive",
                  color: "#10b981",
                },
                {
                  dataKey: "sentimentNeutral",
                  label: "Neutral",
                  color: "#8b5cf6",
                },
                {
                  dataKey: "sentimentNegative",
                  label: "Negative",
                  color: "#ef4444",
                },
              ]}
            />
            <TimeSeriesChart
              data={displayMetrics}
              title="Fake Review Trend"
              dataKey="fakeReviewPercentage"
              unit="%"
              color="#ef4444"
            />
          </div>
        </section>

        {/* Top Products Charts */}
        {!currentProduct && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
              Top Products
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopProductsChart
                products={topProductsByReviews.length > 0 ? topProductsByReviews : allProducts.slice(0, 5)}
                metric="reviews"
                title="Top 5 by Reviews"
              />
              <TopProductsChart
                products={topProductsBySales.length > 0 ? topProductsBySales : allProducts.slice(0, 5)}
                metric="sales"
                title="Top 5 by Sales"
              />
            </div>
          </section>
        )}

        {/* Product Detail Section */}
        {currentProduct && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
              Product Details
            </h2>
            <ProductDetail product={currentProduct} />
          </section>
        )}

        {/* Overall Sentiment Distribution */}
        {!currentProduct && (
          <section className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SentimentPieChart
                positive={displayMetrics.reduce(
                  (sum, m) => sum + m.sentimentPositive,
                  0
                )}
                neutral={displayMetrics.reduce(
                  (sum, m) => sum + m.sentimentNeutral,
                  0
                )}
                negative={displayMetrics.reduce(
                  (sum, m) => sum + m.sentimentNegative,
                  0
                )}
                title="Overall Sentiment Distribution"
              />
              <div className="bg-white border border-gray-100 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
                  Data Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm text-gray-600">
                      Total Data Points
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {displayMetrics.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm text-gray-600">
                      Products Tracked
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {allProducts.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm text-gray-600">
                      Date Range
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {selectedYear}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Last Updated
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="container py-8">
          <p className="text-xs text-gray-600 text-center">
            This dashboard uses mock data for demonstration purposes. To connect
            real data, replace the mock data calls with API endpoints in{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              client/src/lib/mockData.ts
            </code>
          </p>
        </div>
      </footer>
    </div>
  );
}
