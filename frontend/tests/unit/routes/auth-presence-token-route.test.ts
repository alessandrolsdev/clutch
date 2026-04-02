import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/auth/presence-token/route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

describe('auth presence token route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('returns the websocket credential when the session cookie is valid', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      expect(headers.get('x-request-id')).toBe('req-presence-123');

      return new Response(
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
      );
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/auth/presence-token', {
      headers: {
        cookie: 'clutch_session=jwt-token',
        'x-request-id': 'req-presence-123',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ token: 'jwt-token' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('clears the cookie when the backend rejects the session token', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      expect(headers.get('x-request-id')).toBeTruthy();

      return new Response(JSON.stringify({ message: 'Token invalido ou expirado.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/auth/presence-token', {
      headers: {
        cookie: 'clutch_session=expired-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
  });
});

afterAll(() => {
  if (typeof originalInternalApiUrl === 'undefined') {
    delete process.env.INTERNAL_API_URL;
  } else {
    process.env.INTERNAL_API_URL = originalInternalApiUrl;
  }

  if (typeof originalApiUrl === 'undefined') {
    delete process.env.NEXT_PUBLIC_API_URL;
    return;
  }

  process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});
