import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';

type AuthLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background-primary text-primary">
      <Navbar variant="auth" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-page-x py-page-y">
        <div className="flex w-full items-center justify-center">{children}</div>
      </main>
    </div>
  );
}
