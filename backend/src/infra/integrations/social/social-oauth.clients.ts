import axios from 'axios';
import {
  createIntegrationError,
  logIntegrationProviderEvent,
  translateUpstreamError,
} from '../integration.errors';
import {
  discordService,
  type DiscordTokenSet,
} from '../discord/discord.service';
import type {
  SocialAuthProviderClient,
  SocialAuthProviderIdentity,
} from '../../../core/services/social-auth.service';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_TIMEOUT_MS = 10_000;

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type DiscordSocialOAuthConfig = {
  clientId: string;
  redirectUri: string;
};

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GoogleUserInfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
};

function assertValidRedirectUri(provider: 'google' | 'discord', redirectUri: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redirectUri);
  } catch {
    throw createIntegrationError(
      provider,
      503,
      'misconfigured',
      `Login ${provider === 'google' ? 'Google' : 'Discord'} indisponível no runtime atual.`,
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw createIntegrationError(
      provider,
      503,
      'misconfigured',
      `Login ${provider === 'google' ? 'Google' : 'Discord'} indisponível no runtime atual.`,
    );
  }
}

function resolveGoogleOAuthConfig(redirectUriOverride?: string): GoogleOAuthConfig {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim();
  const redirectUri = redirectUriOverride?.trim() || process.env['GOOGLE_REDIRECT_URI']?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    logIntegrationProviderEvent(
      'google',
      'integration_google_unavailable',
      'misconfigured',
      'Google social login config is incomplete in the current runtime.',
    );

    throw createIntegrationError(
      'google',
      503,
      'misconfigured',
      'Login Google indisponível no runtime atual.',
    );
  }

  assertValidRedirectUri('google', redirectUri);

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function resolveDiscordSocialOAuthConfig(redirectUriOverride?: string): DiscordSocialOAuthConfig {
  const clientId = process.env['DISCORD_CLIENT_ID']?.trim();
  const redirectUri = redirectUriOverride?.trim() || process.env['DISCORD_SOCIAL_REDIRECT_URI']?.trim();

  if (!clientId || !redirectUri) {
    logIntegrationProviderEvent(
      'discord',
      'integration_discord_unavailable',
      'misconfigured',
      'Discord social login config is incomplete in the current runtime.',
    );

    throw createIntegrationError(
      'discord',
      503,
      'misconfigured',
      'Login Discord indisponível no runtime atual.',
    );
  }

  assertValidRedirectUri('discord', redirectUri);

  return {
    clientId,
    redirectUri,
  };
}

function normalizeGoogleEmailVerified(value: GoogleUserInfoResponse['email_verified']): boolean {
  return value === true || value === 'true';
}

async function exchangeGoogleCode(code: string, config: GoogleOAuthConfig): Promise<GoogleTokenResponse> {
  try {
    const response = await axios.post<GoogleTokenResponse>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: GOOGLE_TIMEOUT_MS,
      },
    );

    return response.data;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
      [400, 401, 403].includes((error as { response?: { status?: number } }).response?.status as number)
    ) {
      throw createIntegrationError(
        'google',
        400,
        'invalid_request',
        'Autorização Google inválida ou expirada.',
      );
    }

    throw translateUpstreamError(
      'google',
      error,
      'Login Google indisponível no momento.',
      { targetUrl: GOOGLE_TOKEN_URL },
    );
  }
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
  try {
    const response = await axios.get<GoogleUserInfoResponse>(
      GOOGLE_USERINFO_URL,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: GOOGLE_TIMEOUT_MS,
      },
    );

    return response.data;
  } catch (error) {
    throw translateUpstreamError(
      'google',
      error,
      'Login Google indisponível no momento.',
      { targetUrl: GOOGLE_USERINFO_URL },
    );
  }
}

function buildGoogleAuthorizationUrl(state: string, nonce: string, redirectUri?: string): string {
  const config = resolveGoogleOAuthConfig(redirectUri);
  const authorizationUrl = new URL(GOOGLE_AUTHORIZE_URL);

  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('prompt', 'select_account');

  return authorizationUrl.toString();
}

function buildDiscordAuthorizationUrl(state: string, redirectUri?: string): string {
  const config = resolveDiscordSocialOAuthConfig(redirectUri);
  const authorizationUrl = new URL('https://discord.com/oauth2/authorize');

  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('scope', 'identify');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('prompt', 'consent');

  return authorizationUrl.toString();
}

function toDiscordIdentity(tokenSet: DiscordTokenSet, identity: {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}): SocialAuthProviderIdentity {
  return {
    provider: 'DISCORD',
    externalId: identity.id,
    email: null,
    emailVerified: false,
    displayName: identity.globalName ?? identity.username,
    username: identity.username,
    avatarUrl: identity.avatarUrl,
    accessToken: tokenSet.accessToken,
    refreshToken: tokenSet.refreshToken,
    metadata: {
      username: identity.username,
      globalName: identity.globalName,
      avatarUrl: identity.avatarUrl,
      tokenType: tokenSet.tokenType,
      scope: tokenSet.scope,
    },
  };
}

export const googleSocialOAuthClient: SocialAuthProviderClient = {
  provider: 'GOOGLE',

  createAuthorizationUrl({ state, nonce, redirectUri }): string {
    return buildGoogleAuthorizationUrl(state, nonce, redirectUri);
  },

  async exchangeCodeForIdentity(code, input): Promise<SocialAuthProviderIdentity> {
    const config = resolveGoogleOAuthConfig(input?.redirectUri);
    const tokenSet = await exchangeGoogleCode(code, config);
    const userInfo = await fetchGoogleUserInfo(tokenSet.access_token);

    if (typeof userInfo.sub !== 'string' || userInfo.sub.trim().length === 0) {
      throw createIntegrationError(
        'google',
        400,
        'invalid_request',
        'Identidade Google inválida.',
      );
    }

    const emailVerified = normalizeGoogleEmailVerified(userInfo.email_verified);

    return {
      provider: 'GOOGLE',
      externalId: userInfo.sub,
      email: userInfo.email ?? null,
      emailVerified,
      displayName: userInfo.name ?? null,
      username: emailVerified ? userInfo.email?.split('@')[0] ?? null : null,
      avatarUrl: userInfo.picture ?? null,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token ?? null,
      metadata: {
        email: userInfo.email ?? null,
        emailVerified,
        name: userInfo.name ?? null,
        picture: userInfo.picture ?? null,
        tokenType: tokenSet.token_type,
        scope: tokenSet.scope,
      },
    };
  },
};

export const discordSocialOAuthClient: SocialAuthProviderClient = {
  provider: 'DISCORD',

  createAuthorizationUrl({ state, redirectUri }): string {
    return buildDiscordAuthorizationUrl(state, redirectUri);
  },

  async exchangeCodeForIdentity(code, input): Promise<SocialAuthProviderIdentity> {
    const config = resolveDiscordSocialOAuthConfig(input?.redirectUri);
    const tokenSet = await discordService.exchangeCodeWithRedirectUri(code, config.redirectUri);
    const identity = await discordService.getCurrentUser(tokenSet.accessToken);

    return toDiscordIdentity(tokenSet, identity);
  },
};
