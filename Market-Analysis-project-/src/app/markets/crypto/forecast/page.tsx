'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Gauge,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchCryptoForecast } from '@/lib/cryptoApi';
import { useCryptoStore } from '@/store/cryptoStore';

const TIME_RANGES = [
  { label: '1 Year', value: 365 },
  { label: '2 Years', value: 730 },
  { label: '3 Years', value: 1095 },
  { label: '5 Years', value: 1825 },
];

const SUPPORTED_SYMBOLS = [
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'ADA',
  'DOGE',
  'AVAX',
  'DOT',
  'LINK',
  'LTC',
  'MATIC',
  'ATOM',
  'BCH',
  'ETC',
  'FIL',
  'HBAR',
  'NEAR',
  'TRX',
  'XLM',
];

export default function CryptoForecastPage() {
  const { selectedSymbol, setSelectedSymbol } = useCryptoStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookbackDays, setLookbackDays] = useState(365);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchCryptoForecast(selectedSymbol, lookbackDays)
      .then(setData)
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [selectedSymbol, lookbackDays]);

  const chartData = useMemo(() => {
    const timestamps: string[] = data?.timestamps || [];
    const predicted: number[] = data?.predictedReturns || [];
    const actual: number[] = data?.actualReturns || [];
    const sigma: number[] = data?.sigma || [];

    if (timestamps.length === 0 || predicted.length === 0) return [];

    const points: any[] = [];
    const n = Math.min(timestamps.length, predicted.length);
    const step = Math.max(1, Math.floor(n / 500));

    for (let i = 0; i < n; i += step) {
      const p: any = {
        idx: i,
        timestamp: timestamps[i],
        predicted: predicted[i],
      };
      if (actual.length > i) p.actual = actual[i];
      if (sigma.length > i && sigma[i] != null) {
        p.sigma_upper = predicted[i] + sigma[i];
        p.sigma_lower = predicted[i] - sigma[i];
      }
      points.push(p);
    }

    return points;
  }, [data]);

  const uncertaintyValue = useMemo(() => {
    if (data?.latestSigma != null) return Number(data.latestSigma);
    const s: number[] = data?.sigma || [];
    if (!Array.isArray(s) || s.length === 0) return null;
    const avg = s.reduce((a, b) => a + Number(b || 0), 0) / s.length;
    return Number.isFinite(avg) ? avg : null;
  }, [data]);

  const formatPrice = (price: number | null | undefined) => {
    if (price == null || !Number.isFinite(Number(price))) return 'N/A';
    return `$${Number(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="text-cyan-400" /> AI Price Forecasting
          </h1>
          <p className="text-gray-400 text-sm mt-1">Bi-LSTM Attention model predictions</p>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg"
          >
            {SUPPORTED_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg"
          >
            {TIME_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-cyan-200">
          Loading forecast data…
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-200">
          Forecast data is not available right now.
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <BarChart3 size={16} /> Current Price
              </div>
              <div className="text-2xl font-bold text-white">{formatPrice(data?.latestPrice)}</div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                {data?.latestPredReturn >= 0 ? (
                  <TrendingUp size={16} className="text-emerald-400" />
                ) : (
                  <TrendingDown size={16} className="text-red-400" />
                )}
                Predicted Price
              </div>
              <div
                className={`text-2xl font-bold ${
                  data?.latestPredReturn >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatPrice(data?.predictedPrice)}
              </div>
              <div
                className={`text-sm mt-1 ${data?.latestPredReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {data?.latestPredReturn >= 0 ? '+' : ''}
                {Number(data?.latestPredReturn || 0).toFixed(4)}% ({data?.horizonHours}H)
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Gauge size={16} /> Model Accuracy
              </div>
              <div className="text-2xl font-bold text-white">
                {data?.accuracy != null ? `${Number(data.accuracy).toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">Prediction Uncertainty</div>
              <div className="text-2xl font-bold text-white">
                {uncertaintyValue != null ? `±${uncertaintyValue.toFixed(4)}%` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Historical: Actual vs Predicted {data?.horizonHours}H Returns (%)
            </h3>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="sigmaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <XAxis dataKey="timestamp" hide />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />

                  {chartData.some((d: any) => d.sigma_upper != null) && (
                    <>
                      <Area type="monotone" dataKey="sigma_upper" stroke="transparent" fill="url(#sigmaGrad)" />
                      <Area type="monotone" dataKey="sigma_lower" stroke="transparent" fill="url(#sigmaGrad)" />
                    </>
                  )}

                  {chartData.some((d: any) => d.actual != null) && (
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  )}

                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Brain size={20} /> Model Architecture
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Architecture</span>
                  <span className="text-white">Bi-LSTM + Attention</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Prediction Horizon</span>
                  <span className="text-white">{data?.horizonHours} Hours</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sequence Length</span>
                  <span className="text-white">{data?.seqLen} time steps</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Input Features</span>
                  <span className="text-white">{data?.nFeatures}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers size={20} /> Data Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Data Points</span>
                  <span className="text-white">{data?.dataPoints?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Price</span>
                  <span className="text-white">{formatPrice(data?.latestPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Predicted Price</span>
                  <span className={data?.latestPredReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatPrice(data?.predictedPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Direction Accuracy</span>
                  <span
                    className={
                      data?.accuracy > 55
                        ? 'text-emerald-400'
                        : data?.accuracy > 50
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {data?.accuracy != null ? `${Number(data.accuracy).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
