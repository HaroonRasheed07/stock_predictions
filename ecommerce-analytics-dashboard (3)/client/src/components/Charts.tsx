/**
 * Chart Components
 * 
 * Reusable chart components built with Recharts:
 * - Time-series line charts for sales, reviews, sentiment trends
 * - Bar charts for top products
 * - Pie charts for sentiment distribution
 * 
 * Design: Minimalist with teal accent and smooth animations
 * All charts use the same color scheme for consistency
 */

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MonthlyMetric, Product } from "@/lib/mockData";

// Color palette aligned with Modern Data Minimalism design
const COLORS = {
  primary: "#00d4d4", // Teal accent
  secondary: "#1a1a1a", // Deep charcoal
  positive: "#10b981", // Green
  neutral: "#8b5cf6", // Purple
  negative: "#ef4444", // Red
  grid: "#f0f0f0",
};

// ============================================================================
// TIME-SERIES CHARTS
// ============================================================================

interface TimeSeriesChartProps {
  data: MonthlyMetric[];
  title: string;
  dataKey: string;
  unit?: string;
  color?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  title,
  dataKey,
  unit = "",
  color = COLORS.primary,
}) => {
  // Format data for display (show every 3rd month to avoid crowding)
  const displayData = data.map((item, index) => ({
    ...item,
    displayMonth: index % 3 === 0 ? item.month.slice(0, 3) : "",
  }));

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={displayData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="displayMonth"
            stroke={COLORS.secondary}
            style={{ fontSize: "12px" }}
          />
          <YAxis stroke={COLORS.secondary} style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: `1px solid ${COLORS.grid}`,
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [
              value.toLocaleString(),
              `${dataKey} ${unit}`,
            ]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// MULTI-LINE TIME-SERIES CHART
// ============================================================================

interface MultiLineChartProps {
  data: MonthlyMetric[];
  title: string;
  lines: Array<{
    dataKey: string;
    label: string;
    color: string;
  }>;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  title,
  lines,
}) => {
  const displayData = data.map((item, index) => ({
    ...item,
    displayMonth: index % 3 === 0 ? item.month.slice(0, 3) : "",
  }));

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={displayData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="displayMonth"
            stroke={COLORS.secondary}
            style={{ fontSize: "12px" }}
          />
          <YAxis stroke={COLORS.secondary} style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: `1px solid ${COLORS.grid}`,
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              name={line.label}
              isAnimationActive={true}
              animationDuration={500}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// BAR CHART FOR TOP PRODUCTS
// ============================================================================

interface TopProductsChartProps {
  products: Product[];
  metric: "sales" | "reviews" | "rating";
  title: string;
  limit?: number;
}

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  products,
  metric,
  title,
  limit = 5,
}) => {
  // Prepare data
  const topProducts = [...products]
    .sort((a, b) => {
      if (metric === "sales") return b.totalSales - a.totalSales;
      if (metric === "reviews") return b.totalReviews - a.totalReviews;
      return b.avgRating - a.avgRating;
    })
    .slice(0, limit)
    .map((p) => ({
      name: p.name.length > 20 ? p.name.slice(0, 17) + "..." : p.name,
      value:
        metric === "sales"
          ? p.totalSales
          : metric === "reviews"
            ? p.totalReviews
            : p.avgRating,
    }));

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={topProducts}
          margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke={COLORS.secondary}
            style={{ fontSize: "11px" }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis stroke={COLORS.secondary} style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: `1px solid ${COLORS.grid}`,
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => value.toLocaleString()}
          />
          <Bar
            dataKey="value"
            fill={COLORS.primary}
            isAnimationActive={true}
            animationDuration={500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// PIE CHART FOR SENTIMENT DISTRIBUTION
// ============================================================================

interface SentimentPieChartProps {
  positive: number;
  neutral: number;
  negative: number;
  title?: string;
}

export const SentimentPieChart: React.FC<SentimentPieChartProps> = ({
  positive,
  neutral,
  negative,
  title = "Sentiment Distribution",
}) => {
  const data = [
    { name: "Positive", value: positive, fill: COLORS.positive },
    { name: "Neutral", value: neutral, fill: COLORS.neutral },
    { name: "Negative", value: negative, fill: COLORS.negative },
  ];

  const total = positive + neutral + negative;

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${((value / total) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            isAnimationActive={true}
            animationDuration={500}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              `${((value / total) * 100).toFixed(1)}%`,
              "Percentage",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {
  TimeSeriesChart,
  MultiLineChart,
  TopProductsChart,
  SentimentPieChart,
};
