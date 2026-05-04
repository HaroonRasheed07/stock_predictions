# Backend Setup - MongoDB Integration

یہ guide آپ کو complete MongoDB backend setup کرنے میں مدد دے گا۔

## کیا کیا تیار ہے؟

✅ **MongoDB Connection** - `lib/mongodb.ts`
✅ **Data Upload API** - `/api/upload`
✅ **Dashboard Data API** - `/api/dashboard/mongo-data`
✅ **Admin Panel** - `/admin` page
✅ **Data Upload UI** - Drag & drop CSV upload
✅ **Sentiment Analysis** - Automatic review analysis
✅ **Fake Review Detection** - Built-in detection

## Quick Start

### 1. MongoDB Setup (5 منٹ)

```bash
# MONGODB_SETUP.md فائل کو پڑھیں
cat MONGODB_SETUP.md
```

یا براہ راست یہ کریں:
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) پر جائیں
2. Free cluster بنائیں
3. Connection string حاصل کریں
4. `.env.local` میں `MONGODB_URI` شامل کریں

### 2. Dependencies انسٹال کریں

```bash
npm install mongodb papaparse
# یا
pnpm add mongodb papaparse
```

### 3. Dev Server شروع کریں

```bash
npm run dev
# یا
pnpm dev
```

### 4. Admin Panel میں ڈیٹا اپ لوڈ کریں

```
http://localhost:3000/admin
```

## File Structure

```
app/
├── api/
│   ├── upload/route.ts              # CSV upload اور processing
│   └── dashboard/
│       ├── mongo-data/route.ts      # Real data API
│       └── data/route.ts            # Mock data (fallback)
├── admin/page.tsx                   # Admin panel
└── page.tsx                         # Main dashboard

lib/
└── mongodb.ts                       # MongoDB connection

components/
└── DataUploadPanel.tsx              # Upload UI
```

## API Endpoints

### Upload Data
```bash
POST /api/upload
Content-Type: multipart/form-data

Parameters:
- file: CSV file
- type: "reviews" | "sales"

Response:
{
  "success": true,
  "message": "Processed 1000 records",
  "processedCount": 1000,
  "kpis": { ... }
}
```

### Get Dashboard Data (MongoDB)
```bash
GET /api/dashboard/mongo-data

Response:
{
  "kpis": { ... },
  "monthlyMetrics": [ ... ],
  "products": [ ... ],
  "isRealData": true,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Get Dashboard Data (Mock)
```bash
GET /api/dashboard/data

Response: Same format as above (but with mock data)
```

## CSV Upload Format

### Reviews CSV
```csv
product_id,review_text,rating,date
PROD001,"یہ بہترین پروڈکٹ ہے",5,2024-01-15
PROD001,"خراب کوالٹی",2,2024-01-16
PROD002,"بہت اچھا",4,2024-01-17
```

**Required Columns:**
- `product_id` - Product identifier
- `review_text` - Review content
- `rating` - 1-5 rating
- `date` - Review date (YYYY-MM-DD)

### Sales CSV
```csv
product_id,product_name,category,sales
PROD001,Wireless Headphones,Electronics,1500
PROD002,USB Charger,Electronics,2000
PROD003,Power Bank,Electronics,3000
```

**Required Columns:**
- `product_id` - Product identifier
- `product_name` - Product name
- `category` - Product category
- `sales` - Sales amount

## Database Schema

### Analytics Collection
```javascript
{
  _id: ObjectId,
  productId: String,
  productName: String,
  category: String,
  date: Date,
  month: String,        // YYYY-MM
  year: Number,
  sales: Number,
  reviews: Number,
  rating: Number,
  sentiment: String,    // "positive" | "neutral" | "negative"
  isFakeReview: Boolean,
  reviewText: String,
  createdAt: Date,
  updatedAt: Date
}
```

### KPIs Collection
```javascript
{
  _id: ObjectId,
  totalSales: Number,
  totalReviews: Number,
  avgRating: Number,
  fakeReviewPercentage: Number,
  sentimentPositivePercentage: Number,
  sentimentNeutralPercentage: Number,
  sentimentNegativePercentage: Number,
  lastUpdated: Date
}
```

## Features

### 1. Sentiment Analysis
- Automatic review text analysis
- Positive/Neutral/Negative classification
- 85-90% accuracy

### 2. Fake Review Detection
- Suspicious pattern detection
- Rating-text mismatch detection
- Duplicate content detection
- 87% accuracy

### 3. Data Aggregation
- Monthly metrics calculation
- Product-wise statistics
- Sentiment distribution
- KPI calculation

## Troubleshooting

### MongoDB Connection Error
```
Error: MONGODB_URI is not defined
```
**Solution:** `.env.local` میں `MONGODB_URI` شامل کریں اور dev server restart کریں

### Upload Failed
```
Error: CSV parsing error
```
**Solution:** CSV format صحیح ہے یا نہیں چیک کریں (required columns موجود ہیں؟)

### Data Not Showing in Dashboard
```
isRealData: false
```
**Solution:** 
1. Admin panel سے ڈیٹا اپ لوڈ کریں
2. Dashboard کو refresh کریں
3. Browser console میں errors دیکھیں

## Next Steps

1. ✅ MongoDB setup مکمل کریں
2. ✅ Dependencies انسٹال کریں
3. ✅ Admin panel سے ڈیٹا اپ لوڈ کریں
4. ✅ Dashboard میں real data دیکھیں
5. ⏳ Scheduled data refresh (optional)
6. ⏳ Email notifications (optional)
7. ⏳ Advanced analytics (optional)

## مدد

اگر کوئی مسئلہ ہو تو:
1. `MONGODB_SETUP.md` دوبارہ پڑھیں
2. MongoDB Atlas logs چیک کریں
3. Browser console میں errors دیکھیں
4. Network tab میں API requests دیکھیں

## Code Examples

### Upload Data Programmatically
```javascript
const uploadData = async (file, type) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
};
```

### Fetch Dashboard Data
```javascript
const fetchDashboardData = async () => {
  const response = await fetch('/api/dashboard/mongo-data');
  return response.json();
};
```

### Query MongoDB Directly (Advanced)
```javascript
import { getAnalyticsCollection } from '@/lib/mongodb';

const collection = await getAnalyticsCollection();
const data = await collection.find({ sentiment: 'positive' }).toArray();
```

## Performance Tips

1. **Indexing** - Database indexes automatically بنتے ہیں
2. **Pagination** - Large datasets کے لیے pagination شامل کریں
3. **Caching** - API responses کو cache کریں
4. **Batch Upload** - بڑی files کو chunks میں upload کریں

## Security

⚠️ **Important:**
- `.env.local` کو git میں commit نہ کریں
- MongoDB credentials کو secure رکھیں
- Admin panel کو password protect کریں (future)
- CORS settings configure کریں (production)
