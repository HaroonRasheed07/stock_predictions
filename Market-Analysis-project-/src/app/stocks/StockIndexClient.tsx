'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { StockAllowlistEntry } from '@/lib/stock-allowlist';

export function StockIndexClient({ stocks }: { stocks: StockAllowlistEntry[] }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.sector.toLowerCase().includes(search.toLowerCase())
      )
    : stocks;

  const sectors = [...new Set(stocks.map((s) => s.sector))].sort();

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stocks by name, symbol, or sector..."
          className="pl-10"
        />
      </div>

      {sectors.map((sector) => {
        const sectorStocks = filtered.filter((s) => s.sector === sector);
        if (sectorStocks.length === 0) return null;
        return (
          <div key={sector}>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">{sector}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sectorStocks.map((stock) => (
                <Link
                  key={stock.symbol}
                  href={`/stocks/${stock.symbol.toLowerCase()}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div>
                    <p className="font-bold">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">{stock.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {stock.industry}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No stocks match your search.</p>
        </div>
      )}
    </div>
  );
}
