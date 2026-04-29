import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  googleSocialOAuthClient,
} from '@/infra/integrations/social/social-oauth.clients';

const originalEnv = { ...process.env };

describe('social OAuth provider clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost/api/auth/social/google/callback',
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
});
