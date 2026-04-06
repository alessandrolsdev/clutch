import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';

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

describe('auth logout route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('clears the local session cookie and forwards the backend refresh revocation request', async () => {
    const capturedLogs = captureServerLogs();
    const fetchHandler = vi.fn(async () => new Response(
      JSON.stringify({ message: 'Sessão encerrada.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'clutch_refresh=; Path=/; HttpOnly; Max-Age=0',
        },
      },
    ));

    vi.stubGlobal(
      'fetch',
      fetchHandler as typeof fetch,
    );

    const response = await POST(
      new NextRequest('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-request-id': 'req-logout-123',
          cookie: 'clutch_session=jwt-token; clutch_refresh=refresh-token',
        },
      }),
    );

    capturedLogs.restore();

    expect(response.status).toBe(200);
    expect(fetchHandler).toHaveBeenCalledTimes(1);
    const logoutCall = fetchHandler.mock.calls.at(0) as unknown as
      | [RequestInfo | URL, RequestInit | undefined]
      | undefined;
    const requestInit = logoutCall?.[1];
    expect(new Headers(requestInit?.headers).get('cookie')).toContain('clutch_refresh=refresh-token');
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=');
    expect(capturedLogs.entries.find((entry) => entry.event === 'frontend_auth_logout_completed')).toMatchObject({
      event: 'frontend_auth_logout_completed',
      requestId: 'req-logout-123',
      status: 200,
    });
    expect(JSON.stringify(capturedLogs.entries)).not.toContain('refresh-token');
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
