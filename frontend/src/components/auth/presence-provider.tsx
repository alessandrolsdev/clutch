'use client';

import { type ReactNode } from 'react';
import { usePresence } from '@/hooks/use-presence';

type PresenceProviderProps = {
  children: ReactNode;
};

export function PresenceProvider({ children }: PresenceProviderProps) {
  usePresence();
  return children;
}
