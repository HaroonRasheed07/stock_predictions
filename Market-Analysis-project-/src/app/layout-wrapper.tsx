'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useStockStore } from '@/store/stockStore';
import { fetchForecast, fetchIndicators, fetchSentiment } from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a stable QueryClient instance per component
let queryClientInstance: QueryClient | null = null;
function getQueryClient() {
  if (typeof window === 'undefined') {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return queryClientInstance;
}

export function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme } = useThemeStore();
  const { selectedTicker } = useStockStore();
  const [mounted, setMounted] = useState(false);
  const queryClient = useMemo(() => getQueryClient(), []);

  // Initialize theme on mount (client only)
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!mounted) return;

    const ticker = (selectedTicker || '').toUpperCase().trim();
    if (!ticker) return;

    const defaultPeriod = '1y';
    const defaultForecastDays = 10;

    queryClient.prefetchQuery({
      queryKey: ['stock-indicators', ticker, defaultPeriod],
      queryFn: () => fetchIndicators(ticker, defaultPeriod),
    });

    queryClient.prefetchQuery({
      queryKey: ['stock-sentiment', ticker],
      queryFn: () => fetchSentiment(ticker),
    });

    queryClient.prefetchQuery({
      queryKey: ['price-forecast', ticker, defaultPeriod],
      queryFn: () => fetchForecast(ticker, defaultForecastDays, defaultPeriod),
    });
  }, [mounted, queryClient, selectedTicker]);

  // During SSR, render a minimal structure  
  // During hydration (not mounted), render with children but no animations
  if (!mounted) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </QueryClientProvider>
    );
  }

  // After hydration, render with animations
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <Footer />
      </div>
    </QueryClientProvider>
  );
}
