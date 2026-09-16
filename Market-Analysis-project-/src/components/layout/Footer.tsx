'use client';

import Link from 'next/link';
import { Github, Linkedin } from 'lucide-react';
import Image from 'next/image';
import { useThemeStore } from '@/store/themeStore';
import { useState, useEffect } from 'react';

export const Footer = () => {
  const { theme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="relative w-auto" style={{ height: 'clamp(30px, 5vw, 40px)' }}>
              {mounted && theme === 'dark' ? (
                <Image
                  src="/logo-dark.png"
                  alt="Stock Vanta"
                  width={229}
                  height={40}
                  className="object-contain h-full w-auto"
                />
              ) : (
                <Image
                  src="/logo.png"
                  alt="Stock Vanta"
                  width={229}
                  height={40}
                  className="object-contain h-full w-auto"
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered stock research with technical analysis, sentiment, forecasting, and risk intelligence.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/stocks" className="text-muted-foreground hover:text-primary transition-colors">
                  Stocks
                </Link>
              </li>
              <li>
                <Link href="/markets/brief" className="text-muted-foreground hover:text-primary transition-colors">
                  Stock Brief
                </Link>
              </li>
              <li>
                <Link href="/markets/discover" className="text-muted-foreground hover:text-primary transition-colors">
                  Discover
                </Link>
              </li>
            </ul>
          </div>

          {/* Learn */}
          <div>
            <h3 className="font-semibold mb-4">Learn</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/learn" className="text-muted-foreground hover:text-primary transition-colors">
                  All Guides
                </Link>
              </li>
              <li>
                <Link href="/learn/what-is-technical-analysis" className="text-muted-foreground hover:text-primary transition-colors">
                  Technical Analysis
                </Link>
              </li>
              <li>
                <Link href="/learn/what-is-rsi" className="text-muted-foreground hover:text-primary transition-colors">
                  What Is RSI?
                </Link>
              </li>
              <li>
                <Link href="/learn/what-is-macd" className="text-muted-foreground hover:text-primary transition-colors">
                  What Is MACD?
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="text-muted-foreground hover:text-primary transition-colors">
                  Methodology
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li className="pt-2">
                <div className="flex space-x-3">
                  <a
                    href="https://www.linkedin.com/in/haroon-rasheed-55022427a"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-border/60 bg-card hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                  <a
                    href="https://github.com/HaroonRasheed07"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-border/60 bg-card hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="GitHub"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 Stock Vanta. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
