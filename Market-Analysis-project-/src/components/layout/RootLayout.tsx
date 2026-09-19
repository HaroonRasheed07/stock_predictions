'use client';

import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { usePathname } from 'next/navigation';

interface RootLayoutProps {
  children: ReactNode;
}

export const RootLayout = ({ children }: RootLayoutProps) => {
  const pathname = usePathname() || '/';

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div key={pathname} className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
};
