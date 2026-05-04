/**
 * useAnalyticsData Hook
 * 
 * Custom React hook for loading analytics data
 * Handles both real data (from CSV/API) and mock data fallback
 * 
 * Usage:
 * const { products, monthlyMetrics, loading, error } = useAnalyticsData();
 */

import { useEffect, useState } from "react";
import { MonthlyMetric, Product, MOCK_PRODUCTS, generateAggregatedMetrics } from "@/lib/mockData";
import { loadDataWithFallback, validateData, printSetupGuide } from "@/lib/realData";

interface UseAnalyticsDataResult {
  products: Product[];
  monthlyMetrics: MonthlyMetric[];
  loading: boolean;
  error: string | null;
  isUsingMockData: boolean;
}

export const useAnalyticsData = (): UseAnalyticsDataResult => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyMetric[]>(
    generateAggregatedMetrics()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load real data, fall back to mock
        const data = await loadDataWithFallback(MOCK_PRODUCTS, generateAggregatedMetrics());

        // Validate data - but don't throw error, just use mock data
        if (!validateData(data)) {
          console.warn("Data validation warning - using mock data");
          setProducts(MOCK_PRODUCTS);
          setMonthlyMetrics(generateAggregatedMetrics());
          setIsUsingMockData(true);
          setLoading(false);
          return;
        }

        setProducts(data.products);
        setMonthlyMetrics(data.monthlyMetrics);

        // Check if using mock data
        const isUsingMock = data.products === MOCK_PRODUCTS;
        setIsUsingMockData(isUsingMock);

        if (isUsingMock) {
          console.info("Using mock data for demonstration");
          printSetupGuide();
        } else {
          console.info("Successfully loaded real data from Kaggle datasets");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.warn("Error loading data, using mock data:", errorMessage);

        // Fallback to mock data on error - don't set error state
        setProducts(MOCK_PRODUCTS);
        setMonthlyMetrics(generateAggregatedMetrics());
        setIsUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    products,
    monthlyMetrics,
    loading,
    error,
    isUsingMockData,
  };
};

export default useAnalyticsData;
