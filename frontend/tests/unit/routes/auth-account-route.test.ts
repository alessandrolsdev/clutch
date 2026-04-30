import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as completeAccountLink } from '@/app/api/auth/accounts/[provider]/link/callback/route';
import { GET as completeAccountReauth } from '@/app/api/auth/accounts/[provider]/reauth/callback/route';

const originalInternalApiUrl = process.env.INTERNAL_API_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe('auth account connection frontend routes', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_URL = 'http://backend.test';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_API_URL = '/api';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redireciona callback de linking para settings com sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'http://backend.test/auth/accounts/google/link/callback?code=oauth-code&state=signed-state',
      );

      return new Response(
        JSON.stringify({
          provider: 'GOOGLE',
          externalId: 'google-external-id',
          status: 'CONNECTED',
          connectionType: 'SOCIAL_LOGIN',
          message: 'Google vinculado com sucesso.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch);

    const response = await completeAccountLink(
      new NextRequest('http://localhost/api/auth/accounts/google/link/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'google' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/settings/integrations?connectionStatus=success&connectionMessage=Google+vinculado+com+sucesso.',
    );
  });

  it('redireciona callback Steam OpenID sem propagar query sensivel', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const backendUrl = new URL(String(input));

      expect(backendUrl.origin).toBe('http://backend.test');
      expect(backendUrl.pathname).toBe('/auth/accounts/steam/link/callback');
      expect(backendUrl.searchParams.get('state')).toBe('signed-state');
      expect(backendUrl.searchParams.get('openid.mode')).toBe('id_res');
      expect(backendUrl.searchParams.get('openid.claimed_id')).toBe(
        'https://steamcommunity.com/openid/id/76561198000000000',
      );

      return new Response(
        JSON.stringify({
          provider: 'STEAM',
          externalId: '76561198000000000',
          status: 'CONNECTED',
          connectionType: 'CONNECTED_ACCOUNT',
          message: 'Steam verificada e conectada com sucesso.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch);

    const response = await completeAccountLink(
      new NextRequest(
        'http://localhost/api/auth/accounts/steam/link/callback?state=signed-state&openid.mode=id_res&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198000000000',
      ),
      { params: Promise.resolve({ provider: 'steam' }) },
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=success');
    expect(location).toContain('Steam+verificada');
    expect(location).not.toContain('signed-state');
    expect(location).not.toContain('openid');
    expect(location).not.toContain('76561198000000000');
  });

  it('redireciona callback MyAnimeList sem propagar code ou state', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'http://backend.test/auth/accounts/myanimelist/link/callback?code=oauth-code&state=signed-state',
      );

      return new Response(
        JSON.stringify({
          provider: 'MYANIMELIST',
          externalId: '123456',
          status: 'CONNECTED',
          connectionType: 'CONNECTED_ACCOUNT',
          message: 'MyAnimeList vinculado com sucesso.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch);

    const response = await completeAccountLink(
      new NextRequest('http://localhost/api/auth/accounts/myanimelist/link/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'myanimelist' }) },
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=success');
    expect(location).toContain('MyAnimeList+vinculado');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
    expect(location).not.toContain('123456');
  });

  it('redireciona erro de linking sem expor payload sensivel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        message: 'Esta identidade externa já está vinculada a outro usuário.',
        accessToken: 'should-not-leak',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeAccountLink(
      new NextRequest('http://localhost/api/auth/accounts/discord/link/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'discord' }) },
    );

    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=error');
    expect(location).toContain('Esta+identidade+externa');
    expect(location).not.toContain('should-not-leak');
  });

  it('redireciona erro de linking com fallback quando mensagem contem code ou state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        message: 'Falha OAuth code=oauth-code state=signed-state token=provider-token',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeAccountLink(
      new NextRequest('http://localhost/api/auth/accounts/google/link/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'google' }) },
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=error');
    expect(location).toContain('Nao+foi+possivel+concluir+a+conexao+agora.');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
    expect(location).not.toContain('provider-token');
  });

  it('bloqueia provider invalido no callback frontend sem chamar backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await completeAccountLink(
      new NextRequest('http://localhost/api/auth/accounts/unknown/link/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'unknown' }) },
    );

    const location = response.headers.get('location') ?? '';

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=error');
    expect(location).toContain('Provider+de+conta');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
  });

  it('redireciona erro de reauth sem expor code ou state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        message: 'A identidade retornada pelo provider não corresponde à conta original.',
        state: 'signed-state',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeAccountReauth(
      new NextRequest('http://localhost/api/auth/accounts/google/reauth/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'google' }) },
    );

    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=error');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
  });

  it('redireciona erro de reauth com fallback quando mensagem contem segredo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        message: 'Provider retornou secret=client-secret refresh_token=refresh-token',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as typeof fetch);

    const response = await completeAccountReauth(
      new NextRequest('http://localhost/api/auth/accounts/discord/reauth/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'discord' }) },
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('connectionStatus=error');
    expect(location).toContain('Nao+foi+possivel+concluir+a+reconexao+agora.');
    expect(location).not.toContain('client-secret');
    expect(location).not.toContain('refresh-token');
    expect(location).not.toContain('oauth-code');
    expect(location).not.toContain('signed-state');
  });

  it('redireciona callback de reauth para settings com sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'http://backend.test/auth/accounts/discord/reauth/callback?code=oauth-code&state=signed-state',
      );

      return new Response(
        JSON.stringify({
          provider: 'DISCORD',
          externalId: 'discord-external-id',
          status: 'CONNECTED',
          connectionType: 'CONNECTED_ACCOUNT',
          message: 'Discord reconectado com sucesso.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch);

    const response = await completeAccountReauth(
      new NextRequest('http://localhost/api/auth/accounts/discord/reauth/callback?code=oauth-code&state=signed-state'),
      { params: Promise.resolve({ provider: 'discord' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/settings/integrations?connectionStatus=success&connectionMessage=Discord+reconectado+com+sucesso.',
    );
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
