import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'E-commerce Analytics Dashboard',
  description: 'Amazon Sales & Review Analytics Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
