'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';

export interface ChartOverlays {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
}

interface LegendState {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number;
}

function toTime(dateStr: string): UTCTimestamp | null {
  const t = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`);
  if (isNaN(t)) return null;
  return Math.floor(t / 1000) as UTCTimestamp;
}

/**
 * Client-only candlestick chart (lightweight-charts, Apache-2.0 — see
 * NOTICE.txt). All series values come straight from indicator rows; nothing
 * is smoothed or synthesized here.
 */
export default function PriceChartInner({
  rows,
  isDark,
  overlays,
  onReady,
}: {
  rows: Record<string, any>[];
  isDark: boolean;
  overlays: ChartOverlays;
  onReady?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [legend, setLegend] = useState<LegendState | null>(null);

  const hasColumn = (col: string) =>
    rows.length > 0 && rows.every((r) => typeof r?.[col] === 'number' && isFinite(r[col]));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || rows.length === 0) return;

    const up = '#16a34a';
    const down = '#dc2626';
    const text = isDark ? '#a1a1aa' : '#71717a';
    const grid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const cross = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: text,
        attributionLogo: true,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: cross, labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7' },
        horzLine: { color: cross, labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7' },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    const candleData: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
    for (const r of rows) {
      const time = r?.Date ? toTime(String(r.Date)) : null;
      if (time === null) continue;
      const open = Number(r.Open);
      const high = Number(r.High);
      const low = Number(r.Low);
      const close = Number(r.Close);
      if (![open, high, low, close].every((v) => isFinite(v))) continue;
      candleData.push({ time, open, high, low, close });
    }
    candles.setData(candleData);

    if (candleData.length > 0 && rows.every((r) => typeof r?.Volume === 'number')) {
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(
        candleData.map((c) => {
          const src = rows.find((r) => String(r?.Date)?.slice(0, 10) === new Date(c.time * 1000).toISOString().slice(0, 10));
          const rising = src && Number(src.Close) >= Number(src.Open);
          return { time: c.time, value: Number(src?.Volume) || 0, color: rising ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)' };
        })
      );
    }

    const overlayDefs: Array<{ on: boolean; col: string; color: string }> = [
      { on: overlays.sma20 && hasColumn('SMA20'), col: 'SMA20', color: isDark ? '#60a5fa' : '#2563eb' },
      { on: overlays.sma50 && hasColumn('SMA50'), col: 'SMA50', color: isDark ? '#f59e0b' : '#d97706' },
      { on: overlays.ema20 && hasColumn('EMA20'), col: 'EMA20', color: isDark ? '#a78bfa' : '#7c3aed' },
    ];
    for (const def of overlayDefs) {
      if (!def.on) continue;
      const line = chart.addSeries(LineSeries, {
        color: def.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(
        candleData.map((c) => {
          const iso = new Date(c.time * 1000).toISOString().slice(0, 10);
          const src = rows.find((r) => String(r?.Date)?.slice(0, 10) === iso);
          return { time: c.time, value: Number(src?.[def.col]) };
        }).filter((p) => isFinite(p.value))
      );
    }

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point === undefined) {
        setLegend(null);
        return;
      }
      const data = param.seriesData.get(candles) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!data) return;
      const idx = candleData.findIndex((d) => d.time === param.time);
      const prevClose = idx > 0 ? candleData[idx - 1].close : data.open;
      setLegend({
        date: new Date((param.time as number) * 1000).toISOString().slice(0, 10),
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        changePct: prevClose ? ((data.close - prevClose) / prevClose) * 100 : 0,
      });
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    onReady?.();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isDark, overlays.sma20, overlays.sma50, overlays.ema20]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {legend && (
        <div className="pointer-events-none absolute left-3 top-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-background/85 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground backdrop-blur-sm">
          <span className="text-foreground">{legend.date}</span>
          <span>O {legend.open.toFixed(2)}</span>
          <span>H {legend.high.toFixed(2)}</span>
          <span>L {legend.low.toFixed(2)}</span>
          <span className={legend.changePct >= 0 ? 'text-success' : 'text-destructive'}>
            C {legend.close.toFixed(2)} ({legend.changePct >= 0 ? '+' : '−'}
            {Math.abs(legend.changePct).toFixed(2)}%)
          </span>
        </div>
      )}
    </div>
  );
}
