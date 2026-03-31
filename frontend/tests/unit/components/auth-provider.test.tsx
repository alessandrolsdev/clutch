import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth/auth-provider';
import { resetAuthStore, useAuthStore } from '@/store/auth-store';

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const { fetchAuthSessionMock } = vi.hoisted(() => ({
  fetchAuthSessionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/feed',
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock('@/services/session', () => ({
  fetchAuthSession: fetchAuthSessionMock,
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    resetAuthStore();
    replaceMock.mockReset();
    refreshMock.mockReset();
    fetchAuthSessionMock.mockReset();
  });

  it('hydrates the authenticated session', async () => {
    fetchAuthSessionMock.mockResolvedValue({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    render(
      <AuthProvider>
        <div>content</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().user).toEqual({
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      });
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects protected routes when the session is missing', async () => {
    fetchAuthSessionMock.mockResolvedValue(null);

    render(
      <AuthProvider>
        <div>content</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
