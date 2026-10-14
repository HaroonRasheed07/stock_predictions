'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Menu, X } from 'lucide-react';
import Image from 'next/image';
import { useThemeStore } from '@/store/themeStore';
import { rehydrateStockStore } from '@/store/stockStore';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/markets/stock', label: 'Stock Analysis' },
  { href: '/markets/discover', label: 'Discover' },
  { href: '/markets/stock/watchlist', label: 'Watchlist' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const Navbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // stockStore is created with skipHydration to keep SSR markup stable;
    // hydrate it after mount so the persisted ticker fallback actually loads.
    rehydrateStockStore();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-card/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between md:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center group flex-shrink-0" aria-label="StockVantex Home">
              <div className="relative w-auto" style={{ height: 'clamp(27px, 4.5vw, 37px)' }}>
                {mounted && theme === 'dark' ? (
                  <Image
                    src="/logo-dark.png"
                    alt="StockVantex"
                    width={224}
                    height={37}
                    className="object-contain h-full w-auto"
                    priority
                  />
                ) : (
                  <Image
                    src="/logo.png"
                    alt="StockVantex"
                    width={224}
                    height={37}
                    className="object-contain h-full w-auto"
                    priority
                  />
                )}
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-sm font-medium transition-colors duration-150',
                      isActive(link.href)
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                aria-label="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 md:hidden"
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 top-14 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Menu panel */}
          <div className="relative bg-card border-b border-border/60 shadow-lg px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                <div
                  className={cn(
                    'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive(link.href)
                      ? 'text-primary bg-primary/5'
                      : 'text-foreground hover:bg-muted/50'
                  )}
                >
                  {link.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
