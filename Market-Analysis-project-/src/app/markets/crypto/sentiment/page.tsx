'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, ExternalLink, Newspaper } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchCryptoSentiment } from '@/lib/cryptoApi';
import { useCryptoStore } from '@/store/cryptoStore';

const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'LTC', 'MATIC', 'ATOM', 'BCH', 'ETC', 'FIL', 'HBAR', 'NEAR', 'TRX', 'XLM'];

export default function CryptoSentimentPage() {
    const { selectedSymbol, setSelectedSymbol } = useCryptoStore();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetchCryptoSentiment(selectedSymbol)
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [selectedSymbol]);

    const news = data?.news || [];
    const sentiment_score = data?.sentiment_score ?? 0;
    const sentiment_label = data?.sentiment_label ?? 'Neutral';
    const positive_count = data?.positive_count ?? 0;
    const negative_count = data?.negative_count ?? 0;

    const getSentimentColor = (score: number) => {
        if (score > 0.1) return '#10b981';
        if (score < -0.1) return '#ef4444';
        return '#f59e0b';
    };

    const sentimentDistribution = [
        { name: 'Positive', value: positive_count, color: '#10b981' },
        { name: 'Neutral', value: Math.max(0, news.length - positive_count - negative_count), color: '#f59e0b' },
        { name: 'Negative', value: negative_count, color: '#ef4444' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <MessageSquare className="text-purple-400" /> Sentiment Analysis
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">AI-powered news sentiment</p>
                </div>
                <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg">
                    {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {loading && <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-purple-200">Loading sentiment data…</div>}
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>}

            {!loading && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="text-gray-400 text-sm mb-2">Overall Sentiment</div>
                            <div className="text-3xl font-bold" style={{ color: getSentimentColor(sentiment_score) }}>
                                {sentiment_score >= 0 ? '+' : ''}{sentiment_score.toFixed(4)}
                            </div>
                            <div className="text-sm mt-2 px-2 py-0.5 rounded-full inline-block" style={{ backgroundColor: getSentimentColor(sentiment_score) + '20', color: getSentimentColor(sentiment_score) }}>
                                {sentiment_label}
                            </div>
                        </div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="text-gray-400 text-sm mb-2">Positive</div>
                                    <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1"><TrendingUp size={20} /> {positive_count}</div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-gray-400 text-sm mb-2">Negative</div>
                                    <div className="text-2xl font-bold text-red-400 flex items-center gap-1"><TrendingDown size={20} /> {negative_count}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                            <div className="text-gray-400 text-sm mb-2">Articles Analyzed</div>
                            <div className="text-2xl font-bold text-white flex items-center gap-2"><Newspaper size={20} className="text-purple-400" /> {news.length}</div>
                        </div>
                    </div>

                    {news.length === 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-200">No news sentiment available right now.</div>
                    )}

                    {news.length > 0 && (
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Sentiment Distribution</h3>
                            <div style={{ width: '100%', height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={sentimentDistribution} layout="vertical">
                                        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                            {sentimentDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {news.length > 0 && (
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Newspaper size={20} /> Latest Headlines</h3>
                            <div className="space-y-3">
                                {news.slice(0, 15).map((item: any, i: number) => (
                                    <div key={i} className="p-4 bg-gray-800/50 rounded-lg border-l-4" style={{ borderLeftColor: getSentimentColor(item.sentiment) }}>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-white font-medium hover:text-indigo-400 transition-colors flex items-start gap-2">
                                            {item.title}<ExternalLink size={14} className="flex-shrink-0 mt-1 text-gray-500" />
                                        </a>
                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getSentimentColor(item.sentiment) + '20', color: getSentimentColor(item.sentiment) }}>
                                                {item.sentiment > 0.1 ? 'Positive' : item.sentiment < -0.1 ? 'Negative' : 'Neutral'}
                                            </span>
                                            <span className="text-gray-400">🌐 {item.source}</span>
                                            {item.published_at && <span className="text-gray-500">{new Date(item.published_at).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
