'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { AppShellRouteWarmup } from '@/components/layout/app-shell-route-warmup';
import { Sidebar } from '@/components/layout/sidebar';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-background-primary text-primary">
      <AppShellRouteWarmup />

      <Navbar
        variant="app"
        menuOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen((state) => !state)}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-page-x py-page-y lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="min-w-0 space-y-section">{children}</main>
      </div>
    </div>
  );
}
