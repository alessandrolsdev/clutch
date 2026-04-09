import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenceProvider } from '@/components/auth/presence-provider';
import { resetAuthStore, useAuthStore } from '@/store/auth-store';
import { resetPresenceStore, usePresenceStore } from '@/store/presence-store';

const {
  connectMock,
  disconnectMock,
  publishPresenceStateMock,
  getLastOptions,
  resetLastOptions,
  setLastOptions,
} = vi.hoisted(() => {
  let lastOptions:
    | {
        onConnectionStatusChange?: (status: string, errorMessage?: string | null) => void;
        onAuthFailure?: () => void;
      }
    | null = null;

  return {
    connectMock: vi.fn(),
    disconnectMock: vi.fn(),
    publishPresenceStateMock: vi.fn(),
    getLastOptions: () => lastOptions,
    resetLastOptions: () => {
      lastOptions = null;
    },
    setLastOptions: (options: typeof lastOptions) => {
      lastOptions = options;
    },
  };
});

vi.mock('@/services/presence', () => {
  return {
    fetchPresenceCredential: vi.fn(),
    publishPresenceState: publishPresenceStateMock,
    PresenceConnection: class FakePresenceConnection {
      constructor(
        options: {
          onConnectionStatusChange?: (status: string, errorMessage?: string | null) => void;
          onAuthFailure?: () => void;
        },
      ) {
        setLastOptions(options);
      }

      connect() {
        connectMock();
      }

      disconnect() {
        disconnectMock();
      }
    },
  };
});

describe('PresenceProvider', () => {
  beforeEach(() => {
    resetAuthStore();
    resetPresenceStore();
    connectMock.mockReset();
    disconnectMock.mockReset();
    publishPresenceStateMock.mockReset();
    publishPresenceStateMock.mockResolvedValue(undefined);
    resetLastOptions();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  it('publishes online, afk and offline states through the real presence contract', async () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    render(
      <PresenceProvider>
        <div>content</div>
      </PresenceProvider>,
    );

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      getLastOptions()?.onConnectionStatusChange?.('connected', null);
    });

    expect(publishPresenceStateMock).toHaveBeenCalledWith({ status: 'ONLINE' });

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(publishPresenceStateMock).toHaveBeenCalledWith({ status: 'AFK' });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(publishPresenceStateMock).toHaveBeenCalledWith(
      {
        status: 'OFFLINE',
        platform: null,
      },
      { keepalive: true },
    );
  });

  it('clears auth and presence state when realtime authentication fails', async () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });
    usePresenceStore.getState().setConnectionStatus('connected');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'friend-1',
        status: 'ONLINE',
        currentGame: null,
        platform: 'WEB',
      },
      123,
    );

    render(
      <PresenceProvider>
        <div>content</div>
      </PresenceProvider>,
    );

    await act(async () => {
      getLastOptions()?.onAuthFailure?.();
    });

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(usePresenceStore.getState().connectionStatus).toBe('idle');
    expect(usePresenceStore.getState().entries).toEqual({});
  });
});
