'use client';

import React, { useRef, useEffect } from 'react';

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
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);
  const [tooltip, setTooltip] = React.useState<{ visible: boolean; x: number; y: number; name?: string; value?: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

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

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const size = 520;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.max(1, Math.floor(size * dpr));
    canvas.height = Math.max(1, Math.floor(size * dpr));

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseOuterRadius = 135;
    const baseInnerRadius = 82;

    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    const sentiments = [
      { name: 'Negative', value: negativePercent, color: '#ef4444' },
      { name: 'Neutral', value: neutralPercent, color: '#8b5cf6' },
      { name: 'Positive', value: positivePercent, color: '#22c55e' },
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
      const outerRadius = isHovered ? baseOuterRadius + 12 : baseOuterRadius;
      const innerRadius = isHovered ? baseInnerRadius - 3 : baseInnerRadius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius, currentAngle, endAngle);
      ctx.lineTo(centerX + Math.cos(endAngle) * innerRadius, centerY + Math.sin(endAngle) * innerRadius);
      ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(
        centerX + Math.cos(midAngle) * innerRadius,
        centerY + Math.sin(midAngle) * innerRadius,
        centerX + Math.cos(midAngle) * outerRadius,
        centerY + Math.sin(midAngle) * outerRadius
      );
      gradient.addColorStop(0, sentiment.color + 'f2');
      gradient.addColorStop(0.6, sentiment.color + 'e8');
      gradient.addColorStop(1, sentiment.color + 'dc');

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      ctx.font = `${isHovered ? '700 20px' : '600 18px'} -apple-system, BlinkMacSystemFont, "Segoe UI"`;
      ctx.fillStyle = isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.93)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sentiment.value}%`, labelX, labelY);

      currentAngle = endAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseInnerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    const innerGlow = ctx.createRadialGradient(centerX, centerY, baseInnerRadius * 0.6, centerX, centerY, baseInnerRadius);
    innerGlow.addColorStop(0, 'rgba(255,255,255,0)');
    innerGlow.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = innerGlow;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SENTIMENT SCORE', centerX, centerY - 28);

    ctx.fillStyle = 'rgba(255,255,255,0.99)';
    ctx.font = '700 44px -apple-system, BlinkMacSystemFont, "Segoe UI"';
    ctx.fillText(score.toFixed(2), centerX, centerY + 5);

    const sentimentColor = data?.sentiment_label === 'Positive' ? '#22c55e' : data?.sentiment_label === 'Negative' ? '#ef4444' : '#8b5cf6';
    ctx.fillStyle = sentimentColor;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI"';
    ctx.fillText(data?.sentiment_label || 'Neutral', centerX, centerY + 27);

    const legendY = centerY + baseOuterRadius + 44;
    const legendItems = [
      { name: 'Negative', color: '#ef4444', value: negativePercent },
      { name: 'Neutral', color: '#8b5cf6', value: neutralPercent },
      { name: 'Positive', color: '#22c55e', value: positivePercent },
    ];

    const totalLegendWidth = legendItems.reduce((sum, _, i) => sum + (i > 0 ? 20 : 0) + 125, 0);
    let legendX = centerX - totalLegendWidth / 2;

    legendItems.forEach((item, index) => {
      if (index > 0) legendX += 20;
      const isLegendHovered = hoveredSegment === item.name;

      ctx.beginPath();
      ctx.arc(legendX + 8, legendY, isLegendHovered ? 6 : 5.2, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();

      if (isLegendHovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.font = `${isLegendHovered ? '700 13px' : '13px'} -apple-system, BlinkMacSystemFont, "Segoe UI"`;
      ctx.fillStyle = isLegendHovered ? item.color : 'rgba(255,255,255,0.88)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${item.name} ${item.value}%`, legendX + 22, legendY);

      legendX += 105;
    });

    (canvasRef.current as any).segments = segments;
  }, [data, positivePercent, neutralPercent, negativePercent, hoveredSegment, score]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const baseOuterRadius = 135;
    const baseInnerRadius = 82;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (distance >= baseInnerRadius - 6 && distance <= baseOuterRadius + 14) {
      const segments = (canvas as any).segments || [];

      for (const segment of segments) {
        const normalizedAngle = angle < -Math.PI / 2 ? angle + Math.PI * 2 : angle;
        const normalizedStart = segment.startAngle < -Math.PI / 2 ? segment.startAngle + Math.PI * 2 : segment.startAngle;
        const normalizedEnd = segment.endAngle < -Math.PI / 2 ? segment.endAngle + Math.PI * 2 : segment.endAngle;

        if (normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd) {
          setHoveredSegment(segment.name);
          // Use coordinates relative to the canvas container so the tooltip appears next to cursor
          const localX = x; // mouse position relative to canvas left
          const localY = y; // mouse position relative to canvas top
          // clamp tooltip inside canvas bounds (with padding)
          const pad = 12;
          const clampedX = Math.min(Math.max(localX, pad), rect.width - pad);
          const clampedY = Math.min(Math.max(localY, pad), rect.height - pad);
          setTooltip({ visible: true, x: clampedX, y: clampedY, name: segment.name, value: segment.value });
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }

    setHoveredSegment(null);
    setTooltip((t) => ({ ...t, visible: false }));
    canvas.style.cursor = 'default';
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
    setTooltip((t) => ({ ...t, visible: false }));
  };

  return (
    <>
      <style>{`
        @keyframes tooltipSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-100% - 12px));
          }
          to {
            opacity: 1;
            transform: translate(-50%, calc(-100% - 8px));
          }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center w-full space-y-8 py-8">
        <div className="flex justify-center w-full">
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={520}
              height={520}
              className="max-w-full h-auto transition-all duration-300"
              style={{
                boxShadow: hoveredSegment
                  ? '0 18px 36px rgba(0,0,0,0.16), 0 0 28px rgba(0,0,0,0.1)'
                  : '0 10px 18px rgba(0,0,0,0.09)',
                borderRadius: 16,
                display: 'block',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {tooltip.visible && (
              <div
                role="tooltip"
                aria-hidden={!tooltip.visible}
                style={{
                  position: 'absolute',
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, calc(-100% - 12px))',
                  background: 'linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(28,28,28,0.96) 100%)',
                  color: 'white',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  zIndex: 50,
                  pointerEvents: 'none',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.28), 0 0 1px rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  animation: 'tooltipSlideIn 0.2s ease-out forwards',
                }}
              >
                <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>{tooltip.name}</div>
                <div style={{ opacity: 0.96, fontSize: 12, marginTop: 3 }}>{tooltip.value}%</div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-4 px-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Negative', value: negativePercent, color: '#ef4444', bgColor: 'bg-red-500/12', borderColor: 'border-red-500/45' },
              { name: 'Neutral', value: neutralPercent, color: '#8b5cf6', bgColor: 'bg-purple-500/12', borderColor: 'border-purple-500/45' },
              { name: 'Positive', value: positivePercent, color: '#22c55e', bgColor: 'bg-green-500/12', borderColor: 'border-green-500/45' },
            ].map((item) => (
              <div
                key={item.name}
                className={`p-5 rounded-xl border-2 ${item.bgColor} ${item.borderColor} text-center backdrop-blur-md transition-all duration-300 ${
                  hoveredSegment === item.name ? 'scale-106 shadow-lg' : 'shadow-md'
                }`}
                style={{
                  borderColor: hoveredSegment === item.name ? item.color : undefined,
                  boxShadow: hoveredSegment === item.name ? `0 12px 24px ${item.color}20` : 'none',
                }}
              >
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-widest mb-3">{item.name}</p>
                <p className={`text-4xl font-bold transition-all duration-300 ${hoveredSegment === item.name ? 'scale-110' : 'scale-100'}`} style={{ color: item.color }}>
                  {item.value}%
                </p>
              </div>
            ))}
          </div>

          <div
            className={`p-6 rounded-2xl border-2 text-center backdrop-blur-md transition-all duration-300 ${
              data?.sentiment_label === 'Positive'
                ? 'border-green-500/50 bg-green-500/12'
                : data?.sentiment_label === 'Negative'
                ? 'border-red-500/50 bg-red-500/12'
                : 'border-purple-500/50 bg-purple-500/12'
            }`}
            style={{
              boxShadow:
                data?.sentiment_label === 'Positive'
                  ? '0 8px 20px rgba(34,197,94,0.15)'
                  : data?.sentiment_label === 'Negative'
                  ? '0 8px 20px rgba(239,68,68,0.15)'
                  : '0 8px 20px rgba(139,92,246,0.15)',
            }}
          >
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-widest mb-2">Market Sentiment</p>
            <p
              className="text-2xl font-bold"
              style={{
                color:
                  data?.sentiment_label === 'Positive'
                    ? '#22c55e'
                    : data?.sentiment_label === 'Negative'
                    ? '#ef4444'
                    : '#8b5cf6',
              }}
            >
              {data?.sentiment_label || 'Neutral'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
