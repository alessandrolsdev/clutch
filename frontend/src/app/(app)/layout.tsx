import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AppLayout({ children }: AppLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
