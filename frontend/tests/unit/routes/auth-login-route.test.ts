import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';

const originalEnv = process.env.NEXT_PUBLIC_API_URL;

describe('auth login route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://backend.test';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets an httpOnly cookie when login succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            id: 'user-1',
            username: 'clutchplayer',
            token: 'jwt-token',
            message: 'Acesso autorizado.',
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

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'clutchplayer@clutch.gg',
          password: 'clutch123',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(AUTH_SESSION_COOKIE_NAME);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('jwt-token');
  });

  it('propagates invalid credentials without setting a session cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: 'Credenciais inválidas.' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }) as typeof fetch,
    );

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'clutchplayer@clutch.gg',
          password: 'wrong-password',
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      message: 'Credenciais inválidas.',
    });
  });
});

afterAll(() => {
  if (typeof originalEnv === 'undefined') {
    delete process.env.NEXT_PUBLIC_API_URL;
    return;
  }

  process.env.NEXT_PUBLIC_API_URL = originalEnv;
});
