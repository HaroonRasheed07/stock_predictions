'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BottomNav } from '@/components/layout/BottomNav';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  const [pageKey, setPageKey] = useState(pathname);
  const queryClient = useMemo(() => getQueryClient(), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    setPageKey(pathname);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div
          key={pageKey}
          className="flex-1 page-enter"
        >
          {children}
        </div>
        <div className="pb-20 md:pb-0"><Footer /></div>
      </div>
      <BottomNav />
    </QueryClientProvider>
  );
}
