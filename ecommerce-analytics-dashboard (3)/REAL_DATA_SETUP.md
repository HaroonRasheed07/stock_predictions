# Real Data Integration Guide

This dashboard now supports both **mock data** (for demonstration) and **real Kaggle datasets**.

## Quick Start

### Option 1: Use Mock Data (Default)
The dashboard comes with mock data pre-configured. Just run:

```bash
npm run dev
```

The dashboard will display demo data with a notice that you're using mock data.

### Option 2: Use Real Kaggle Datasets

Follow these steps to integrate real data from Kaggle:

## Step 1: Download Datasets from Kaggle

### Dataset 1: Amazon Sales Dataset
- **URL:** https://www.kaggle.com/datasets/karkavelrajaj/amazon-sales-dataset
- **File:** `amazon.csv`
- **Contains:** Product info, pricing, ratings, review text

### Dataset 2: Amazon Product Reviews Dataset
- **URL:** https://www.kaggle.com/datasets/yasserh/amazon-product-reviews-dataset
- **File:** `7817_1.csv`
- **Contains:** Product reviews with timestamps (dateAdded, dateUpdated)

## Step 2: Prepare CSV Files

1. **Create data directory:**
   ```bash
   mkdir -p client/public/data
   ```

2. **Copy downloaded CSV files:**
   ```bash
   # Rename and copy the files
   cp ~/Downloads/amazon.csv client/public/data/amazon_sales.csv
   cp ~/Downloads/7817_1.csv client/public/data/amazon_reviews.csv
   ```

3. **Verify files exist:**
   ```bash
   ls -lh client/public/data/
   ```

## Step 3: Start the Dashboard

```bash
npm run dev
```

The dashboard will automatically:
- Detect the CSV files
- Load and parse them
- Merge data on product ID
- Generate monthly metrics
- Analyze sentiment
- Detect fake reviews

## Data Processing

### What Happens Behind the Scenes

1. **CSV Parsing:** Converts CSV text to JavaScript objects
2. **Data Merging:** Joins sales and reviews data on product ID
3. **Sentiment Analysis:** Classifies reviews as positive/neutral/negative
4. **Fake Review Detection:** Identifies suspicious reviews
5. **Time-Series Generation:** Groups data by month using review dates
6. **KPI Calculation:** Computes aggregated metrics

### Data Transformation

The dashboard transforms raw Kaggle data into the following structure:

```typescript
interface Product {
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

interface MonthlyMetric {
  month: string;
  date: string;
  sales: number;
  reviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
}
```

## Sentiment Analysis

The dashboard uses a hybrid approach for sentiment classification:

1. **Rating-Based (Primary):**
   - Rating ≥ 4 → Positive
   - Rating = 3 → Neutral
   - Rating ≤ 2 → Negative

2. **Text-Based (Fallback):**
   - Analyzes review text for positive/negative keywords
   - Used when rating is unavailable

### Sentiment Keywords

**Positive:** great, excellent, amazing, love, perfect, best, awesome, wonderful, fantastic, good

**Negative:** bad, terrible, awful, hate, worst, poor, disappointing, broken, useless, waste

## Fake Review Detection

The dashboard identifies suspicious reviews using heuristics:

- No review content (< 10 characters)
- No review title
- Suspicious title pattern (single letters)
- Very short review text (< 5 characters)

Reviews matching 2+ criteria are flagged as suspicious.

## Backend Integration (Production)

For production deployment, replace CSV loading with API endpoints:

### Update `client/src/lib/realData.ts`

```typescript
// Instead of loading CSV files, call your API
export const loadRealData = async () => {
  try {
    const [salesRes, reviewsRes] = await Promise.all([
      fetch("/api/data/sales"),
      fetch("/api/data/reviews"),
    ]);

    const salesData = await salesRes.json();
    const reviewsData = await reviewsRes.json();

    const products = mergeDatasets(salesData, reviewsData);
    const monthlyMetrics = generateMonthlyMetrics(salesData, reviewsData);

    return { products, monthlyMetrics };
  } catch (error) {
    console.error("Error loading data:", error);
    return null;
  }
};
```

### Required API Endpoints

**GET /api/data/sales**
```json
[
  {
    "product_id": "prod-001",
    "product_name": "Product Name",
    "category": "Category",
    "discounted_price": 29.99,
    "actual_price": 49.99,
    "discount_percentage": 40,
    "rating": 4.5,
    "rating_count": 150,
    "review_content": "Great product!",
    "review_title": "Excellent"
  }
]
```

**GET /api/data/reviews**
```json
[
  {
    "id": "review-001",
    "asins": "prod-001",
    "brand": "Brand Name",
    "categories": "Category",
    "dateAdded": "2024-01-15",
    "dateUpdated": "2024-01-16"
  }
]
```

## Troubleshooting

### CSV Files Not Found
**Error:** "Using mock data for demonstration"

**Solution:**
1. Verify files exist: `ls client/public/data/`
2. Check file names match exactly:
   - `amazon_sales.csv`
   - `amazon_reviews.csv`
3. Restart dev server: `npm run dev`

### Data Not Merging
**Error:** Products show 0 reviews

**Solution:**
1. Check product IDs match between datasets
2. Verify CSV format is correct
3. Check browser console for parsing errors

### Memory Issues with Large Datasets
**Error:** Browser becomes slow or unresponsive

**Solution:**
1. Limit CSV size to < 10,000 rows
2. Pre-process data server-side
3. Implement pagination in dashboard

## File Structure

```
ecommerce-analytics-dashboard/
├── client/
│   ├── public/
│   │   └── data/                    # CSV files go here
│   │       ├── amazon_sales.csv
│   │       └── amazon_reviews.csv
│   └── src/
│       ├── lib/
│       │   ├── mockData.ts          # Mock data & interfaces
│       │   ├── dataTransformer.ts   # CSV parsing & merging
│       │   └── realData.ts          # Real data loading
│       ├── hooks/
│       │   └── useAnalyticsData.ts  # Data loading hook
│       └── pages/
│           └── Dashboard.tsx         # Main dashboard
└── REAL_DATA_SETUP.md              # This file
```

## Performance Tips

1. **Limit Dataset Size:** Keep CSV under 10,000 rows for smooth performance
2. **Pre-aggregate Data:** Group by month server-side if possible
3. **Lazy Load Charts:** Load charts only when visible
4. **Cache Results:** Store processed data in localStorage

## Next Steps

1. ✅ Download Kaggle datasets
2. ✅ Place CSV files in `client/public/data/`
3. ✅ Restart dev server
4. ✅ Dashboard automatically loads real data
5. 🔄 (Optional) Deploy to production with API endpoints

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify CSV file format
3. Review data transformation logic in `dataTransformer.ts`
4. Check API response format if using backend

---

**Happy analyzing! 📊**
