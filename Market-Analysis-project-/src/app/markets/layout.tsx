import { MarketsLayout } from './layout-client';
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <MarketsLayout>{children}</MarketsLayout>;
}
