'use client';

import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon | string;
  color?: string;
  trend?: number;
  subtitle?: string;
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  color = 'primary',
  trend,
  subtitle,
}: KPICardProps) {
  const isLucideIcon = Icon && typeof Icon === 'function';

  return (
    <div className="card bg-teal-50 border-2 border-primary-light hover:border-primary hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">{title}</h3>
        {isLucideIcon && <Icon className="w-5 h-5 text-primary-light" />}
        {!isLucideIcon && typeof Icon === 'string' && <span className="text-2xl">{Icon}</span>}
      </div>

      <div className="mb-3">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
      </div>

      {trend !== undefined && (
        <div className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last period
        </div>
      )}
    </div>
  );
}
