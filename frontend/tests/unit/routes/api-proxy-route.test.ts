import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/[...path]/route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

describe('api proxy route', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost';
    vi.restoreAllMocks();
  });

  it('forwards the bearer token from the session cookie', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toBeDefined();
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer jwt-token');
      expect(headers.get('x-request-id')).toBe('req-proxy-123');

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

    const request = new NextRequest('http://localhost/api/profiles/clutchplayer', {
      headers: {
        cookie: 'clutch_session=jwt-token',
        'x-request-id': 'req-proxy-123',
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ['profiles', 'clutchplayer'] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the session cookie on backend 401 responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-request-id')).toBeTruthy();

      return new Response(JSON.stringify({ message: 'Token inválido ou expirado.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/profiles/clutchplayer', {
      headers: {
        cookie: 'clutch_session=expired-token',
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ['profiles', 'clutchplayer'] }),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toContain('clutch_session=');
  });

  it('uses the configured public app origin when only a relative public API path is available', async () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.clutch.gg';
    process.env.NEXT_PUBLIC_API_URL = '/api';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://preview.clutch.gg/api/profiles/clutchplayer');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer jwt-token');

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('https://preview.clutch.gg/api/profiles/clutchplayer', {
      headers: {
        cookie: 'clutch_session=jwt-token',
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ['profiles', 'clutchplayer'] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves multipart payloads when proxying uploads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const multipartBody = Buffer.from(
      '--boundary-123\r\n' +
        'Content-Disposition: form-data; name="file"; filename="upload.png"\r\n' +
        'Content-Type: image/png\r\n\r\n' +
        'PNG\r\n' +
        '--boundary-123--\r\n',
    );

    const request = new NextRequest('http://localhost/api/uploads/images', {
      method: 'POST',
      headers: {
        cookie: 'clutch_session=jwt-token',
        'content-type': 'multipart/form-data; boundary=boundary-123',
      },
      body: multipartBody,
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ['uploads', 'images'] }),
    });

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const forwardedCall = fetchMock.mock.calls[0];
    expect(forwardedCall).toBeDefined();
    const forwardedInit = forwardedCall?.[1];
    const headers = new Headers(forwardedInit?.headers);

    expect(headers.get('authorization')).toBe('Bearer jwt-token');
    expect(headers.get('x-forwarded-host')).toBe('localhost');
    expect(headers.get('x-forwarded-proto')).toBe('http');
    expect(headers.get('content-type')).toContain('multipart/form-data');
    expect(typeof forwardedInit?.body).not.toBe('string');
  });

  it('returns binary responses without serializing them as text', async () => {
    const imageBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = vi.fn(async () => new Response(imageBytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    }));

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const request = new NextRequest('http://localhost/api/uploads/images/test.png');
    const response = await GET(request, {
      params: Promise.resolve({ path: ['uploads', 'images', 'test.png'] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(imageBytes);
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
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }

  if (typeof originalAppUrl === 'undefined') {
    delete process.env.NEXT_PUBLIC_APP_URL;
    return;
  }

  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});
