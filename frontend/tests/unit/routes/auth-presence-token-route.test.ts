import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/auth/presence-token/route';

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
  return { entries, restore() { stdoutSpy.mockRestore(); stderrSpy.mockRestore(); } };
}

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

  it('refreshes the websocket credential when the access token expires', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        if (fetchMock.mock.calls.filter(([calledInput]) => String(calledInput).endsWith('/auth/me')).length === 1) {
          return new Response(JSON.stringify({ message: 'Token invalido ou expirado.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            id: 'user-1',
            username: 'clutchplayer',
            email: 'clutchplayer@clutch.gg',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          token: 'new-access-token',
          message: 'Sessão renovada.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'clutch_refresh=refresh-rotated; Path=/; HttpOnly; SameSite=Lax',
          },
        },
      );
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/auth/presence-token', {
      headers: {
        cookie: 'clutch_session=expired-token; clutch_refresh=refresh-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=new-access-token');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=refresh-rotated');
    await expect(response.json()).resolves.toEqual({ token: 'new-access-token' });
  });

  it('returns 401 and clears cookies when the refresh session was revoked', async () => {
    const capturedLogs = captureServerLogs();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return new Response(JSON.stringify({ message: 'Token inválido ou expirado.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          message: 'Refresh token inválido ou expirado.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'clutch_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
          },
        },
      );
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/auth/presence-token', {
      headers: {
        'x-request-id': 'req-presence-401',
        cookie: 'clutch_session=expired-token; clutch_refresh=invalid-refresh-token',
      },
    });

    const response = await GET(request);

    capturedLogs.restore();

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=');
    await expect(response.json()).resolves.toEqual({
      message: 'Token invalido ou expirado.',
    });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_refresh_start')).toMatchObject({
      event: 'frontend_auth_refresh_start',
      requestId: 'req-presence-401',
      path: '/api/auth/presence-token',
    });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_refresh_failed')).toMatchObject({
      event: 'frontend_auth_refresh_failed',
      requestId: 'req-presence-401',
      status: 401,
    });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_session_cleared')).toMatchObject({
      event: 'frontend_auth_session_cleared',
      requestId: 'req-presence-401',
      reason: 'refresh_rejected',
    });
    expect(JSON.stringify(capturedLogs.entries)).not.toContain('invalid-refresh-token');
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
