import Link from 'next/link';
import { ChartNoAxesCombined, Github, Twitter, Linkedin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <ChartNoAxesCombined className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">AI Driven Market Analysis</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time market intelligence and predictive analytics for modern traders & investors.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Markets</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/markets/stock" className="text-muted-foreground hover:text-primary transition-colors">
                  Stock Market
                </Link>
              </li>
              <li>
                <Link href="/markets/crypto" className="text-muted-foreground hover:text-primary transition-colors">
                  Cryptocurrency
                </Link>
              </li>
              <li>
                <Link href="/markets/ecommerce" className="text-muted-foreground hover:text-primary transition-colors">
                  E-commerce
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/analysis" className="text-muted-foreground hover:text-primary transition-colors">
                  Analysis Tools
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              
              {/* <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Documentation
                </a>
              </li> */}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold mb-4">Connect</h3>
            <div className="flex space-x-3">
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
          <p>© 2025 AI Driven Market Anaiysis. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
