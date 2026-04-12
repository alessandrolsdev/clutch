import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import { resetAuthStore, useAuthStore } from '@/store/auth-store';

describe('apiRequest', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.restoreAllMocks();
  });

  it('renews the session silently and retries the original request once', async () => {
    let profileCalls = 0;
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/auth/refresh') {
        refreshCalls += 1;
        return new Response(JSON.stringify({ message: 'Sessao renovada.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/profiles/clutchplayer') {
        profileCalls += 1;

        if (profileCalls === 1) {
          return new Response(JSON.stringify({ message: 'Token invalido ou expirado.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const response = await apiRequest('/profiles/clutchplayer');

    expect(response.status).toBe(200);
    expect(profileCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().status).toBe('loading');
  });

  it('deduplicates concurrent refresh requests', async () => {
    const requestAttempts = new Map<string, number>();
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/auth/refresh') {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));

        return new Response(JSON.stringify({ message: 'Sessao renovada.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const attempts = (requestAttempts.get(url) ?? 0) + 1;
      requestAttempts.set(url, attempts);

      if (attempts === 1) {
        return new Response(JSON.stringify({ message: 'Token invalido ou expirado.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const [friendsResponse, notificationsResponse] = await Promise.all([
      apiRequest('/friends/user-1'),
      apiRequest('/notifications/user-1'),
    ]);

    expect(friendsResponse.status).toBe(200);
    expect(notificationsResponse.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(requestAttempts.get('/api/friends/user-1')).toBe(2);
    expect(requestAttempts.get('/api/notifications/user-1')).toBe(2);
  });

  it('clears the session only when the silent refresh fails', async () => {
    useAuthStore.getState().setSession({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/auth/refresh') {
        return new Response(JSON.stringify({ message: 'Sessao invalida.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ message: 'Token invalido ou expirado.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const response = await apiRequest('/posts/feed/user-1');

    expect(response.status).toBe(401);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('does not try to refresh when unauthorized retries are disabled', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/auth/refresh') {
        throw new Error('refresh should not be called');
      }

      return new Response(JSON.stringify({ message: 'Credenciais invalidas.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const response = await apiRequest('/auth/login', {
      method: 'POST',
      retryOnUnauthorized: false,
      clearSessionOnUnauthorized: false,
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
