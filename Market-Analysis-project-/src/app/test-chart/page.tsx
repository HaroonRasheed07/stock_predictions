'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchCryptoTechnical } from '@/lib/cryptoApi';

export default function TestChart() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCryptoTechnical('BTC', 90)
            .then((res: any) => {
                console.log('API Response:', res);
                if (res.data && Array.isArray(res.data)) {
                    // Take every 10th point for performance
                    const sampled = res.data.filter((_: any, i: number) => i % 10 === 0);
                    setData(sampled);
                    console.log('Chart data set:', sampled.length, 'points');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-white p-4">Loading...</div>;
    if (data.length === 0) return <div className="text-red-400 p-4">No data</div>;

    return (
        <div className="p-4 bg-gray-900">
            <h2 className="text-white mb-4">Test Chart ({data.length} points)</h2>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                    <LineChart data={data}>
                        <XAxis dataKey="Date" hide />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#9ca3af' }} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                            labelStyle={{ color: '#9ca3af' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="Close" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
