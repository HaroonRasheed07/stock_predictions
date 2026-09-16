'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/stocks?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg">
        <p className="text-7xl font-bold text-primary/20 mb-4">404</p>
        <h1 className="text-3xl font-bold mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for does not exist or has been moved.
        </p>

        <form onSubmit={handleSearch} className="relative max-w-sm mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a stock ticker..."
            className="pl-10"
          />
        </form>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="outline">Homepage</Button>
          </Link>
          <Link href="/stocks">
            <Button>Browse Stocks</Button>
          </Link>
          <Link href="/learn">
            <Button variant="outline">Learn</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
