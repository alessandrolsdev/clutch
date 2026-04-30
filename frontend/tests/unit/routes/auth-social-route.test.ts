import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as startSocialLogin } from '@/app/api/auth/social/[provider]/start/route';
import { GET as completeSocialLogin } from '@/app/api/auth/social/[provider]/callback/route';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';

const originalInternalApiUrl = process.env.INTERNAL_API_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe('auth social frontend routes', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_API_URL = '/api';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects start requests to provider authorization URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        provider: 'GOOGLE',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await startSocialLogin(
      new NextRequest('http://localhost/api/auth/social/google/start', {
        headers: { 'x-request-id': 'req-social-start-1' },
      }),
      { params: Promise.resolve({ provider: 'google' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
    );
  });

  it('stores CLUTCH session cookies after callback succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'http://backend.test/auth/social/discord/callback?code=oauth-code&state=signed-state',
      );

      return new Response(
        JSON.stringify({
          id: 'user-id-1',
          username: 'clutchplayer',
          token: 'access-token',
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
    }) as typeof fetch);

    const response = await completeSocialLogin(
      new NextRequest('http://localhost/api/auth/social/discord/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'discord' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/feed');
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain(AUTH_SESSION_COOKIE_NAME);
    expect(setCookieHeader).toContain('access-token');
    expect(setCookieHeader).toContain('clutch_refresh=refresh-token');
  });

  it('redirects callback errors back to login with honest message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ message: 'Callback social inválido.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeSocialLogin(
      new NextRequest('http://localhost/api/auth/social/google/callback?code=oauth-code&state=bad-state'),
      { params: Promise.resolve({ provider: 'google' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?socialAuthError=Callback+social+inv%C3%A1lido.',
    );
  });

  it('nao propaga code, state ou token no redirect final de erro social', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        message: 'Falha OAuth code=oauth-code state=signed-state token=provider-token',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeSocialLogin(
      new NextRequest('http://localhost/api/auth/social/google/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'google' }) },
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('socialAuthError=Nao+foi+possivel+concluir+o+login+social+agora.');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
    expect(location).not.toContain('provider-token');
  });
});

afterEach(() => {
  if (typeof originalInternalApiUrl === 'undefined') {
    delete process.env.INTERNAL_API_URL;
  } else {
    process.env.INTERNAL_API_URL = originalInternalApiUrl;
  }

  if (typeof originalAppUrl === 'undefined') {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }

  if (typeof originalApiUrl === 'undefined') {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});
