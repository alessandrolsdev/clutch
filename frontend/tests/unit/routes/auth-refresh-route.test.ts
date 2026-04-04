import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/refresh/route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

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
