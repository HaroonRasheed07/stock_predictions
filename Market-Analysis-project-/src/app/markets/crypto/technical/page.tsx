'use client';

import { useState, useEffect } from 'react';
import { LineChart, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, ReferenceLine
} from 'recharts';
import { fetchCryptoTechnical } from '@/lib/cryptoApi';
import { useCryptoStore } from '@/store/cryptoStore';

const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'LTC', 'MATIC', 'ATOM', 'BCH', 'ETC', 'FIL', 'HBAR', 'NEAR', 'TRX', 'XLM'];

export default function CryptoTechnicalPage() {
    const { selectedSymbol, setSelectedSymbol } = useCryptoStore();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [days, setDays] = useState(90);

    useEffect(() => {
        setLoading(true);
        fetchCryptoTechnical(selectedSymbol, days)
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [selectedSymbol, days]);

    const rawData = data?.data || [];
    const chartData = rawData.length > 0 ? rawData.filter((_: any, i: number) => i % Math.max(1, Math.floor(rawData.length / 500)) === 0) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <LineChart className="text-indigo-400" /> Technical Analysis
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Advanced indicators and chart patterns</p>
                </div>
                <div className="flex gap-3">
                    <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg">
                        {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg">
                        <option value={30}>30 Days</option>
                        <option value={90}>90 Days</option>
                        <option value={180}>180 Days</option>
                        <option value={365}>1 Year</option>
                    </select>
                </div>
            </div>

            {loading && <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-indigo-200">Loading technical indicators…</div>}
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>}

            {!loading && chartData.length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-200">No chart data available.</div>
            )}

            {!loading && chartData.length > 0 && (
                <>
                    {/* Indicator Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><Activity size={16} /> RSI (14)</div>
                            <div className={`text-2xl font-bold ${(data?.latestRSI ?? 50) > 70 ? 'text-red-400' : (data?.latestRSI ?? 50) < 30 ? 'text-emerald-400' : 'text-white'}`}>
                                {data?.latestRSI?.toFixed(2) ?? 'N/A'}
                            </div>
                        </div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><BarChart3 size={16} /> MACD</div>
                            <div className={`text-2xl font-bold ${(data?.latestMACD ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data?.latestMACD?.toFixed(4) ?? 'N/A'}
                            </div>
                        </div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                                {data?.latestSignal === 'Buy' ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
                                Signal
                            </div>
                            <div className={`text-2xl font-bold ${data?.latestSignal === 'Buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data?.latestSignal ?? 'Sell'}
                            </div>
                        </div>
                    </div>

                    {/* Price Chart */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Price Action</h3>
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <XAxis dataKey="Date" hide />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                    <Line type="monotone" dataKey="Close" stroke="#10b981" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Volume */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Volume</h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <XAxis dataKey="Date" hide />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                    <Bar dataKey="Volume" fill="#6366f1" opacity={0.6} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* RSI */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">RSI (14)</h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <XAxis dataKey="Date" hide />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
                                    <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" />
                                    <Area type="monotone" dataKey="rsi14" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* MACD */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">MACD</h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <XAxis dataKey="Date" hide />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                                    <Bar dataKey="macd_hist" fill="#6366f1" opacity={0.5} />
                                    <Line type="monotone" dataKey="macd" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="macd_signal" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
