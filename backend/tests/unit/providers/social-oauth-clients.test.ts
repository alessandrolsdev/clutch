import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
vi.mock('@/infra/integrations/discord/discord.service', () => ({
  discordService: {
    exchangeCodeWithRedirectUri: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

import axios from 'axios';
import {
  discordSocialOAuthClient,
  googleSocialOAuthClient,
} from '@/infra/integrations/social/social-oauth.clients';
import { discordService } from '@/infra/integrations/discord/discord.service';

const originalEnv = { ...process.env };

describe('social OAuth provider clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost/api/auth/social/google/callback',
      DISCORD_CLIENT_ID: 'discord-client-id',
      DISCORD_CLIENT_SECRET: 'discord-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost/settings/integrations/discord/callback',
      DISCORD_SOCIAL_REDIRECT_URI: 'http://localhost/api/auth/social/discord/callback',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('gera authorization URL Google com state e nonce', () => {
    const authorizationUrl = googleSocialOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'nonce-value',
    });
    const parsedUrl = new URL(authorizationUrl);

    expect(parsedUrl.origin).toBe('https://accounts.google.com');
    expect(parsedUrl.searchParams.get('client_id')).toBe('google-client-id');
    expect(parsedUrl.searchParams.get('response_type')).toBe('code');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/auth/social/google/callback',
    );
    expect(parsedUrl.searchParams.get('scope')).toBe('openid email profile');
    expect(parsedUrl.searchParams.get('state')).toBe('signed-state');
    expect(parsedUrl.searchParams.get('nonce')).toBe('nonce-value');
  });

  it('gera authorization URL Discord social com state e escopo identify', () => {
    const authorizationUrl = discordSocialOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'unused-discord-nonce',
    });
    const parsedUrl = new URL(authorizationUrl);

    expect(parsedUrl.origin).toBe('https://discord.com');
    expect(parsedUrl.pathname).toBe('/oauth2/authorize');
    expect(parsedUrl.searchParams.get('client_id')).toBe('discord-client-id');
    expect(parsedUrl.searchParams.get('response_type')).toBe('code');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/auth/social/discord/callback',
    );
    expect(parsedUrl.searchParams.get('scope')).toBe('identify');
    expect(parsedUrl.searchParams.get('state')).toBe('signed-state');
  });

  it('falha de forma controlada quando Google social login esta sem configuracao', () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(() => googleSocialOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'nonce-value',
    })).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        reason: 'misconfigured',
        clientMessage: 'Login Google indisponível no runtime atual.',
      }),
    );
  });

  it('rejeita redirect URI Google insegura ou malformada', () => {
    process.env.GOOGLE_REDIRECT_URI = 'https://user:secret@app.clutch.gg/callback';

    expect(() => googleSocialOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'nonce-value',
    })).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        reason: 'misconfigured',
      }),
    );
  });

  it('usa sub do Google userinfo como externalId confiavel', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        sub: 'google-sub-123',
        email: 'player@clutch.gg',
        email_verified: true,
        name: 'Clutch Player',
        picture: 'https://lh3.googleusercontent.com/avatar.png',
      },
    } as never);

    const identity = await googleSocialOAuthClient.exchangeCodeForIdentity('oauth-code');

    expect(identity).toMatchObject({
      provider: 'GOOGLE',
      externalId: 'google-sub-123',
      email: 'player@clutch.gg',
      emailVerified: true,
      displayName: 'Clutch Player',
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
    });
    expect(axios.post).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.stringContaining('code=oauth-code'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    expect(axios.get).toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      expect.objectContaining({
        headers: { Authorization: 'Bearer google-access-token' },
      }),
    );
  });

  it('mapeia erro HTTP de token Google para invalid_request', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { status: 401 },
    });

    await expect(googleSocialOAuthClient.exchangeCodeForIdentity('oauth-code')).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
      clientMessage: 'Autorização Google inválida ou expirada.',
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('mapeia indisponibilidade do userinfo Google para erro de provider', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'google-access-token',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockRejectedValue({
      response: { status: 503 },
    });

    await expect(googleSocialOAuthClient.exchangeCodeForIdentity('oauth-code')).rejects.toMatchObject({
      statusCode: 503,
      reason: 'upstream_unavailable',
      clientMessage: 'Login Google indisponível no momento.',
    });
  });

  it('rejeita userinfo Google sem sub confiavel', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'google-access-token',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        email: 'player@clutch.gg',
        email_verified: true,
      },
    } as never);

    await expect(googleSocialOAuthClient.exchangeCodeForIdentity('oauth-code')).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
      clientMessage: 'Identidade Google inválida.',
    });
  });

  it('nao deriva username de email Google nao verificado', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: 'google-access-token',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer',
      },
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        sub: 'google-sub-123',
        email: 'private.localpart@example.com',
        email_verified: false,
      },
    } as never);

    const identity = await googleSocialOAuthClient.exchangeCodeForIdentity('oauth-code');

    expect(identity.externalId).toBe('google-sub-123');
    expect(identity.emailVerified).toBe(false);
    expect(identity.username).toBeNull();
  });

  it('troca code Discord com redirect social e normaliza identidade', async () => {
    vi.mocked(discordService.exchangeCodeWithRedirectUri).mockResolvedValue({
      accessToken: 'discord-access-token',
      refreshToken: 'discord-refresh-token',
      expiresIn: 3600,
      scope: 'identify',
      tokenType: 'Bearer',
    });
    vi.mocked(discordService.getCurrentUser).mockResolvedValue({
      id: 'discord-user-id',
      username: 'discordplayer',
      globalName: 'Discord Player',
      avatarUrl: 'https://cdn.discordapp.com/avatars/discord-user-id/avatar.png',
    });

    const identity = await discordSocialOAuthClient.exchangeCodeForIdentity('oauth-code');

    expect(discordService.exchangeCodeWithRedirectUri).toHaveBeenCalledWith(
      'oauth-code',
      'http://localhost/api/auth/social/discord/callback',
    );
    expect(discordService.getCurrentUser).toHaveBeenCalledWith('discord-access-token');
    expect(identity).toMatchObject({
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      email: null,
      emailVerified: false,
      displayName: 'Discord Player',
      username: 'discordplayer',
      accessToken: 'discord-access-token',
      refreshToken: 'discord-refresh-token',
    });
  });

  it('falha de forma controlada quando Discord social login esta sem redirect configurado', () => {
    delete process.env.DISCORD_SOCIAL_REDIRECT_URI;

    expect(() => discordSocialOAuthClient.createAuthorizationUrl({
      state: 'signed-state',
      nonce: 'nonce-value',
    })).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        reason: 'misconfigured',
        clientMessage: 'Login Discord indisponível no runtime atual.',
      }),
    );
  });
});
