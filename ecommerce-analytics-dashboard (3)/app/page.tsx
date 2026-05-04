'use client';

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import KPICard from '@/components/KPICard';
import FilterControls from '@/components/FilterControls';
import Charts from '@/components/Charts';
import ProductDetail from '@/components/ProductDetail';
import BackendSetupOptions from '@/components/BackendSetupOptions';
import type { DashboardData, Product, MonthlyMetric } from '@/types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');

  // Load data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/data');
        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }
        const dashboardData = await response.json();
        setData(dashboardData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter data by year
  const yearFilteredMetrics = useMemo(() => {
    if (!data?.monthlyMetrics) return [];
    return data.monthlyMetrics.filter((m) => m.date.startsWith(selectedYear.toString()));
  }, [data?.monthlyMetrics, selectedYear]);

  // Get current product
  const currentProduct = useMemo(() => {
    if (!selectedProduct || !data?.products) return null;
    return data.products.find((p) => p.id === selectedProduct);
  }, [selectedProduct, data?.products]);

  // Get display metrics
  const displayMetrics = useMemo(() => {
    if (!currentProduct) return yearFilteredMetrics;
    return currentProduct.monthlyData?.filter((m) => m.date.startsWith(selectedYear.toString())) || yearFilteredMetrics;
  }, [currentProduct, yearFilteredMetrics, selectedYear]);



  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Dashboard</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border-color bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-text-muted mt-1">Amazon Sales & Review Analytics (2023–2025)</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <FilterControls
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
          selectedSentiment={selectedSentiment}
          onSentimentChange={setSelectedSentiment}
          products={data.products}
        />

        {/* KPI Cards */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground uppercase tracking-wide mb-6">
            Key Performance Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Total Sales"
              value={`$${(data.kpis.totalSales / 1000).toFixed(1)}K`}
              icon={TrendingUp}
              color="primary"
            />
            <KPICard
              title="Total Reviews"
              value={data.kpis.totalReviews.toLocaleString()}
              icon="📊"
              color="primary"
            />
            <KPICard
              title="Average Rating"
              value={`${data.kpis.avgRating.toFixed(1)}/5.0`}
              icon="⭐"
              color="primary"
            />
            <KPICard
              title="Fake Reviews"
              value={`${data.kpis.fakeReviewPercentage.toFixed(1)}%`}
              icon="⚠️"
              color="primary"
            />
            <KPICard
              title="Positive Sentiment"
              value={`${data.kpis.sentimentPositivePercentage.toFixed(1)}%`}
              icon="😊"
              color="primary"
            />
          </div>
        </section>

        {/* Charts */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground uppercase tracking-wide mb-6">
            Trends & Performance
          </h2>
          <Charts metrics={displayMetrics} />
        </section>

        {/* Product Detail */}
        {currentProduct && (
          <section>
            <h2 className="text-xl font-bold text-foreground uppercase tracking-wide mb-6">
              Product Details
            </h2>
            <ProductDetail product={currentProduct} />
          </section>
        )}
      </main>

      {/* Backend Setup Options */}
      <BackendSetupOptions />
    </div>
  );
}
