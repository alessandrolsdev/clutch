'use client';

import { useEffect, useRef } from 'react';
import {
  fetchPresenceCredential,
  PresenceConnection,
  publishPresenceState,
} from '@/services/presence';
import { usePresenceStore } from '@/store/presence-store';
import { useAuthStore } from '@/store/auth-store';

export function usePresence(): void {
  const status = useAuthStore((state) => state.status);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setConnectionStatus = usePresenceStore((state) => state.setConnectionStatus);
  const upsertPresence = usePresenceStore((state) => state.upsertPresence);
  const clearAll = usePresenceStore((state) => state.clearAll);
  const connectionRef = useRef<PresenceConnection | null>(null);
  const isPageVisibleRef = useRef(true);

  useEffect(() => {
    isPageVisibleRef.current =
      typeof document === 'undefined' ? true : !document.hidden;
  }, []);

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

          if (nextStatus === 'connected') {
            void publishPresenceState({
              status: isPageVisibleRef.current ? 'ONLINE' : 'AFK',
            }).catch(() => undefined);
          }
        },
        onAuthFailure: () => {
          clearAll();
          clearSession();
        },
      });
    }

    connectionRef.current.connect();

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;

      if (useAuthStore.getState().status !== 'authenticated') {
        return;
      }

      if (usePresenceStore.getState().connectionStatus !== 'connected') {
        return;
      }

      void publishPresenceState({
        status: document.hidden ? 'AFK' : 'ONLINE',
      }).catch(() => undefined);
    };

    const handlePageHide = () => {
      if (useAuthStore.getState().status !== 'authenticated') {
        return;
      }

      void publishPresenceState(
        {
          status: 'OFFLINE',
          platform: null,
        },
        { keepalive: true },
      ).catch(() => undefined);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, [clearAll, clearSession, setConnectionStatus, status, upsertPresence]);
}
