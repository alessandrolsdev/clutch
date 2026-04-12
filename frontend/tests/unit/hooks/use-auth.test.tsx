import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/hooks/use-auth';

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const { logoutAuthSessionMock } = vi.hoisted(() => ({
  logoutAuthSessionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock('@/services/session', () => ({
  logoutAuthSession: logoutAuthSessionMock,
}));

describe('useAuth', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    logoutAuthSessionMock.mockReset();
  });

  it('clears the query cache and redirects on logout', async () => {
    logoutAuthSessionMock.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    queryClient.setQueryData(['profile', 'clutchplayer'], { id: 'user-1' });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['profile', 'clutchplayer'])).toBeUndefined();
    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
