'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Moon, Sun, ChartNoAxesCombined } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/markets/stock', label: 'Markets' },
  { href: '/markets/brief', label: 'Stock Brief' },
  { href: '/markets/discover', label: 'Discover' },
  { href: '/markets/stock/watchlist', label: 'Watchlist' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact Us' },
];

export const Navbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-card/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between md:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-105">
              <ChartNoAxesCombined className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground hidden sm:block">
              MarketPulse
            </span>
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
          </div>
        </div>
      </div>
    </nav>
  );
};
