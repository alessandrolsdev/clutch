import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/auth/me/route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

describe('auth me route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('returns the hydrated session when the cookie is valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
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
      }) as typeof fetch,
    );

    const request = new NextRequest('http://localhost/api/auth/me', {
      headers: {
        cookie: 'clutch_session=jwt-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      username: 'clutchplayer',
      email: 'clutchplayer@clutch.gg',
    });
  });

  it('clears the cookie when the backend rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: 'Token inválido ou expirado.' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }) as typeof fetch,
    );

    const request = new NextRequest('http://localhost/api/auth/me', {
      headers: {
        cookie: 'clutch_session=expired-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
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
