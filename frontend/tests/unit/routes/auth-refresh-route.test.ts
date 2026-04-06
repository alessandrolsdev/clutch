import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/refresh/route';

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

describe('auth refresh route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('renews the access session and forwards the rotated refresh cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          token: 'renewed-access-token',
          message: 'Sessão renovada.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'clutch_refresh=rotated-refresh-token; Path=/; HttpOnly; SameSite=Lax',
          },
        },
      )) as typeof fetch,
    );

    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: 'clutch_refresh=initial-refresh-token',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=renewed-access-token');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=rotated-refresh-token');
    await expect(response.json()).resolves.toEqual({ message: 'Sessao renovada.' });
  });

  it('clears cookies when the backend rejects a revoked refresh session', async () => {
    const capturedLogs = captureServerLogs();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
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
      )) as typeof fetch,
    );

    const response = await POST(
      new NextRequest('http://localhost/api/auth/refresh', {
        method: 'POST',
        headers: {
          'x-request-id': 'req-refresh-123',
          cookie: 'clutch_refresh=revoked-refresh-token',
        },
      }),
    );

    capturedLogs.restore();

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=');
    await expect(response.json()).resolves.toEqual({ message: 'Sessao invalida ou expirada.' });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_refresh_rejected')).toMatchObject({
      event: 'frontend_auth_refresh_rejected',
      requestId: 'req-refresh-123',
      status: 401,
    });
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_session_cleared')).toMatchObject({
      event: 'frontend_auth_session_cleared',
      requestId: 'req-refresh-123',
      reason: 'refresh_failed',
    });
    expect(JSON.stringify(capturedLogs.entries)).not.toContain('revoked-refresh-token');
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
