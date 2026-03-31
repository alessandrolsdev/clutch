'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { PresenceProvider } from '@/components/auth/presence-provider';
import { makeQueryClient } from '@/lib/query/make-query-client';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <AuthProvider>
      <PresenceProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PresenceProvider>
    </AuthProvider>
  );
}
