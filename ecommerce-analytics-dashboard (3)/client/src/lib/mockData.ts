/**
 * Mock Dataset for E-commerce Analytics Dashboard
 * 
 * This file contains simulated Amazon sales and review data for 2023–2025.
 * 
 * DATA STRUCTURE:
 * - Monthly aggregated sales and review metrics
 * - Product-level details with sentiment analysis
 * - Fake review detection indicators
 * 
 * BACKEND INTEGRATION NOTES:
 * When connecting to a real API, replace these arrays with API calls:
 * - Use `fetch()` or `axios` in a `useEffect` hook
 * - Endpoint example: GET /api/analytics/sales?year=2024&product=productId
 * - Response format should match the interface definitions below
 */

export interface MonthlyMetric {
  month: string;
  date: string; // ISO format for charting
  sales: number;
  reviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewCount: number;
  fakeReviewPercentage: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  monthlyData: MonthlyMetric[];
}

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

// ============================================================================
// MOCK MONTHLY DATA (2023–2025)
// ============================================================================

const generateMonthlyData = (year: number, month: number): MonthlyMetric => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Simulate seasonal variations and growth trends
  const baseMultiplier = year === 2023 ? 1 : year === 2024 ? 1.3 : 1.7;
  const seasonalMultiplier = [1.2, 1.1, 0.9, 0.8, 0.7, 0.6, 1.3, 1.4, 1.0, 1.1, 1.5, 1.8][
    month - 1
  ];

  const sales = Math.floor(Math.random() * 150000 * baseMultiplier * seasonalMultiplier);
  const reviews = Math.floor(Math.random() * 5000 * baseMultiplier * seasonalMultiplier);
  const avgRating = 3.5 + Math.random() * 1.5; // 3.5 to 5.0

  // Fake reviews tend to increase over time
  const fakeReviewPercentage = 5 + Math.random() * 15 + (year - 2023) * 2;

  // Sentiment distribution (positive tends to be higher for good products)
  const sentimentPositive = Math.floor(reviews * (0.6 + Math.random() * 0.2));
  const sentimentNeutral = Math.floor(reviews * (0.2 + Math.random() * 0.15));
  const sentimentNegative = reviews - sentimentPositive - sentimentNeutral;

  return {
    month: monthNames[month - 1],
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    sales,
    reviews,
    avgRating: Math.round(avgRating * 10) / 10,
    fakeReviewPercentage: Math.round(fakeReviewPercentage * 10) / 10,
    sentimentPositive,
    sentimentNeutral,
    sentimentNegative,
  };
};

// ============================================================================
// MOCK PRODUCTS
// ============================================================================

const productNames = [
  "Wireless Bluetooth Headphones Pro",
  "USB-C Fast Charging Cable (3-pack)",
  "Premium Stainless Steel Water Bottle",
  "Ergonomic Gaming Mouse RGB",
  "Ultra-Slim Laptop Stand",
  "Portable Power Bank 30000mAh",
  "Bamboo Cutting Board Set",
  "Smart LED Desk Lamp",
  "Mechanical Keyboard Cherry MX",
  "Noise-Cancelling Sleep Earbuds",
];

const categories = [
  "Electronics",
  "Accessories",
  "Home & Kitchen",
  "Office Supplies",
  "Tech Gadgets",
];

const generateProductData = (productId: string, productName: string): Product => {
  const monthlyData: MonthlyMetric[] = [];

  // Generate data for all months in 2023, 2024, 2025
  for (let year = 2023; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      monthlyData.push(generateMonthlyData(year, month));
    }
  }

  // Calculate totals
  const totalSales = monthlyData.reduce((sum, m) => sum + m.sales, 0);
  const totalReviews = monthlyData.reduce((sum, m) => sum + m.reviews, 0);
  const avgRating =
    monthlyData.reduce((sum, m) => sum + m.avgRating, 0) / monthlyData.length;
  const fakeReviewCount = Math.floor(
    totalReviews * (5 + Math.random() * 15) * 0.01
  );

  const sentimentPositive = monthlyData.reduce((sum, m) => sum + m.sentimentPositive, 0);
  const sentimentNeutral = monthlyData.reduce((sum, m) => sum + m.sentimentNeutral, 0);
  const sentimentNegative = monthlyData.reduce((sum, m) => sum + m.sentimentNegative, 0);

  return {
    id: productId,
    name: productName,
    category: categories[Math.floor(Math.random() * categories.length)],
    totalSales,
    totalReviews,
    avgRating: Math.round(avgRating * 10) / 10,
    fakeReviewCount,
    fakeReviewPercentage: Math.round((fakeReviewCount / totalReviews) * 100 * 10) / 10,
    sentimentBreakdown: {
      positive: sentimentPositive,
      neutral: sentimentNeutral,
      negative: sentimentNegative,
    },
    monthlyData,
  };
};

// Generate all products
export const MOCK_PRODUCTS: Product[] = productNames.map((name, index) =>
  generateProductData(`product-${index + 1}`, name)
);

// ============================================================================
// AGGREGATED METRICS (All Products Combined)
// ============================================================================

export const generateAggregatedMetrics = (): MonthlyMetric[] => {
  const aggregated: MonthlyMetric[] = [];

  // Generate metrics for all months 2023-2025
  for (let year = 2023; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      // Collect all monthly data for this month across all products
      const monthData: MonthlyMetric[] = [];
      
      for (const product of MOCK_PRODUCTS) {
        const productMonthData = product.monthlyData.find(
          (m) => m.date === `${year}-${String(month).padStart(2, "0")}-01`
        );
        if (productMonthData) {
          monthData.push(productMonthData);
        }
      }

      // If we have data for this month, aggregate it
      if (monthData.length > 0) {
        const aggregatedMonth: MonthlyMetric = {
          month: monthData[0].month,
          date: monthData[0].date,
          sales: monthData.reduce((sum, m) => sum + m.sales, 0),
          reviews: monthData.reduce((sum, m) => sum + m.reviews, 0),
          avgRating: monthData.reduce((sum, m) => sum + m.avgRating, 0) / monthData.length,
          fakeReviewPercentage:
            monthData.reduce((sum, m) => sum + m.fakeReviewPercentage, 0) / monthData.length,
          sentimentPositive: monthData.reduce((sum, m) => sum + m.sentimentPositive, 0),
          sentimentNeutral: monthData.reduce((sum, m) => sum + m.sentimentNeutral, 0),
          sentimentNegative: monthData.reduce((sum, m) => sum + m.sentimentNegative, 0),
        };

        aggregated.push(aggregatedMonth);
      }
    }
  }

  // Fallback: if no aggregated data, generate it directly
  if (aggregated.length === 0) {
    console.warn("No aggregated metrics found, generating fallback");
    for (let year = 2023; year <= 2025; year++) {
      for (let month = 1; month <= 12; month++) {
        aggregated.push(generateMonthlyData(year, month));
      }
    }
  }

  return aggregated;
};

// ============================================================================
// UTILITY FUNCTIONS FOR DATA FILTERING & CALCULATIONS
// ============================================================================

/**
 * Filter data by year
 * BACKEND: Replace with API call: GET /api/analytics/sales?year={year}
 */
export const filterByYear = (data: MonthlyMetric[], year: number): MonthlyMetric[] => {
  return data.filter((m) => m.date.startsWith(year.toString()));
};

/**
 * Filter data by sentiment type
 * BACKEND: Replace with API call: GET /api/analytics/sentiment?type={sentiment}
 */
export const filterBySentiment = (
  data: MonthlyMetric[],
  sentiment: "positive" | "neutral" | "negative"
): MonthlyMetric[] => {
  if (sentiment === "positive") {
    return data.filter((m) => m.sentimentPositive > m.sentimentNegative);
  } else if (sentiment === "negative") {
    return data.filter((m) => m.sentimentNegative > m.sentimentPositive);
  }
  return data;
};

/**
 * Get top N products by metric
 * BACKEND: Replace with API call: GET /api/analytics/products/top?metric={metric}&limit={n}
 */
export const getTopProducts = (
  products: Product[],
  metric: "sales" | "reviews" | "rating",
  limit: number = 5
): Product[] => {
  const sorted = [...products].sort((a, b) => {
    if (metric === "sales") return b.totalSales - a.totalSales;
    if (metric === "reviews") return b.totalReviews - a.totalReviews;
    return b.avgRating - a.avgRating;
  });
  return sorted.slice(0, limit);
};

/**
 * Calculate KPIs for dashboard
 * BACKEND: Replace with API call: GET /api/analytics/kpis?filters={...}
 */
export const calculateKPIs = (
  products: Product[],
  metrics: MonthlyMetric[]
): {
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositivePercentage: number;
  sentimentNeutralPercentage: number;
  sentimentNegativePercentage: number;
} => {
  const totalSales = metrics.reduce((sum, m) => sum + m.sales, 0);
  const totalReviews = metrics.reduce((sum, m) => sum + m.reviews, 0);
  const avgRating = metrics.reduce((sum, m) => sum + m.avgRating, 0) / metrics.length;
  const fakeReviewPercentage =
    metrics.reduce((sum, m) => sum + m.fakeReviewPercentage, 0) / metrics.length;

  const totalSentimentPositive = metrics.reduce((sum, m) => sum + m.sentimentPositive, 0);
  const totalSentimentNeutral = metrics.reduce((sum, m) => sum + m.sentimentNeutral, 0);
  const totalSentimentNegative = metrics.reduce((sum, m) => sum + m.sentimentNegative, 0);
  const totalSentiment = totalSentimentPositive + totalSentimentNeutral + totalSentimentNegative;

  return {
    totalSales,
    totalReviews,
    avgRating: Math.round(avgRating * 10) / 10,
    fakeReviewPercentage: Math.round(fakeReviewPercentage * 10) / 10,
    sentimentPositivePercentage: Math.round((totalSentimentPositive / totalSentiment) * 1000) / 10,
    sentimentNeutralPercentage: Math.round((totalSentimentNeutral / totalSentiment) * 1000) / 10,
    sentimentNegativePercentage: Math.round((totalSentimentNegative / totalSentiment) * 1000) / 10,
  };
};

/**
 * Export data to CSV
 * BACKEND: Replace with API call: POST /api/analytics/export?format=csv
 */
export const exportToCSV = (
  products: Product[],
  metrics: MonthlyMetric[],
  selectedProduct?: string
): string => {
  const headers = [
    "Date",
    "Month",
    "Sales",
    "Reviews",
    "Avg Rating",
    "Fake Reviews %",
    "Sentiment Positive",
    "Sentiment Neutral",
    "Sentiment Negative",
  ];

  const rows = metrics.map((m) => [
    m.date,
    m.month,
    m.sales,
    m.reviews,
    m.avgRating,
    m.fakeReviewPercentage,
    m.sentimentPositive,
    m.sentimentNeutral,
    m.sentimentNegative,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return csv;
};
