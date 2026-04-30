import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  createMyAnimeListCodeVerifier,
  isMyAnimeListOAuthConfigured,
  myAnimeListOAuthClient,
} from '@/infra/integrations/myanimelist/myanimelist-oauth.client';

const originalEnv = { ...process.env };

describe('myAnimeListOAuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      MYANIMELIST_CLIENT_ID: 'mal-client-id',
      MYANIMELIST_CLIENT_SECRET: 'mal-client-secret',
      MYANIMELIST_REDIRECT_URI: 'http://localhost/api/auth/accounts/myanimelist/link/callback',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detecta configuracao OAuth completa sem expor segredo', () => {
    expect(isMyAnimeListOAuthConfigured()).toBe(true);

    delete process.env['MYANIMELIST_CLIENT_SECRET'];

    expect(isMyAnimeListOAuthConfigured()).toBe(false);
  });

  it('gera authorization URL MyAnimeList com state e PKCE plain', () => {
    const authorizationUrl = new URL(myAnimeListOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'unused-nonce',
      codeChallenge: 'pkce-code-verifier',
    }));

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe('https://myanimelist.net/v1/oauth2/authorize');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('mal-client-id');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/auth/accounts/myanimelist/link/callback',
    );
    expect(authorizationUrl.searchParams.get('state')).toBe('signed-state');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe('pkce-code-verifier');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('plain');
  });

  it('falha de forma controlada quando config OAuth esta incompleta', () => {
    delete process.env['MYANIMELIST_CLIENT_ID'];

    expect(() => myAnimeListOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'unused-nonce',
      codeChallenge: 'pkce-code-verifier',
    })).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        reason: 'misconfigured',
        clientMessage: 'Conexão MyAnimeList indisponível no runtime atual.',
      }),
    );
  });

  it('gera code verifier PKCE nao vazio e URL-safe', () => {
    const verifier = createMyAnimeListCodeVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('usa id autenticado da MyAnimeList como externalId confiavel', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'mal-access-token',
        refresh_token: 'mal-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: 123456,
        name: 'malplayer',
        picture: 'https://cdn.myanimelist.net/images/user.jpg',
      },
    } as never);

    const identity = await myAnimeListOAuthClient.exchangeCodeForIdentity('oauth-code', {
      codeVerifier: 'pkce-code-verifier',
    });

    expect(identity).toMatchObject({
      provider: 'MYANIMELIST',
      externalId: '123456',
      email: null,
      emailVerified: false,
      displayName: 'malplayer',
      username: 'malplayer',
      accessToken: 'mal-access-token',
      refreshToken: 'mal-refresh-token',
    });
    expect(axios.post).toHaveBeenCalledWith(
      'https://myanimelist.net/v1/oauth2/token',
      expect.stringContaining('code_verifier=pkce-code-verifier'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.myanimelist.net/v2/users/@me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mal-access-token' },
      }),
    );
  });

  it('mapeia token exchange invalido para erro de dominio', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { status: 401 },
    });

    await expect(myAnimeListOAuthClient.exchangeCodeForIdentity('oauth-code', {
      codeVerifier: 'pkce-code-verifier',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
      clientMessage: 'Autorização MyAnimeList inválida ou expirada.',
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejeita payload autenticado sem id estavel', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'mal-access-token',
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        name: 'malplayer',
      },
    } as never);

    await expect(myAnimeListOAuthClient.exchangeCodeForIdentity('oauth-code', {
      codeVerifier: 'pkce-code-verifier',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
      clientMessage: 'Identidade MyAnimeList inválida.',
    });
  });
});
