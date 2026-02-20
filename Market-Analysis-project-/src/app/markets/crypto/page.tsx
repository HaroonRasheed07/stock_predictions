'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bitcoin, TrendingUp, TrendingDown, Shield, Activity, Brain, BarChart3, DollarSign } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { fetchCryptoOverview, CryptoOverviewResponse } from '@/lib/cryptoApi';
import { useCryptoStore } from '@/store/cryptoStore';

const SUPPORTED_SYMBOLS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'LINK', 'LTC', 'MATIC', 'ATOM', 'BCH', 'ETC', 'FIL',
    'HBAR', 'NEAR', 'TRX', 'XLM',
];

export default function CryptoOverviewPage() {
    const { selectedSymbol, setSelectedSymbol } = useCryptoStore();
    const [data, setData] = useState<CryptoOverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const safeData: CryptoOverviewResponse = data ?? {
        symbol: selectedSymbol,
        livePrice: null,
        change24h: 0,
        predictedReturn: 0,
        predictedPrice: null,
        sigma: null,
        fearGreed: { value: 50, classification: 'Neutral' },
        signal: { signal: 'HOLD', score: 0, color: '#FFC107', reasons: [], confidence: 0 },
        risk: { score: 50, level: 'Medium', color: '#FFC107', factors: [] },
        topCoins: [],
        chartData: [],
        supportedSymbols: SUPPORTED_SYMBOLS,
    };

    useEffect(() => {
        setLoading(true);
        setError('');
        fetchCryptoOverview(selectedSymbol)
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [selectedSymbol]);

    const formatPrice = (price: number | null | undefined) => {
        if (!price) return 'N/A';
        if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `$${price.toFixed(6)}`;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    };

    return (
        <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
            {/* Header + Symbol Selector */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Bitcoin className="text-yellow-400" /> Crypto Market Overview
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Real-time cryptocurrency analysis powered by AI</p>
                </div>
                <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                >
                    {SUPPORTED_SYMBOLS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </motion.div>

            {loading && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-200">
                    Loading crypto data…
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    {error}
                </div>
            )}

            {!error && (
                <>
                    {/* Stats Row */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Live Price */}
                        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                                <DollarSign size={16} /> Live Price
                            </div>
                            <div className="text-2xl font-bold text-white">{formatPrice(safeData.livePrice)}</div>
                            <div className={`text-sm mt-1 flex items-center gap-1 ${safeData.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {safeData.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {safeData.change24h >= 0 ? '+' : ''}{safeData.change24h?.toFixed(2)}% (24h)
                            </div>
                        </div>

                        {/* AI Signal */}
                        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                                <Brain size={16} /> AI Trading Signal
                            </div>
                            <div className="text-xl font-bold" style={{ color: safeData.signal?.color }}>
                                {safeData.signal?.signal ?? 'HOLD'}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                                Confidence: {safeData.signal?.confidence ?? 0}%
                            </div>
                        </div>

                        {/* Fear & Greed */}
                        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                                <Activity size={16} /> Fear & Greed Index
                            </div>
                            <div className="text-2xl font-bold text-white">{safeData.fearGreed?.value ?? 50}</div>
                            <div className={`text-sm mt-1 ${safeData.fearGreed?.value > 60 ? 'text-emerald-400' :
                                safeData.fearGreed?.value < 40 ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                {safeData.fearGreed?.classification ?? 'Neutral'}
                            </div>
                        </div>

                        {/* Risk */}
                        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                                <Shield size={16} /> Risk Assessment
                            </div>
                            <div className="text-2xl font-bold" style={{ color: safeData.risk?.color }}>
                                {safeData.risk?.score ?? 50}/100
                            </div>
                            <div className="text-sm mt-1" style={{ color: safeData.risk?.color }}>
                                {safeData.risk?.level ?? 'Medium'} Risk
                            </div>
                        </div>
                    </motion.div>

                    {/* Prediction Summary */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-700/30 rounded-xl p-5 backdrop-blur-sm">
                            <div className="text-gray-400 text-sm mb-1">Predicted Return (12H)</div>
                            <div className={`text-xl font-bold ${safeData.predictedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {safeData.predictedReturn >= 0 ? '+' : ''}{safeData.predictedReturn?.toFixed(4)}%
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-700/30 rounded-xl p-5 backdrop-blur-sm">
                            <div className="text-gray-400 text-sm mb-1">Predicted Price</div>
                            <div className="text-xl font-bold text-white">{formatPrice(safeData.predictedPrice)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-700/30 rounded-xl p-5 backdrop-blur-sm">
                            <div className="text-gray-400 text-sm mb-1">Prediction Uncertainty (σ)</div>
                            <div className="text-xl font-bold text-white">
                                {safeData.sigma != null ? `${(safeData.sigma * 100).toFixed(2)}%` : 'N/A'}
                            </div>
                        </div>
                    </motion.div>

                    {/* Signal Reasons */}
                    {(safeData.signal?.reasons?.length ?? 0) > 0 && (
                        <motion.div variants={itemVariants} className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4">
                            <div className="text-gray-400 text-sm mb-2">Signal Factors</div>
                            <div className="flex flex-wrap gap-2">
                                {safeData.signal.reasons.map((r, i) => (
                                    <span key={i} className="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-sm">{r}</span>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {safeData.livePrice == null && (safeData.chartData?.length ?? 0) === 0 && (safeData.topCoins?.length ?? 0) === 0 && (
                        <motion.div variants={itemVariants} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-200">
                            Live data is not available right now. Please wait a few seconds or refresh.
                        </motion.div>
                    )}

                    {/* Price Chart */}
                    {safeData.chartData?.length > 0 && (
                        <motion.div variants={itemVariants} className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} /> Price History
                            </h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={safeData.chartData.filter((_, i) => i % Math.max(1, Math.floor(safeData.chartData.length / 500)) === 0)}>
                                    <defs>
                                        <linearGradient id="cryptoPriceGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="Date"
                                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                                        tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        minTickGap={50}
                                    />
                                    <YAxis
                                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(v) => v >= 1 ? `$${v.toLocaleString()}` : `$${v.toFixed(4)}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(107,114,128,0.3)', borderRadius: '8px' }}
                                        labelStyle={{ color: '#9ca3af' }}
                                        formatter={(value: number) => [formatPrice(value), 'Price']}
                                        labelFormatter={(v) => new Date(v).toLocaleString()}
                                    />
                                    <Area type="monotone" dataKey="Close" stroke="#818cf8" fill="url(#cryptoPriceGrad)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </motion.div>
                    )}

                    {/* Top Coins */}
                    {safeData.topCoins?.length > 0 && (
                        <motion.div variants={itemVariants} className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-white mb-4">Top Cryptocurrencies</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {safeData.topCoins.map((coin) => (
                                    <button
                                        key={coin.symbol}
                                        onClick={() => setSelectedSymbol(coin.symbol)}
                                        className={`p-3 rounded-lg border transition-all text-left hover:bg-gray-700/50 ${coin.symbol === selectedSymbol
                                            ? 'border-yellow-500/50 bg-yellow-500/10'
                                            : 'border-gray-700/30 bg-gray-800/30'
                                            }`}
                                    >
                                        <div className="font-semibold text-white">{coin.symbol}</div>
                                        <div className="text-sm text-gray-400">{formatPrice(coin.price)}</div>
                                        {coin.change !== 0 && (
                                            <div className={`text-xs ${coin.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </motion.div>
    );
}
