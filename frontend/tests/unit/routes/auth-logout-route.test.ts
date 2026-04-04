import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';

describe('auth logout route', () => {
  it('clears the local session cookie and forwards the backend refresh cleanup cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ message: 'Sessão encerrada.' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'clutch_refresh=; Path=/; HttpOnly; Max-Age=0',
          },
        },
      )) as typeof fetch,
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
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
    expect(response.headers.get('set-cookie')).toContain('clutch_refresh=');
  });
});
