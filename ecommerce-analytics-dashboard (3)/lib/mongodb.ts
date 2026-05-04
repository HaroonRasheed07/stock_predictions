/**
 * MongoDB Connection Utility
 * 
 * This file handles all MongoDB connections and database operations
 * 
 * Setup:
 * 1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
 * 2. Create a new cluster
 * 3. Get your connection string
 * 4. Add to .env.local:
 *    MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecommerce-analytics?retryWrites=true&w=majority
 */

import { MongoClient, Db, Collection } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface AnalyticsData {
  _id?: string;
  productId: string;
  productName: string;
  category: string;
  date: string;
  month: string;
  year: number;
  sales: number;
  reviews: number;
  rating: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  isFakeReview: boolean;
  reviewText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIData {
  _id?: string;
  totalSales: number;
  totalReviews: number;
  avgRating: number;
  fakeReviewPercentage: number;
  sentimentPositivePercentage: number;
  sentimentNeutralPercentage: number;
  sentimentNegativePercentage: number;
  lastUpdated: Date;
}

async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db('ecommerce-analytics');

    // Cache the connection
    cachedClient = client;
    cachedDb = db;

    console.log('✅ Connected to MongoDB');
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function getAnalyticsCollection(): Promise<Collection<AnalyticsData>> {
  const { db } = await connectToDatabase();
  return db.collection<AnalyticsData>('analytics');
}

export async function getKPICollection(): Promise<Collection<KPIData>> {
  const { db } = await connectToDatabase();
  return db.collection<KPIData>('kpis');
}

export async function createIndexes(): Promise<void> {
  const analyticsCollection = await getAnalyticsCollection();
  const kpiCollection = await getKPICollection();

  // Create indexes for faster queries
  await analyticsCollection.createIndex({ productId: 1 });
  await analyticsCollection.createIndex({ date: 1 });
  await analyticsCollection.createIndex({ month: 1 });
  await analyticsCollection.createIndex({ year: 1 });
  await analyticsCollection.createIndex({ sentiment: 1 });
  await analyticsCollection.createIndex({ isFakeReview: 1 });
  await analyticsCollection.createIndex({ productId: 1, date: 1 });

  console.log('✅ Database indexes created');
}

export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('✅ MongoDB connection closed');
  }
}
