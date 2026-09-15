'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useIsMobile, getCanvasTheme, CHART_HEIGHTS, formatPriceTick } from '@/lib/chartUtils';

interface CandleDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: CandleDataPoint[];
  ticker: string;
  height?: number;
}

export default function ProfessionalCandlestickChart({
  data,
  ticker,
  height: heightProp,
}: CandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<CandleDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isMobile = useIsMobile();
  const theme = getCanvasTheme(!isMobile);

  const height = heightProp || (isMobile ? CHART_HEIGHTS.candlestick.mobile : CHART_HEIGHTS.candlestick.desktop);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-60 sm:h-80 text-muted-foreground">
        No data available
      </div>
    );
  }

  const filteredData = data;
  const prices = filteredData.flatMap((d) => [d.high, d.low, d.open, d.close]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.15;

  const latest = filteredData[filteredData.length - 1];
  const previous = filteredData[filteredData.length - 2] || latest;
  const changeAmount = latest.close - previous.close;
  const changePercent = ((changeAmount / previous.close) * 100).toFixed(2);
  const isPositive = changeAmount >= 0;

  const CHART_PADDING = isMobile
    ? { top: 16, bottom: 40, left: 48, right: 12 }
    : { top: 40, bottom: 60, left: 70, right: 40 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

    // Grid lines
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;

    const priceStep = (maxPrice + padding - (minPrice - padding)) / (isMobile ? 5 : 8);
    const gridLines = isMobile ? 5 : 8;
    for (let i = 0; i <= gridLines; i++) {
      const price = minPrice - padding + priceStep * i;
      const y = CHART_PADDING.top + chartHeight - ((price - (minPrice - padding)) / (maxPrice + padding - (minPrice - padding))) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(CHART_PADDING.left, y);
      ctx.lineTo(width - CHART_PADDING.right, y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.mutedForeground;
      ctx.font = `${isMobile ? 9 : 11}px system-ui`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatPriceTick(price), CHART_PADDING.left - 6, y);
      ctx.globalAlpha = 0.2;
    }

    // Vertical grid
    ctx.globalAlpha = 0.08;
    const maxXTicks = isMobile ? 4 : 10;
    const dateInterval = Math.max(1, Math.ceil(filteredData.length / maxXTicks));
    for (let i = 0; i < filteredData.length; i += dateInterval) {
      const x = CHART_PADDING.left + (i / (filteredData.length - 1)) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, CHART_PADDING.top);
      ctx.lineTo(x, height - CHART_PADDING.bottom);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.mutedForeground;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, height - CHART_PADDING.bottom);
      ctx.lineTo(x, height - CHART_PADDING.bottom + 4);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
    }

    // Axes
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING.left, CHART_PADDING.top);
    ctx.lineTo(CHART_PADDING.left, height - CHART_PADDING.bottom);
    ctx.lineTo(width - CHART_PADDING.right, height - CHART_PADDING.bottom);
    ctx.stroke();

    // Candlesticks
    const candleWidth = (chartWidth / filteredData.length) * 0.7;
    const candleSpacing = chartWidth / filteredData.length;

    filteredData.forEach((candle, index) => {
      const x = CHART_PADDING.left + index * candleSpacing + candleSpacing / 2;
      const yScale = (price: number) =>
        CHART_PADDING.top + chartHeight - ((price - (minPrice - padding)) / (maxPrice + padding - (minPrice - padding))) * chartHeight;

      const openY = yScale(candle.open);
      const closeY = yScale(candle.close);
      const highY = yScale(candle.high);
      const lowY = yScale(candle.low);

      const isBullish = candle.close >= candle.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY);
      const bodyHeightMin = bodyHeight < 1 ? 1 : bodyHeight;

      ctx.strokeStyle = isBullish ? '#16a34a' : '#dc2626';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const bodyColor = isBullish ? '#22c55e' : '#ef4444';
      ctx.fillStyle = bodyColor;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeightMin);

      ctx.strokeStyle = isBullish ? '#15803d' : '#991b1b';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeightMin);

      if (hoveredCandle === index) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = theme.primary;
        ctx.fillRect(x - candleSpacing / 2, CHART_PADDING.top, candleSpacing, chartHeight);
      }
    });

    // Date labels
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.mutedForeground;
    ctx.font = `${isMobile ? 9 : 11}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < filteredData.length; i += dateInterval) {
      const x = CHART_PADDING.left + (i / (filteredData.length - 1)) * chartWidth;
      const date = filteredData[i].date;
      ctx.fillText(date, x, height - CHART_PADDING.bottom + 6);
    }
  }, [filteredData, height, hoveredCandle, isMobile, theme, CHART_PADDING, maxPrice, minPrice, padding]);

  useEffect(() => {
    const handleResize = () => setHoveredCandle((v) => v);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointer = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX;

    const x = clientX - rect.left;
    const chartWidth = canvas.clientWidth - CHART_PADDING.left - CHART_PADDING.right;
    const relativeX = x - CHART_PADDING.left;

    if (relativeX < 0 || relativeX > chartWidth) {
      setHoveredCandle(null);
      setTooltipData(null);
      return;
    }

    const candleIndex = Math.round((relativeX / chartWidth) * (filteredData.length - 1));
    if (candleIndex >= 0 && candleIndex < filteredData.length) {
      setHoveredCandle(candleIndex);
      setTooltipData(filteredData[candleIndex]);
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY;
      setTooltipPos({ x: clientX - rect.left, y: clientY - rect.top });
    }
  };

  const handleLeave = () => {
    setHoveredCandle(null);
    setTooltipData(null);
  };

  const tooltipLeft = isMobile
    ? Math.min(tooltipPos.x + 8, (containerRef.current?.clientWidth || 300) - 160)
    : Math.min(tooltipPos.x + 15, (containerRef.current?.clientWidth || 0) - 200);

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Header Stats — 2x2 grid on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-lg border border-border/50 p-2.5 sm:p-4 bg-card/50">
          <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Price</p>
          <p className="text-base sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">${latest.close.toFixed(2)}</p>
          <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(changePercent))}%
          </p>
        </div>
        <div className="rounded-lg border border-border/50 p-2.5 sm:p-4 bg-card/50">
          <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">High</p>
          <p className="text-base sm:text-2xl font-bold text-green-500 mt-0.5 sm:mt-1">${latest.high.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-2.5 sm:p-4 bg-card/50">
          <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Low</p>
          <p className="text-base sm:text-2xl font-bold text-red-500 mt-0.5 sm:mt-1">${latest.low.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-2.5 sm:p-4 bg-card/50">
          <p className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground">Open</p>
          <p className="text-base sm:text-2xl font-bold text-blue-500 mt-0.5 sm:mt-1">${latest.open.toFixed(2)}</p>
        </div>
      </div>

      {/* Canvas Chart */}
      <div
        ref={containerRef}
        className="relative rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden touch-none"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handlePointer}
          onMouseLeave={handleLeave}
          onTouchMove={handlePointer}
          onTouchEnd={handleLeave}
          className="w-full cursor-crosshair"
          style={{ display: 'block' }}
        />

        {tooltipData && hoveredCandle !== null && (
          <div
            className="absolute bg-card border-2 border-primary rounded-lg p-2 sm:p-3 shadow-lg z-10 text-xs sm:text-sm pointer-events-none"
            style={{ left: tooltipLeft, top: isMobile ? Math.max(4, tooltipPos.y - 100) : tooltipPos.y - 120 }}
          >
            <p className="font-bold text-primary mb-1 sm:mb-2">{tooltipData.date}</p>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-green-500"><span className="text-muted-foreground">H:</span> ${tooltipData.high.toFixed(2)}</p>
              <p className="text-blue-500"><span className="text-muted-foreground">O:</span> ${tooltipData.open.toFixed(2)}</p>
              <p className="text-cyan-500"><span className="text-muted-foreground">C:</span> ${tooltipData.close.toFixed(2)}</p>
              <p className="text-red-500"><span className="text-muted-foreground">L:</span> ${tooltipData.low.toFixed(2)}</p>
              <p className="text-purple-400"><span className="text-muted-foreground">V:</span> {formatCompactVol(tooltipData.volume)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend — horizontal wrap */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 sm:w-6 sm:h-4 border-2 border-green-500 bg-green-500/20 rounded-sm" />
          <span>Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 sm:w-6 sm:h-4 border-2 border-red-500 bg-red-500/20 rounded-sm" />
          <span>Bearish</span>
        </div>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">{isMobile ? 'Tap' : 'Hover'} for details</span>
      </div>

      {/* Summary Stats — scrollable on mobile */}
      <div className="flex sm:grid sm:grid-cols-5 gap-2 sm:gap-3 text-sm overflow-x-auto pb-1 -mx-1 px-1">
        <div className="min-w-[100px] sm:min-w-0 p-2 sm:p-3 rounded border border-border/30 bg-gradient-to-br from-green-500/10 to-transparent shrink-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Range</p>
          <p className="text-sm sm:text-lg font-bold text-green-500">${(latest.high - latest.low).toFixed(2)}</p>
        </div>
        <div className="min-w-[100px] sm:min-w-0 p-2 sm:p-3 rounded border border-border/30 bg-gradient-to-br from-blue-500/10 to-transparent shrink-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Change</p>
          <p className={`text-sm sm:text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''} ${changeAmount.toFixed(2)}
          </p>
        </div>
        <div className="min-w-[100px] sm:min-w-0 p-2 sm:p-3 rounded border border-border/30 bg-gradient-to-br from-purple-500/10 to-transparent shrink-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">% Change</p>
          <p className={`text-sm sm:text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''} {changePercent}%
          </p>
        </div>
        <div className="min-w-[100px] sm:min-w-0 p-2 sm:p-3 rounded border border-border/30 bg-gradient-to-br from-cyan-500/10 to-transparent shrink-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Volume</p>
          <p className="text-sm sm:text-lg font-bold text-cyan-400">{formatCompactVol(latest.volume)}</p>
        </div>
        <div className="min-w-[100px] sm:min-w-0 p-2 sm:p-3 rounded border border-border/30 bg-gradient-to-br from-orange-500/10 to-transparent shrink-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Points</p>
          <p className="text-sm sm:text-lg font-bold text-orange-400">{data.length}</p>
        </div>
      </div>
    </div>
  );
}

function formatCompactVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}
