import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';

describe('auth logout route', () => {
  it('clears the session cookie', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/auth/logout', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
  });
});
