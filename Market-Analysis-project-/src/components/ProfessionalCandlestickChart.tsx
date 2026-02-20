'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

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
  height = 600,
}: CandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<CandleDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        No data available
      </div>
    );
  }
  // `data` is expected to be pre-filtered by parent (Technical page) for timeframe
  const filteredData = data;

  // Calculate price range
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

  // Canvas dimensions
  const CHART_PADDING = {
    top: 40,
    bottom: 60,
    left: 70,
    right: 40,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    canvas.width = width;
    canvas.height = height;

    // Leave canvas transparent so parent `bg-card` matches other charts
    ctx.clearRect(0, 0, width, height);

    // Resolve CSS variables to actual colors so canvas matches SVG charts
    const resolveColor = (cssValue: string) => {
      try {
        const tmp = document.createElement('div');
        tmp.style.color = cssValue;
        tmp.style.display = 'none';
        document.body.appendChild(tmp);
        const resolved = getComputedStyle(tmp).color;
        document.body.removeChild(tmp);
        return resolved || cssValue;
      } catch (e) {
        return cssValue;
      }
    };

    const mutedColor = resolveColor('hsl(var(--muted-foreground))');
    const borderColor = resolveColor('hsl(var(--border))');
    const primaryColor = resolveColor('hsl(var(--primary))');

    const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

    // Draw grid and axes
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;

    // Horizontal grid lines and price labels
    const priceStep = (maxPrice + padding - (minPrice - padding)) / 8;
    for (let i = 0; i <= 8; i++) {
      const price = minPrice - padding + priceStep * i;
      const y = CHART_PADDING.top + chartHeight - ((price - (minPrice - padding)) / (maxPrice + padding - (minPrice - padding))) * chartHeight;

      // Grid line
      ctx.beginPath();
      ctx.moveTo(CHART_PADDING.left, y);
      ctx.lineTo(width - CHART_PADDING.right, y);
      ctx.stroke();

      // Price label
      ctx.globalAlpha = 1;
      ctx.fillStyle = mutedColor;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${price.toFixed(2)}`, CHART_PADDING.left - 10, y);
      ctx.globalAlpha = 0.2;
    }

    // Vertical grid lines
    ctx.globalAlpha = 0.08;
    const dateInterval = Math.max(1, Math.ceil(filteredData.length / 10));
    for (let i = 0; i < filteredData.length; i += dateInterval) {
      const x = CHART_PADDING.left + (i / (filteredData.length - 1)) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, CHART_PADDING.top);
      ctx.lineTo(x, height - CHART_PADDING.bottom);
      ctx.stroke();

      // small tick on X axis
      ctx.globalAlpha = 1;
      ctx.strokeStyle = mutedColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, height - CHART_PADDING.bottom);
      ctx.lineTo(x, height - CHART_PADDING.bottom + 6);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
    }

    // Draw axes
    ctx.globalAlpha = 1;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING.left, CHART_PADDING.top);
    ctx.lineTo(CHART_PADDING.left, height - CHART_PADDING.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING.left, height - CHART_PADDING.bottom);
    ctx.lineTo(width - CHART_PADDING.right, height - CHART_PADDING.bottom);
    ctx.stroke();

    // Draw candlesticks
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

      // Wick (High-Low line)
      ctx.strokeStyle = isBullish ? '#16a34a' : '#dc2626';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Candlestick body
      const bodyColor = isBullish ? '#22c55e' : '#ef4444';
      ctx.fillStyle = bodyColor;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeightMin);

      // Body border
      ctx.strokeStyle = isBullish ? '#15803d' : '#991b1b';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeightMin);

      // Hover effect
      if (hoveredCandle === index) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.fillRect(
          x - candleSpacing / 2,
          CHART_PADDING.top,
          candleSpacing,
          chartHeight
        );
      }
    });

    // Draw date labels (match other charts: 12px, muted color)
    ctx.globalAlpha = 1;
    ctx.fillStyle = mutedColor;
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < filteredData.length; i += dateInterval) {
      const x = CHART_PADDING.left + (i / (filteredData.length - 1)) * chartWidth;
      const date = filteredData[i].date;
      ctx.fillText(date, x, height - CHART_PADDING.bottom + 12);
    }

    // Y-axis label
    ctx.save();
    ctx.fillStyle = mutedColor;
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Price ($)', 0, 0);
    ctx.restore();
  }, [filteredData, height, hoveredCandle]);

  // Redraw when container size changes
  useEffect(() => {
    const handleResize = () => {
      // trigger effect by updating hoveredCandle (no-op) to cause redraw
      setHoveredCandle((v) => v);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const chartWidth = canvas.width - CHART_PADDING.left - CHART_PADDING.right;
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
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setTooltipData(null);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border/50 p-4 bg-card/50">
          <p className="text-xs uppercase font-semibold text-muted-foreground">Current Price</p>
          <p className="text-2xl font-bold text-foreground mt-1">${latest.close.toFixed(2)}</p>
          <p className={`text-sm mt-1 font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(changePercent))}%
          </p>
        </div>

        <div className="rounded-lg border border-border/50 p-4 bg-card/50">
          <p className="text-xs uppercase font-semibold text-muted-foreground">24h High</p>
          <p className="text-2xl font-bold text-green-500 mt-1">${latest.high.toFixed(2)}</p>
        </div>

        <div className="rounded-lg border border-border/50 p-4 bg-card/50">
          <p className="text-xs uppercase font-semibold text-muted-foreground">24h Low</p>
          <p className="text-2xl font-bold text-red-500 mt-1">${latest.low.toFixed(2)}</p>
        </div>

        <div className="rounded-lg border border-border/50 p-4 bg-card/50">
          <p className="text-xs uppercase font-semibold text-muted-foreground">Open</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">${latest.open.toFixed(2)}</p>
        </div>
      </div>

      {/* Canvas Chart */}
      <div
        ref={containerRef}
        className="relative rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full cursor-crosshair"
          style={{ display: 'block' }}
        />

        {/* Tooltip */}
        {tooltipData && hoveredCandle !== null && (
          <div
            className="absolute bg-card border-2 border-primary rounded-lg p-3 shadow-lg z-10 text-sm"
            style={{
              left: `${Math.min(tooltipPos.x + 15, (containerRef.current?.clientWidth || 0) - 200)}px`,
              top: `${tooltipPos.y - 120}px`,
            }}
          >
            <p className="font-bold text-primary mb-2">{tooltipData.date}</p>
            <div className="space-y-1">
              <p className="text-green-500">
                <span className="text-muted-foreground">High:</span> ${tooltipData.high.toFixed(2)}
              </p>
              <p className="text-blue-500">
                <span className="text-muted-foreground">Open:</span> ${tooltipData.open.toFixed(2)}
              </p>
              <p className="text-cyan-500">
                <span className="text-muted-foreground">Close:</span> ${tooltipData.close.toFixed(2)}
              </p>
              <p className="text-red-500">
                <span className="text-muted-foreground">Low:</span> ${tooltipData.low.toFixed(2)}
              </p>
              <p className="text-purple-400">
                <span className="text-muted-foreground">Vol:</span> {(tooltipData.volume / 1000000).toFixed(2)}M
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend and Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 border-2 border-green-500 bg-green-500/20"></div>
            <span className="text-sm text-muted-foreground">Bullish (Close &gt; Open)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 border-2 border-red-500 bg-red-500/20"></div>
            <span className="text-sm text-muted-foreground">Bearish (Close &lt; Open)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Hover over candles for details • Showing 2-year data</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className="p-3 rounded border border-border/30 bg-gradient-to-br from-green-500/10 to-transparent">
          <p className="text-xs text-muted-foreground uppercase">Range</p>
          <p className="text-lg font-bold text-green-500">${(latest.high - latest.low).toFixed(2)}</p>
        </div>
        <div className="p-3 rounded border border-border/30 bg-gradient-to-br from-blue-500/10 to-transparent">
          <p className="text-xs text-muted-foreground uppercase">Change</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''} ${changeAmount.toFixed(2)}
          </p>
        </div>
        <div className="p-3 rounded border border-border/30 bg-gradient-to-br from-purple-500/10 to-transparent">
          <p className="text-xs text-muted-foreground uppercase">% Change</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''} {changePercent}%
          </p>
        </div>
        <div className="p-3 rounded border border-border/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
          <p className="text-xs text-muted-foreground uppercase">Volume</p>
          <p className="text-lg font-bold text-cyan-400">{(latest.volume / 1000000).toFixed(1)}M</p>
        </div>
        <div className="p-3 rounded border border-border/30 bg-gradient-to-br from-orange-500/10 to-transparent">
          <p className="text-xs text-muted-foreground uppercase">Data Points</p>
          <p className="text-lg font-bold text-orange-400">{data.length}</p>
        </div>
      </div>
    </div>
  );
}
