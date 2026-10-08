'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg">
        <p className="text-7xl font-bold text-primary/20 mb-4">!</p>
        <h1 className="text-3xl font-bold mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-2">
          An unexpected error occurred while loading this page. The issue is usually temporary.
        </p>
        {error?.digest && (
          <p className="text-xs text-muted-foreground/70 mb-8">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
          <Link href="/">
            <Button>Back to homepage</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
