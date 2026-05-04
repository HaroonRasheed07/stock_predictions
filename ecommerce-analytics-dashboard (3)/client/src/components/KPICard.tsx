/**
 * KPI Card Component
 * 
 * Displays a single key performance indicator with:
 * - Animated counter for metric value
 * - Label and unit
 * - Optional trend indicator
 * - Hover effects aligned with Modern Data Minimalism design
 * 
 * Design: Swiss-style minimalism with teal accent
 */

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
  format?: "currency" | "number" | "percentage" | "decimal";
  icon?: React.ReactNode;
}

const formatValue = (value: number, format: string): string => {
  switch (format) {
    case "currency":
      return `$${(value / 1000).toFixed(1)}K`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "decimal":
      return value.toFixed(1);
    case "number":
    default:
      return Math.floor(value).toLocaleString();
  }
};

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  unit,
  trend,
  trendValue,
  format = "number",
  icon,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  // Animated counter effect
  useEffect(() => {
    const duration = 800; // ms
    const steps = 60;
    const stepValue = value / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setDisplayValue(stepValue * currentStep);

      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(interval);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div
      className="bg-white border border-teal-200 rounded-lg p-6 hover:shadow-lg hover:border-teal-400 transition-all duration-300 group cursor-default"
    >
      {/* Header with icon and label */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-teal-700 tracking-wide uppercase">
            {label}
          </p>
        </div>
        {icon && (
          <div className="text-teal-400 group-hover:text-teal-600 transition-colors duration-300">
            {icon}
          </div>
        )}
      </div>

      {/* Main metric value */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-teal-900 font-mono">
            {formatValue(displayValue, format)}
          </span>
          {unit && <span className="text-sm text-teal-600">{unit}</span>}
        </div>
      </div>

      {/* Trend indicator */}
      {trend && trendValue !== undefined && (
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            trend === "up"
              ? "text-teal-600"
              : trend === "down"
                ? "text-red-600"
                : "text-teal-500"
          }`}
        >
          {trend === "up" && <TrendingUp size={16} />}
          {trend === "down" && <TrendingDown size={16} />}
          <span>
            {trend === "neutral" ? "—" : `${Math.abs(trendValue).toFixed(1)}%`}
          </span>
        </div>
      )}

      {/* Subtle divider line (signature element) */}
      <div className="mt-4 pt-4 border-t border-teal-100" />
    </div>
  );
};

export default KPICard;
