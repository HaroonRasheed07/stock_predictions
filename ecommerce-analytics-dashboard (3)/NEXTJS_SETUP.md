# Next.js E-commerce Analytics Dashboard - Setup Guide

## Overview

This is a **Next.js 14** dashboard for Amazon sales and review analytics with sentiment analysis and fake review detection.

## Project Structure

```
ecommerce-analytics-dashboard/
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       ├── data/route.ts        # GET endpoint for dashboard data
│   │       └── export/route.ts      # POST endpoint for CSV export
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Main dashboard page
│   └── globals.css                  # Global styles with teal-green theme
├── components/
│   ├── KPICard.tsx                  # KPI metric cards
│   ├── FilterControls.tsx           # Year/Product/Sentiment filters
│   ├── Charts.tsx                   # Recharts visualizations
│   └── ProductDetail.tsx            # Product detail section
├── lib/
│   └── dataProcessor.ts             # Data processing utilities
├── types/
│   └── index.ts                     # TypeScript interfaces
├── public/                          # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── next.config.js
```

## Installation

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 2. Run Development Server

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Integration Guide

### Step 1: Prepare Your Datasets

You need two CSV files:

**1. Sales Dataset** (`sales.csv`)
```
product_id,product_name,category,price,rating,review_count
ASIN123,Product Name,Electronics,99.99,4.5,1250
```

**2. Reviews Dataset** (`reviews.csv`)
```
product_id,product_name,text,rating,date
ASIN123,Product Name,Great product!,5,2024-01-15
```

### Step 2: Load and Process Data

Use the data processor utilities in `lib/dataProcessor.ts`:

```typescript
import { processReviews, aggregateMonthlyMetrics, aggregateProductMetrics, calculateKPIMetrics } from '@/lib/dataProcessor';

// 1. Parse your CSV files
const reviewsCSV = await fetch('reviews.csv').then(r => r.text());
const lines = reviewsCSV.split('\n');
const headers = lines[0].split(',');
const records = lines.slice(1).map(line => {
  const values = line.split(',');
  return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
});

// 2. Process reviews (sentiment analysis + fake detection)
const processedReviews = processReviews(records);

// 3. Aggregate metrics
const monthlyMetrics = aggregateMonthlyMetrics(processedReviews);
const productMetrics = aggregateProductMetrics(processedReviews);
const kpis = calculateKPIMetrics(processedReviews);

// 4. Save to database (see Step 3)
```

### Step 3: Connect to Database

Update `/app/api/dashboard/data/route.ts`:

#### Option A: MongoDB

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);

export async function GET() {
  try {
    await client.connect();
    const db = client.db('ecommerce');
    
    const kpis = await db.collection('kpis').findOne({});
    const metrics = await db.collection('monthly_metrics').find({}).toArray();
    const products = await db.collection('products').find({}).toArray();
    
    return NextResponse.json({
      kpis,
      monthlyMetrics: metrics,
      products,
      isRealData: true,
    });
  } finally {
    await client.close();
  }
}
```

#### Option B: PostgreSQL with Prisma

```typescript
import { prisma } from '@/lib/prisma';

export async function GET() {
  const kpis = await prisma.kpi.findFirst();
  const metrics = await prisma.monthlyMetric.findMany();
  const products = await prisma.product.findMany();
  
  return NextResponse.json({
    kpis,
    monthlyMetrics: metrics,
    products,
    isRealData: true,
  });
}
```

#### Option C: Firebase

```typescript
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';

export async function GET() {
  const db = getFirestore();
  
  const kpisSnap = await getDocs(collection(db, 'kpis'));
  const metricsSnap = await getDocs(collection(db, 'monthly_metrics'));
  const productsSnap = await getDocs(collection(db, 'products'));
  
  return NextResponse.json({
    kpis: kpisSnap.docs[0]?.data(),
    monthlyMetrics: metricsSnap.docs.map(d => d.data()),
    products: productsSnap.docs.map(d => d.data()),
    isRealData: true,
  });
}
```

### Step 4: Implement Data Upload Endpoint

Create `/app/api/dashboard/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processReviews, aggregateMonthlyMetrics, aggregateProductMetrics, calculateKPIMetrics } from '@/lib/dataProcessor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const reviewsFile = formData.get('reviews') as File;
    const salesFile = formData.get('sales') as File;
    
    if (!reviewsFile || !salesFile) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 });
    }
    
    // Read files
    const reviewsText = await reviewsFile.text();
    const salesText = await salesFile.text();
    
    // Parse CSV
    const parseCSV = (content: string) => {
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      });
    };
    
    const reviewsData = parseCSV(reviewsText);
    
    // Process
    const processedReviews = processReviews(reviewsData);
    const monthlyMetrics = aggregateMonthlyMetrics(processedReviews);
    const productMetrics = aggregateProductMetrics(processedReviews);
    const kpis = calculateKPIMetrics(processedReviews);
    
    // Save to database
    // TODO: Implement database save logic
    
    return NextResponse.json({
      success: true,
      message: 'Data processed successfully',
      stats: {
        reviewsProcessed: processedReviews.length,
        productsFound: productMetrics.length,
        monthsAnalyzed: monthlyMetrics.length,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process data' },
      { status: 500 }
    );
  }
}
```

### Step 5: Add Environment Variables

Create `.env.local`:

```env
# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/ecommerce
# or
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce

# API Keys (if using external sentiment analysis)
HUGGINGFACE_API_KEY=your_key_here
```

## Data Processing Pipeline

### 1. Sentiment Analysis

The dashboard uses keyword-based sentiment analysis combined with rating:

- **Positive**: Rating ≥ 4 + positive keywords
- **Neutral**: Rating = 3 + mixed signals
- **Negative**: Rating ≤ 2 + negative keywords

For production, integrate with:
- **HuggingFace Transformers**: `distilbert-base-uncased-finetuned-sst-2-english`
- **Google Cloud Natural Language API**
- **AWS Comprehend**

### 2. Fake Review Detection

Uses multiple heuristics:

1. **Rating-Sentiment Mismatch** (30% weight)
   - 5-star review with negative sentiment
   - 1-star review with positive sentiment

2. **Text Anomalies** (20% weight)
   - Too short (<10 chars) or too long (>5000 chars)

3. **Formatting Issues** (15% weight)
   - Excessive caps (>50%)
   - Multiple punctuation marks

4. **Temporal Patterns** (15% weight)
   - Unusual review clustering
   - Timing anomalies

**Threshold**: Reviews with score > 0.65 are flagged as fake

## Customization

### Change Color Scheme

Edit `app/globals.css`:

```css
:root {
  --primary: #your-color;
  --primary-light: #your-light-color;
  --primary-dark: #your-dark-color;
}
```

### Add More Charts

Edit `components/Charts.tsx` and add new Recharts components:

```typescript
<LineChart data={chartData}>
  <Line type="monotone" dataKey="your_metric" stroke="#00a896" />
</LineChart>
```

### Modify KPI Cards

Edit `components/KPICard.tsx` to add new metrics or change styling.

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Other Platforms

- **Netlify**: `netlify deploy`
- **Railway**: Connect GitHub repo
- **Render**: Connect GitHub repo

## Troubleshooting

### Data Not Loading

1. Check API endpoint: `http://localhost:3000/api/dashboard/data`
2. Verify database connection
3. Check browser console for errors

### Sentiment Analysis Not Working

1. Verify CSV format matches expected structure
2. Check `lib/dataProcessor.ts` for correct field names
3. Test with sample data first

### Performance Issues

1. Implement pagination for large datasets
2. Add database indexing
3. Cache aggregated metrics
4. Use React.memo for components

## Support

For issues or questions:
1. Check the `/app/api/dashboard/data/route.ts` comments for integration points
2. Review `lib/dataProcessor.ts` for data transformation examples
3. Refer to Next.js documentation: https://nextjs.org/docs

## Next Steps

1. ✅ Set up Next.js project
2. ⬜ Connect your datasets
3. ⬜ Configure database
4. ⬜ Deploy to production
5. ⬜ Set up automated data refresh
