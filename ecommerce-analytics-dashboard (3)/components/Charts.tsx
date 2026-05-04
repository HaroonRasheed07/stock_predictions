'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { MonthlyMetric } from '@/types';

interface ChartsProps {
  metrics: MonthlyMetric[];
}

export default function Charts({ metrics }: ChartsProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="card bg-white border-2 border-border-color p-8 text-center">
        <p className="text-text-muted">No data available for the selected filters</p>
      </div>
    );
  }

  // Prepare data for charts
  const chartData = metrics.map((m) => ({
    month: m.month,
    sales: m.sales,
    reviews: m.reviews,
    avgRating: m.avgRating,
    fakeReviewPercentage: m.fakeReviewPercentage,
    positive: m.sentimentPositive,
    neutral: m.sentimentNeutral,
    negative: m.sentimentNegative,
  }));

  const sentimentData = [
    { name: 'Positive', value: metrics.reduce((sum, m) => sum + m.sentimentPositive, 0) },
    { name: 'Neutral', value: metrics.reduce((sum, m) => sum + m.sentimentNeutral, 0) },
    { name: 'Negative', value: metrics.reduce((sum, m) => sum + m.sentimentNegative, 0) },
  ];

  const COLORS = ['#00a896', '#b2dfdb', '#ff6b6b'];

  return (
    <div className="space-y-6">
      {/* Monthly Sales */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Monthly Sales
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
            <XAxis dataKey="month" stroke="#607d8b" />
            <YAxis stroke="#607d8b" />
            <Tooltip contentStyle={{ backgroundColor: '#f0fffe', border: '2px solid #00a896' }} />
            <Legend />
            <Line type="monotone" dataKey="sales" stroke="#00a896" strokeWidth={2} dot={{ fill: '#00d4d4' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Reviews */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Monthly Reviews
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
            <XAxis dataKey="month" stroke="#607d8b" />
            <YAxis stroke="#607d8b" />
            <Tooltip contentStyle={{ backgroundColor: '#f0fffe', border: '2px solid #00a896' }} />
            <Legend />
            <Bar dataKey="reviews" fill="#00a896" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sentiment Trends */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Sentiment Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
            <XAxis dataKey="month" stroke="#607d8b" />
            <YAxis stroke="#607d8b" />
            <Tooltip contentStyle={{ backgroundColor: '#f0fffe', border: '2px solid #00a896' }} />
            <Legend />
            <Line type="monotone" dataKey="positive" stroke="#00a896" strokeWidth={2} name="Positive" />
            <Line type="monotone" dataKey="neutral" stroke="#b2dfdb" strokeWidth={2} name="Neutral" />
            <Line type="monotone" dataKey="negative" stroke="#ff6b6b" strokeWidth={2} name="Negative" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Fake Review Trends */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Fake Review Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
            <XAxis dataKey="month" stroke="#607d8b" />
            <YAxis stroke="#607d8b" />
            <Tooltip contentStyle={{ backgroundColor: '#f0fffe', border: '2px solid #00a896' }} />
            <Legend />
            <Line
              type="monotone"
              dataKey="fakeReviewPercentage"
              stroke="#ff6b6b"
              strokeWidth={2}
              name="Fake Review %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sentiment Distribution */}
      <div className="card bg-white border-2 border-border-color">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Overall Sentiment Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={sentimentData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
              {sentimentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
