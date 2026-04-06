import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

function captureServerLogs() {
  const entries: Array<Record<string, unknown>> = [];

  const collect = (chunk: string | Uint8Array): boolean => {
    const serialized = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');

    for (const line of serialized.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('{')) {
        continue;
      }

      entries.push(JSON.parse(trimmed) as Record<string, unknown>);
    }

    return true;
  };

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stdout.write);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stderr.write);

  return {
    entries,
    restore() {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

describe('auth login route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets an httpOnly access cookie and forwards the refresh cookie when login succeeds', async () => {
    const capturedLogs = captureServerLogs();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      expect(headers.get('x-request-id')).toBe('req-login-123');

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
            'Set-Cookie': 'clutch_refresh=refresh-token; Path=/; HttpOnly; SameSite=Lax',
          },
        },
      );
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'req-login-123',
        },
        body: JSON.stringify({
          email: 'clutchplayer@clutch.gg',
          password: 'clutch123',
        }),
      }),
    );

    capturedLogs.restore();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain(AUTH_SESSION_COOKIE_NAME);
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('jwt-token');
    expect(setCookieHeader).toContain('clutch_refresh=refresh-token');
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_login_start')).toMatchObject({
      event: 'frontend_auth_login_start',
      requestId: 'req-login-123',
      path: '/api/auth/login',
    });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_login_success')).toMatchObject({
      event: 'frontend_auth_login_success',
      requestId: 'req-login-123',
      status: 200,
      username: 'clutchplayer',
    });
    expect(JSON.stringify(capturedLogs.entries)).not.toContain('jwt-token');
    expect(JSON.stringify(capturedLogs.entries)).not.toContain('refresh-token');
  });

  it('propagates invalid credentials without setting a session cookie', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      expect(headers.get('x-request-id')).toBeTruthy();

      return new Response(JSON.stringify({ message: 'Credenciais inválidas.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      message: 'Credenciais inválidas.',
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
