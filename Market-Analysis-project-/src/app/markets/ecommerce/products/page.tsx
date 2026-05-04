'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Star, ShieldAlert, TrendingUp, BarChart3, ArrowUpDown } from 'lucide-react';
import {
  fetchProducts,
  fetchOverview,
  formatCurrency,
  formatNumber,
  formatPercent,
  type Product,
  type MonthlyMetric,
} from '@/lib/ecommerceApi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = { positive: '#10b981', neutral: '#8b5cf6', negative: '#ef4444' };

export default function EcommerceProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<'sales' | 'reviews' | 'rating'>('sales');
  const [selectedYear, setSelectedYear] = useState(2024);

  useEffect(() => {
    setLoading(true);
    fetchOverview(selectedYear)
      .then((data) => {
        setAllProducts(data.products);
        setProducts(data.products);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedYear]);

  useEffect(() => {
    const sorted = [...allProducts].sort((a, b) => {
      if (sortBy === 'sales') return b.totalSales - a.totalSales;
      if (sortBy === 'reviews') return b.totalReviews - a.totalReviews;
      return b.avgRating - a.avgRating;
    });
    setProducts(sorted);
  }, [sortBy, allProducts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading products...</span>
      </div>
    );
  }

  const sentimentPieData = selectedProduct
    ? [
        { name: 'Positive', value: selectedProduct.sentimentBreakdown.positive, color: COLORS.positive },
        { name: 'Neutral', value: selectedProduct.sentimentBreakdown.neutral, color: COLORS.neutral },
        { name: 'Negative', value: selectedProduct.sentimentBreakdown.negative, color: COLORS.negative },
      ]
    : [];

  const productMonthly = selectedProduct?.monthlyData?.filter((m: MonthlyMetric) =>
    m.date.startsWith(String(selectedYear))
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag size={24} />
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{allProducts.length} products tracked</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value={2023}>2023</option>
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
          </select>
          <div className="flex rounded-lg border overflow-hidden">
            {[
              { key: 'sales' as const, label: 'Sales', icon: TrendingUp },
              { key: 'reviews' as const, label: 'Reviews', icon: BarChart3 },
              { key: 'rating' as const, label: 'Rating', icon: Star },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition ${
                  sortBy === s.key ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                <s.icon size={12} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="lg:col-span-1 space-y-3 max-h-[800px] overflow-y-auto pr-2">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedProduct?.id === p.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedProduct(selectedProduct?.id === p.id ? null : p)}
              >
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-1 line-clamp-1">{p.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{p.category}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Sales</span>
                      <p className="font-semibold">{formatCurrency(p.totalSales)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reviews</span>
                      <p className="font-semibold">{formatNumber(p.totalReviews)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rating</span>
                      <p className="font-semibold flex items-center gap-0.5">
                        <Star size={10} className="text-yellow-500" />
                        {p.avgRating}
                      </p>
                    </div>
                  </div>
                  {p.fakeReviewPercentage > 15 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
                      <ShieldAlert size={10} />
                      {formatPercent(p.fakeReviewPercentage)} fake reviews
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Product Detail */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <motion.div
              key={selectedProduct.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Product Header */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold mb-1">{selectedProduct.name}</h2>
                  <p className="text-sm text-muted-foreground mb-4">{selectedProduct.category}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Total Sales</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedProduct.totalSales)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Reviews</p>
                      <p className="text-lg font-bold">{formatNumber(selectedProduct.totalReviews)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Avg Rating</p>
                      <p className="text-lg font-bold flex items-center justify-center gap-1">
                        <Star size={14} className="text-yellow-500" />
                        {selectedProduct.avgRating}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Fake Reviews</p>
                      <p className={`text-lg font-bold ${selectedProduct.fakeReviewPercentage > 15 ? 'text-red-500' : ''}`}>
                        {formatPercent(selectedProduct.fakeReviewPercentage)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              {productMonthly.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Monthly Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={productMonthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Sentiment Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                            {sentimentPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sentiment Trend */}
              {productMonthly.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Sentiment Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={productMonthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="sentimentPositive" stroke={COLORS.positive} strokeWidth={2} dot={false} name="Positive" />
                        <Line type="monotone" dataKey="sentimentNeutral" stroke={COLORS.neutral} strokeWidth={2} dot={false} name="Neutral" />
                        <Line type="monotone" dataKey="sentimentNegative" stroke={COLORS.negative} strokeWidth={2} dot={false} name="Negative" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ShoppingBag size={40} className="mb-4 opacity-20" />
                <p className="text-sm">Select a product to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
