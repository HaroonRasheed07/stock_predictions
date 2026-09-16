'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, TrendingUp, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getAllAllowlistedSymbols, getStockInfo } from '@/lib/stock-allowlist';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

const allSymbols = getAllAllowlistedSymbols();

export default function StockIndexClient() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const filtered = query.trim()
    ? allSymbols.filter((s) => {
        const info = getStockInfo(s);
        return (
          s.toLowerCase().includes(query.toLowerCase()) ||
          (info?.name || '').toLowerCase().includes(query.toLowerCase()) ||
          (info?.sector || '').toLowerCase().includes(query.toLowerCase())
        );
      })
    : allSymbols;

  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-14 md:top-16 z-30">
        <div className="container mx-auto px-4 py-2">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Stocks' }]} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Stock Analysis</h1>
          <p className="text-muted-foreground mt-1">Explore AI-powered analysis for major US equities.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticker, name, or sector..."
            className="pl-10 h-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((symbol, idx) => {
            const info = getStockInfo(symbol);
            if (!info) return null;
            return (
              <motion.div
                key={symbol}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
              >
                <Link
                  href={`/stocks/${symbol.toLowerCase()}`}
                  className="block rounded-xl border border-border/50 bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{info.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{info.name}</p>
                    </div>
                    <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{info.sector}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No stocks match "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
