import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

describe('auth logout route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    vi.restoreAllMocks();
  });

  it('clears the local session cookie and forwards the backend refresh revocation request', async () => {
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
          cookie: 'clutch_session=jwt-token; clutch_refresh=refresh-token',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchHandler).toHaveBeenCalledTimes(1);
    const logoutCall = fetchHandler.mock.calls.at(0) as unknown as
      | [RequestInfo | URL, RequestInit | undefined]
      | undefined;
    const requestInit = logoutCall?.[1];
    expect(new Headers(requestInit?.headers).get('cookie')).toContain('clutch_refresh=refresh-token');
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=');
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
