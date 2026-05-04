'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3, Star, ShieldAlert, ThumbsUp, Download, ShoppingBag } from 'lucide-react';
import {
  fetchOverview,
  formatCurrency,
  formatNumber,
  formatPercent,
  type OverviewResponse,
  type Product,
  type MonthlyMetric,
} from '@/lib/ecommerceApi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = { positive: '#10b981', neutral: '#8b5cf6', negative: '#ef4444' };

export default function EcommerceOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(2024);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchOverview(selectedYear)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Date', 'Month', 'Sales', 'Reviews', 'Avg Rating', 'Fake Reviews %', 'Positive', 'Neutral', 'Negative'];
    const rows = data.monthlyMetrics.map((m: MonthlyMetric) => [
      m.date, m.month, m.sales, m.reviews, m.avgRating, m.fakeReviewPercentage,
      m.sentimentPositive, m.sentimentNeutral, m.sentimentNegative,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecommerce-analytics-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-sm text-muted-foreground">{error || 'No data available'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = data.kpis;
  const sentimentPieData = [
    { name: 'Positive', value: kpis.sentimentPositivePercentage, color: COLORS.positive },
    { name: 'Neutral', value: kpis.sentimentNeutralPercentage, color: COLORS.neutral },
    { name: 'Negative', value: kpis.sentimentNegativePercentage, color: COLORS.negative },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-commerce Analytics</h1>
          <p className="text-sm text-muted-foreground">Amazon Sales & Review Analytics ({selectedYear})</p>
          {data.isMockData && (
            <p className="text-xs text-yellow-600 mt-1"></p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            {data.yearsAvailable.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Sales', value: formatCurrency(kpis.totalSales), icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Total Reviews', value: formatNumber(kpis.totalReviews), icon: BarChart3, color: 'text-blue-500' },
          { label: 'Avg Rating', value: `${kpis.avgRating} / 5.0`, icon: Star, color: 'text-yellow-500' },
          { label: 'Fake Reviews', value: formatPercent(kpis.fakeReviewPercentage), icon: ShieldAlert, color: 'text-red-500' },
          { label: 'Positive Sentiment', value: formatPercent(kpis.sentimentPositivePercentage), icon: ThumbsUp, color: 'text-green-500' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <kpi.icon size={16} className={kpi.color} />
                </div>
                <p className="text-xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1: Sales & Reviews Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="reviews" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Sentiment Trend & Fake Review Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sentimentPositive" stroke={COLORS.positive} strokeWidth={2} dot={false} name="Positive" />
                <Line type="monotone" dataKey="sentimentNeutral" stroke={COLORS.neutral} strokeWidth={2} dot={false} name="Neutral" />
                <Line type="monotone" dataKey="sentimentNegative" stroke={COLORS.negative} strokeWidth={2} dot={false} name="Negative" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fake Review Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="fakeReviewPercentage" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Top Products & Sentiment Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 5 Products by Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.topProductsBySales.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="totalSales" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Overall Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
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

      {/* Product Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingBag size={16} />
            All Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-3">Product</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-right py-2 px-3">Sales</th>
                  <th className="text-right py-2 px-3">Reviews</th>
                  <th className="text-right py-2 px-3">Rating</th>
                  <th className="text-right py-2 px-3">Fake %</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p: Product) => (
                  <tr key={p.id} className="border-b hover:bg-muted/50 transition">
                    <td className="py-2 px-3 font-medium max-w-[200px] truncate">{p.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{p.category}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(p.totalSales)}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(p.totalReviews)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Star size={12} className="text-yellow-500" />
                        {p.avgRating}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={p.fakeReviewPercentage > 15 ? 'text-red-500 font-medium' : ''}>
                        {formatPercent(p.fakeReviewPercentage)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
