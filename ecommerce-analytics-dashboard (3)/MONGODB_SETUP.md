# MongoDB Setup Guide

یہ guide آپ کو MongoDB کو اپنے E-commerce Analytics Dashboard کے ساتھ setup کرنے میں مدد دے گا۔

## Step 1: MongoDB Atlas Account بنائیں

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) پر جائیں
2. "Sign Up" پر کلک کریں
3. اپنا email اور password درج کریں
4. Email verify کریں

## Step 2: Cluster بنائیں

1. Dashboard میں "Create a Cluster" پر کلک کریں
2. **M0 (Free)** tier منتخب کریں
3. اپنا preferred region منتخب کریں (مثال: Asia - Mumbai)
4. "Create Cluster" پر کلک کریں
5. Cluster کے بننے کا انتظار کریں (5-10 منٹ)

## Step 3: Database User بنائیں

1. "Database Access" پر جائیں
2. "Add New Database User" پر کلک کریں
3. Username اور Password درج کریں (یاد رکھیں!)
4. "Add User" پر کلک کریں

## Step 4: Connection String حاصل کریں

1. "Clusters" پر جائیں
2. اپنے cluster کے لیے "Connect" پر کلک کریں
3. "Connect your application" منتخب کریں
4. Node.js اور version 4.1 or later منتخب کریں
5. Connection string کو copy کریں

Connection string کچھ اس طرح لگے گا:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ecommerce-analytics?retryWrites=true&w=majority
```

## Step 5: Environment Variable شامل کریں

1. Project root میں `.env.local` فائل کھولیں
2. یہ لائن شامل کریں:
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ecommerce-analytics?retryWrites=true&w=majority
```

**اہم:** `username` اور `password` کو اپنی database user کی معلومات سے بدلیں

## Step 6: Dependencies انسٹال کریں

```bash
npm install mongodb papaparse
# یا
pnpm add mongodb papaparse
```

## Step 7: Dev Server دوبارہ شروع کریں

```bash
npm run dev
# یا
pnpm dev
```

## Step 8: Admin Panel میں ڈیٹا اپ لوڈ کریں

1. `http://localhost:3000/admin` پر جائیں
2. اپنی CSV فائل اپ لوڈ کریں
3. اگر سب کچھ ٹھیک ہے تو آپ کو success message ملے گا

## CSV فائل کی Format

### Reviews CSV
```csv
product_id,review_text,rating,date
PROD001,"یہ بہترین پروڈکٹ ہے",5,2024-01-15
PROD001,"خراب کوالٹی",2,2024-01-16
```

### Sales CSV
```csv
product_id,product_name,category,sales
PROD001,Wireless Headphones,Electronics,1500
PROD002,USB Charger,Electronics,2000
```

## Troubleshooting

### "MONGODB_URI is not defined" Error
- `.env.local` فائل میں `MONGODB_URI` شامل ہے یا نہیں چیک کریں
- Dev server کو دوبارہ شروع کریں

### "Connection refused" Error
- MongoDB Atlas میں IP Whitelist میں اپنا IP شامل کریں
- "Network Access" → "Add IP Address" → "Allow Access from Anywhere"

### "Authentication failed" Error
- Username اور password صحیح ہیں یا نہیں چیک کریں
- Database user کو دوبارہ بنانے کی کوشش کریں

## API Endpoints

### Data Upload
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@reviews.csv" \
  -F "type=reviews"
```

### Get Dashboard Data
```bash
curl http://localhost:3000/api/dashboard/mongo-data
```

## Next Steps

1. ✅ MongoDB setup مکمل کریں
2. ✅ Admin panel سے ڈیٹا اپ لوڈ کریں
3. ✅ Dashboard میں real data دیکھیں
4. ✅ Scheduled data refresh setup کریں (optional)

## مدد اور سوالات

اگر کوئی مسئلہ ہو تو:
1. Browser console میں errors دیکھیں
2. MongoDB Atlas logs چیک کریں
3. `.env.local` میں connection string دوبارہ چیک کریں
