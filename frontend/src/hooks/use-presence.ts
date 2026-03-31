'use client';

import { useEffect, useRef } from 'react';
import { fetchPresenceCredential, PresenceConnection } from '@/services/presence';
import { usePresenceStore } from '@/store/presence-store';
import { useAuthStore } from '@/store/auth-store';

export function usePresence(): void {
  const status = useAuthStore((state) => state.status);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setConnectionStatus = usePresenceStore((state) => state.setConnectionStatus);
  const upsertPresence = usePresenceStore((state) => state.upsertPresence);
  const clearAll = usePresenceStore((state) => state.clearAll);
  const connectionRef = useRef<PresenceConnection | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      clearAll();
      return;
    }

    if (!connectionRef.current) {
      connectionRef.current = new PresenceConnection({
        getCredential: fetchPresenceCredential,
        onPresence: (payload, receivedAt) => {
          upsertPresence(payload, receivedAt);
        },
        onConnectionStatusChange: (nextStatus, errorMessage) => {
          setConnectionStatus(nextStatus, errorMessage ?? null);
        },
        onAuthFailure: () => {
          clearAll();
          clearSession();
        },
      });
    }

    connectionRef.current.connect();

    return () => {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, [clearAll, clearSession, setConnectionStatus, status, upsertPresence]);
}
