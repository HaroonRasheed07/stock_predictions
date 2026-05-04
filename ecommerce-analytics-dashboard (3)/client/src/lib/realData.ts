/**
 * Real Data Loading Module
 * 
 * Loads and processes real Kaggle datasets:
 * - Amazon Sales Dataset
 * - Amazon Product Reviews Dataset
 * 
 * SETUP INSTRUCTIONS:
 * 1. Download both CSV files from Kaggle
 * 2. Place them in: client/public/data/
 *    - amazon_sales.csv
 *    - amazon_reviews.csv
 * 3. Update the file paths below
 * 
 * BACKEND INTEGRATION:
 * Replace CSV loading with API calls:
 * - GET /api/data/sales
 * - GET /api/data/reviews
 */

import { MonthlyMetric, Product } from "./mockData";
import {
  mergeDatasets,
  generateMonthlyMetrics,
  RawSalesRecord,
  RawReviewRecord,
  parseCSV,
} from "./dataTransformer";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Update these paths to match your CSV file locations
const SALES_CSV_PATH = "/data/amazon_sales.csv";
const REVIEWS_CSV_PATH = "/data/amazon_reviews.csv";

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load real datasets from CSV files
 * Returns null if files not found (falls back to mock data)
 */
export const loadRealData = async (): Promise<{
  products: Product[];
  monthlyMetrics: MonthlyMetric[];
} | null> => {
  try {
    console.log("Attempting to load real datasets...");

    // Fetch CSV files
    const [salesResponse, reviewsResponse] = await Promise.all([
      fetch(SALES_CSV_PATH),
      fetch(REVIEWS_CSV_PATH),
    ]);

    // Check if files exist
    if (!salesResponse.ok || !reviewsResponse.ok) {
      console.warn(
        "CSV files not found. Using mock data. To use real data:"
      );
      console.warn("1. Download datasets from Kaggle");
      console.warn("2. Place in client/public/data/");
      console.warn("3. Update file paths in realData.ts");
      return null;
    }

    // Parse CSV content
    const salesCSV = await salesResponse.text();
    const reviewsCSV = await reviewsResponse.text();

    const salesData = parseCSV(salesCSV) as RawSalesRecord[];
    const reviewsData = parseCSV(reviewsCSV) as RawReviewRecord[];

    console.log(`Loaded ${salesData.length} sales records`);
    console.log(`Loaded ${reviewsData.length} review records`);

    // Merge and transform data
    const products = mergeDatasets(salesData, reviewsData);
    const monthlyMetrics = generateMonthlyMetrics(salesData, reviewsData);

    console.log(`Processed ${products.length} products`);
    console.log(`Generated ${monthlyMetrics.length} monthly metrics`);

    return { products, monthlyMetrics };
  } catch (error) {
    console.error("Error loading real data:", error);
    console.warn("Falling back to mock data");
    return null;
  }
};

/**
 * Load data with fallback to mock data
 */
export const loadDataWithFallback = async (
  mockProducts: Product[],
  mockMetrics: MonthlyMetric[]
): Promise<{ products: Product[]; monthlyMetrics: MonthlyMetric[] }> => {
  const realData = await loadRealData();

  if (realData) {
    return realData;
  }

  // Fallback to mock data
  console.log("Using mock data for demonstration");
  return {
    products: mockProducts,
    monthlyMetrics: mockMetrics,
  };
};

// ============================================================================
// DATA VALIDATION
// ============================================================================

/**
 * Validate loaded data
 */
export const validateData = (data: {
  products: Product[];
  monthlyMetrics: MonthlyMetric[];
}): boolean => {
  if (!data.products || data.products.length === 0) {
    console.error("No products found");
    return false;
  }

  if (!data.monthlyMetrics || data.monthlyMetrics.length === 0) {
    console.error("No monthly metrics found");
    return false;
  }

  // Validate product structure
  for (const product of data.products) {
    if (!product.id || !product.name) {
      console.error("Invalid product structure:", product);
      return false;
    }
  }

  // Validate monthly metrics structure
  for (const metric of data.monthlyMetrics) {
    if (!metric.date || metric.sales === undefined) {
      console.error("Invalid metric structure:", metric);
      return false;
    }
  }

  return true;
};

// ============================================================================
// SETUP GUIDE
// ============================================================================

export const printSetupGuide = () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         E-commerce Analytics Dashboard - Setup Guide           ║
╚════════════════════════════════════════════════════════════════╝

To use REAL data instead of mock data:

1. DOWNLOAD DATASETS from Kaggle:
   - Amazon Sales Dataset:
     https://www.kaggle.com/datasets/karkavelrajaj/amazon-sales-dataset
   - Amazon Product Reviews Dataset:
     https://www.kaggle.com/datasets/yasserh/amazon-product-reviews-dataset

2. CREATE DATA DIRECTORY:
   mkdir -p client/public/data/

3. PLACE CSV FILES:
   - client/public/data/amazon_sales.csv
   - client/public/data/amazon_reviews.csv

4. UPDATE FILE PATHS in client/src/lib/realData.ts:
   const SALES_CSV_PATH = "/data/amazon_sales.csv";
   const REVIEWS_CSV_PATH = "/data/amazon_reviews.csv";

5. RESTART DEV SERVER:
   npm run dev

The dashboard will automatically:
- Load and parse CSV files
- Merge sales and review data
- Generate monthly metrics
- Analyze sentiment from reviews
- Detect fake reviews

If CSV files are not found, the dashboard will use mock data.

BACKEND INTEGRATION:
For production, replace CSV loading with API endpoints:
- GET /api/data/sales → Returns sales data
- GET /api/data/reviews → Returns review data

Update loadRealData() to use fetch() with your API endpoints.
  `);
};

export default {
  loadRealData,
  loadDataWithFallback,
  validateData,
  printSetupGuide,
};
