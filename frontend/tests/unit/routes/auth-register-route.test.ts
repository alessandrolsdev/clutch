import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

describe('auth register route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('sets an httpOnly access cookie and forwards the refresh cookie when register succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            id: 'user-2',
            username: 'new_player',
            token: 'jwt-register-token',
          }),
          {
            status: 201,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'clutch_refresh=refresh-register-token; Path=/; HttpOnly; SameSite=Lax',
            },
          },
        );
      }) as typeof fetch,
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'new_player',
          email: 'new_player@clutch.gg',
          password: 'secret123',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain(AUTH_SESSION_COOKIE_NAME);
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('jwt-register-token');
    expect(setCookieHeader).toContain('clutch_refresh=refresh-register-token');
  });

  it('returns friendly 409 without setting cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: 'Email ou username ja esta em uso.' }), {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }) as typeof fetch,
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'clutchplayer',
          email: 'clutchplayer@clutch.gg',
          password: 'secret123',
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      message: 'Email ou username ja esta em uso.',
    });
  });

  it('returns 400 when body does not match register contract', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'ab',
          email: 'invalid',
          password: '123',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'Username, email e senha sao obrigatorios.',
    });
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
