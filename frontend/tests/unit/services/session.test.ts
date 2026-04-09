import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession, logoutAuthSession } from '@/services/session';
import { resetAuthStore, useAuthStore } from '@/store/auth-store';

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));
const { publishPresenceStateMock } = vi.hoisted(() => ({
  publishPresenceStateMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: apiRequestMock,
}));

vi.mock('@/services/presence', () => ({
  publishPresenceState: publishPresenceStateMock,
}));

describe('session service', () => {
  beforeEach(() => {
    resetAuthStore();
    apiRequestMock.mockReset();
    publishPresenceStateMock.mockReset();
  });

  it('hydrates the session from the auth me contract', async () => {
    apiRequestMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'user-1',
          username: 'clutchplayer',
          email: 'clutchplayer@clutch.gg',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(fetchAuthSession()).resolves.toEqual({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    expect(apiRequestMock).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
      clearSessionOnUnauthorized: false,
    });
  });

  it('does not clear an existing session when bootstrap auth me returns 401', async () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    apiRequestMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(fetchAuthSession()).resolves.toBeNull();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });
  });

  it('clears the local session on logout', async () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    apiRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
    publishPresenceStateMock.mockResolvedValue(undefined);

    await logoutAuthSession();

    expect(publishPresenceStateMock).toHaveBeenCalledWith(
      {
        status: 'OFFLINE',
        platform: null,
      },
      { keepalive: true },
    );
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
    });
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
