'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, Bitcoin, ShoppingBag, BarChart3, LineChart, MessageSquare, Activity, Star } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const marketSections: Array<{
  title: string;
  path: string;
  icon: any;
  comingSoon?: boolean;
  subPages?: Array<{ title: string; path: string; icon: any }>;
}> = [
  {
    title: 'Stock Market',
    path: '/markets/stock',
    icon: TrendingUp,
    subPages: [
      { title: 'Overview', path: '/markets/stock', icon: BarChart3 },
      { title: 'Technical Analysis', path: '/markets/stock/technical', icon: LineChart },
      { title: 'Sentiment', path: '/markets/stock/sentiment', icon: MessageSquare },
      { title: 'Forecasting', path: '/markets/stock/forecast', icon: Activity },
      { title: 'Watchlist', path: '/markets/stock/watchlist', icon: Star },
    ],
  },
  // {
  //   title: 'Cryptocurrency',
  //   path: '/markets/crypto',
  //   icon: Bitcoin,
  //   subPages: [
  //     { title: 'Overview', path: '/markets/crypto', icon: BarChart3 },
  //     { title: 'Technical Analysis', path: '/markets/crypto/technical', icon: LineChart },
  //     { title: 'Sentiment', path: '/markets/crypto/sentiment', icon: MessageSquare },
  //     { title: 'Forecasting', path: '/markets/crypto/forecast', icon: Activity },
  //   ],
  // },
  // {
  //   title: 'E-commerce',
  //   path: '/markets/ecommerce',
  //   icon: ShoppingBag,
  //   subPages: [
  //     { title: 'Overview', path: '/markets/ecommerce', icon: BarChart3 },
  //     { title: 'Sentiment', path: '/markets/ecommerce/sentiment', icon: MessageSquare },
  //     { title: 'Products', path: '/markets/ecommerce/products', icon: ShoppingBag },
  //   ],
  // },
];

export function MarketsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const currentSection = marketSections.find((section) =>
    pathname.startsWith(section.path)
  );

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 flex-shrink-0"
          >
            <div className="sticky top-24 space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-4 text-lg">Markets</h3>
                <div className="space-y-2">
                  {marketSections.map((section) => (
                    <div key={section.path}>
                      <Link href={section.comingSoon ? '#' : section.path}>
                        <Button
                          variant={pathname.startsWith(section.path) ? 'default' : 'ghost'}
                          className={`w-full justify-start ${section.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!!section.comingSoon}
                        >
                          <section.icon className="mr-2 h-4 w-4" />
                          {section.title}
                          {section.comingSoon && (
                            <span className="ml-auto text-xs">Soon</span>
                          )}
                        </Button>
                      </Link>

                      {/* Sub-pages for active section */}
                      {currentSection?.path === section.path && section.subPages && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="ml-6 mt-2 space-y-1"
                        >
                          {section.subPages.map((subPage) => (
                            <Link key={subPage.path} href={subPage.path}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`w-full justify-start text-sm ${pathname === subPage.path
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground'
                                  }`}
                              >
                                <subPage.icon className="mr-2 h-3 w-3" />
                                {subPage.title}
                              </Button>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-2">Market Status</h3>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                  </span>
                  <span className="text-sm">Markets Open</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Live data updating every 10 seconds
                </p>
              </div>
            </div>
          </motion.aside>

          {/* Main Content */}
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 min-w-0"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}
