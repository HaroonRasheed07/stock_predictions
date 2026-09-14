'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useThemeStore } from '@/store/themeStore';

interface SentimentData {
  sentiment_label: string;
  sentiment_score: number;
  news?: any[];
}

interface ProfessionalSentimentChartProps {
  data: SentimentData;
}

export default function ProfessionalSentimentChart({ data }: ProfessionalSentimentChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<number>(320);
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);
  const [tooltip, setTooltip] = React.useState<{ visible: boolean; x: number; y: number; name?: string; value?: number }>({
    visible: false, x: 0, y: 0,
  });

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const score = data?.sentiment_score || 0;

  let positivePercent = 0;
  let neutralPercent = 0;
  let negativePercent = 0;

  if (score > 0.3) {
    positivePercent = Math.round((score + 1) / 2 * 100);
    neutralPercent = Math.round((1 - score) / 2 * 50);
    negativePercent = 100 - positivePercent - neutralPercent;
  } else if (score < -0.3) {
    negativePercent = Math.round((1 - score) / 2 * 100);
    neutralPercent = Math.round((1 + score) / 2 * 50);
    positivePercent = 100 - negativePercent - neutralPercent;
  } else {
    neutralPercent = Math.round((1 - Math.abs(score)) * 100);
    positivePercent = Math.round(Math.max(0, score) * 50);
    negativePercent = Math.round(Math.max(0, -score) * 50);
  }

  const total = positivePercent + neutralPercent + negativePercent;
  const adjustment = total > 0 ? 100 / total : 100;
  positivePercent = Math.round(positivePercent * adjustment);
  neutralPercent = Math.round(neutralPercent * adjustment);
  negativePercent = 100 - positivePercent - neutralPercent;

  const getColors = useCallback(() => ({
    positive: '#22c55e',
    neutral: '#8b5cf6',
    negative: '#ef4444',
    text: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)',
    textMuted: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    textCenter: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.78)',
    textScore: isDark ? 'rgba(255,255,255,0.98)' : 'rgba(0,0,0,0.92)',
    stroke: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    strokeHover: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
    centerFill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    centerStroke: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    canvasBg: 'transparent',
  }), [isDark]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    const size = container ? Math.min(container.clientWidth, 360) : 320;
    sizeRef.current = size;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.max(1, Math.floor(size * dpr));
    canvas.height = Math.max(1, Math.floor(size * dpr));

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = getColors();
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size / 360;
    const baseOuterRadius = 120 * scale;
    const baseInnerRadius = 72 * scale;
    const gap = 2 * scale;

    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    const sentiments = [
      { name: 'Negative', value: negativePercent, color: colors.negative },
      { name: 'Neutral', value: neutralPercent, color: colors.neutral },
      { name: 'Positive', value: positivePercent, color: colors.positive },
    ];

    const segments: Array<{ name: string; startAngle: number; endAngle: number; color: string; value: number }> = [];
    let currentAngle = -Math.PI / 2;

    sentiments.forEach((sentiment) => {
      if (sentiment.value <= 0) return;

      const sliceAngle = (sentiment.value / 100) * Math.PI * 2;
      const endAngle = currentAngle + sliceAngle;
      const midAngle = currentAngle + sliceAngle / 2;

      segments.push({ name: sentiment.name, startAngle: currentAngle, endAngle, color: sentiment.color, value: sentiment.value });

      const isHovered = hoveredSegment === sentiment.name;
      const outerRadius = isHovered ? baseOuterRadius + 8 * scale : baseOuterRadius;
      const innerRadius = isHovered ? baseInnerRadius - 2 * scale : baseInnerRadius;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius - gap, currentAngle + gap / outerRadius, endAngle - gap / outerRadius);
      ctx.arc(centerX, centerY, innerRadius + gap, endAngle - gap / innerRadius, currentAngle + gap / innerRadius, true);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(
        centerX + Math.cos(midAngle) * innerRadius,
        centerY + Math.sin(midAngle) * innerRadius,
        centerX + Math.cos(midAngle) * outerRadius,
        centerY + Math.sin(midAngle) * outerRadius
      );
      gradient.addColorStop(0, sentiment.color + 'ee');
      gradient.addColorStop(1, sentiment.color + 'cc');

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = isHovered ? colors.strokeHover : colors.stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      ctx.font = `${isHovered ? '700' : '600'} ${Math.round(14 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI"`;
      ctx.fillStyle = isHovered ? colors.text : 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sentiment.value}%`, labelX, labelY);

      currentAngle = endAngle;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseInnerRadius, 0, Math.PI * 2);
    ctx.fillStyle = colors.centerFill;
    ctx.fill();
    ctx.strokeStyle = colors.centerStroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Center text
    ctx.fillStyle = colors.textMuted;
    ctx.font = `600 ${Math.round(10 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SENTIMENT', centerX, centerY - 22 * scale);

    ctx.fillStyle = colors.textScore;
    ctx.font = `700 ${Math.round(32 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI"`;
    ctx.fillText(score.toFixed(2), centerX, centerY + 4 * scale);

    const sentimentColor = data?.sentiment_label === 'Positive' ? colors.positive : data?.sentiment_label === 'Negative' ? colors.negative : colors.neutral;
    ctx.fillStyle = sentimentColor;
    ctx.font = `600 ${Math.round(10 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI"`;
    ctx.fillText(data?.sentiment_label || 'Neutral', centerX, centerY + 22 * scale);

    // Legend below chart
    const legendY = centerY + baseOuterRadius + 28 * scale;
    const legendItems = [
      { name: 'Negative', color: colors.negative, value: negativePercent },
      { name: 'Neutral', color: colors.neutral, value: neutralPercent },
      { name: 'Positive', color: colors.positive, value: positivePercent },
    ];

    const itemWidth = 90 * scale;
    const totalLegendWidth = legendItems.length * itemWidth;
    let legendX = centerX - totalLegendWidth / 2;

    legendItems.forEach((item) => {
      const isLegendHovered = hoveredSegment === item.name;

      ctx.beginPath();
      ctx.arc(legendX + 8 * scale, legendY, isLegendHovered ? 5 * scale : 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();

      ctx.font = `${isLegendHovered ? '700' : '500'} ${Math.round(11 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI"`;
      ctx.fillStyle = isLegendHovered ? item.color : colors.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${item.name} ${item.value}%`, legendX + 18 * scale, legendY);

      legendX += itemWidth;
    });

    (canvasRef.current as any).segments = segments;
  }, [data, positivePercent, neutralPercent, negativePercent, hoveredSegment, score, getColors]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      drawChart();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawChart]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const hitTest = (x: number, y: number) => {
    const size = sizeRef.current;
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size / 360;
    const outerR = 120 * scale + 8;
    const innerR = 72 * scale - 6;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (distance >= innerR && distance <= outerR) {
      const canvas = canvasRef.current;
      const segments = (canvas as any).segments || [];

      for (const segment of segments) {
        let normalizedAngle = angle;
        let normalizedStart = segment.startAngle;
        let normalizedEnd = segment.endAngle;

        if (normalizedAngle < -Math.PI / 2) normalizedAngle += Math.PI * 2;
        if (normalizedStart < -Math.PI / 2) normalizedStart += Math.PI * 2;
        if (normalizedEnd < -Math.PI / 2) normalizedEnd += Math.PI * 2;

        if (normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd) {
          return segment;
        }
      }
    }
    return null;
  };

  const handlePointer = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getMousePos(e);
    const segment = hitTest(x, y);

    if (segment) {
      setHoveredSegment(segment.name);
      const rect = canvasRef.current?.getBoundingClientRect();
      const pad = 12;
      setTooltip({
        visible: true,
        x: Math.min(Math.max(x, pad), (rect?.width || 320) - pad),
        y: Math.min(Math.max(y, pad), (rect?.height || 320) - pad),
        name: segment.name,
        value: segment.value,
      });
      if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
    } else {
      setHoveredSegment(null);
      setTooltip((t) => ({ ...t, visible: false }));
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }
  };

  const handleLeave = () => {
    setHoveredSegment(null);
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    setTooltip((t) => ({ ...t, visible: false }));
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div ref={containerRef} className="relative w-full max-w-[360px] mx-auto">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto transition-all duration-300"
          style={{ display: 'block', borderRadius: 12 }}
          onMouseMove={handlePointer}
          onMouseLeave={handleLeave}
          onTouchMove={handlePointer}
          onTouchEnd={handleLeave}
        />

        {tooltip.visible && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, calc(-100% - 12px))',
              background: isDark ? 'linear-gradient(135deg, rgba(20,20,20,0.98), rgba(28,28,28,0.96))' : 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(245,245,245,0.96))',
              color: isDark ? 'white' : '#1a1a1a',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              zIndex: 50,
              pointerEvents: 'none',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.28)' : '0 8px 24px rgba(0,0,0,0.12)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <div style={{ fontWeight: 700 }}>{tooltip.name}</div>
            <div style={{ opacity: 0.85, fontSize: 11, marginTop: 2 }}>{tooltip.value}%</div>
          </div>
        )}
      </div>

      {/* Mobile-friendly stat cards below chart */}
      <div className="w-full max-w-sm mt-6 space-y-3 px-2">
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Negative', value: negativePercent, color: '#ef4444', bg: isDark ? 'bg-red-500/10' : 'bg-red-100', border: isDark ? 'border-red-500/30' : 'border-red-300/60' },
            { name: 'Neutral', value: neutralPercent, color: '#8b5cf6', bg: isDark ? 'bg-purple-500/10' : 'bg-purple-100', border: isDark ? 'border-purple-500/30' : 'border-purple-300/60' },
            { name: 'Positive', value: positivePercent, color: '#22c55e', bg: isDark ? 'bg-green-500/10' : 'bg-green-100', border: isDark ? 'border-green-500/30' : 'border-green-300/60' },
          ].map((item) => (
            <div
              key={item.name}
              className={`p-3 rounded-xl border ${item.bg} ${item.border} text-center transition-all duration-300 ${
                hoveredSegment === item.name ? 'scale-[1.03] shadow-md' : 'shadow-sm'
              }`}
            >
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">{item.name}</p>
              <p className="text-xl font-bold transition-all" style={{ color: item.color }}>
                {item.value}%
              </p>
            </div>
          ))}
        </div>

        <div
          className={`p-4 rounded-xl border text-center transition-all ${
            data?.sentiment_label === 'Positive'
              ? isDark ? 'border-green-500/40 bg-green-500/10' : 'border-green-300/60 bg-green-50'
              : data?.sentiment_label === 'Negative'
              ? isDark ? 'border-red-500/40 bg-red-500/10' : 'border-red-300/60 bg-red-50'
              : isDark ? 'border-purple-500/40 bg-purple-500/10' : 'border-purple-300/60 bg-purple-50'
          }`}
        >
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Market Sentiment</p>
          <p
            className="text-lg font-bold"
            style={{
              color: data?.sentiment_label === 'Positive' ? '#22c55e' : data?.sentiment_label === 'Negative' ? '#ef4444' : '#8b5cf6',
            }}
          >
            {data?.sentiment_label || 'Neutral'}
          </p>
        </div>
      </div>
    </div>
  );
}
