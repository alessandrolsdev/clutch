import { createHmac, timingSafeEqual } from 'node:crypto';
import axios from 'axios';
import {
  createIntegrationError,
  logIntegrationProviderEvent,
  translateUpstreamError,
} from '../integration.errors';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_CURRENT_USER_URL = 'https://discord.com/api/v10/users/@me';
const DISCORD_TIMEOUT_MS = 10_000;
const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;
const DISCORD_OAUTH_SCOPE = 'identify';

type DiscordOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type DiscordStatePayload = {
  userId: string;
  issuedAt: number;
};

type DiscordTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type DiscordCurrentUserResponse = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export type DiscordTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string;
  tokenType: string;
};

export type DiscordIdentity = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

function createStateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function assertValidRedirectUri(redirectUri: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redirectUri);
  } catch {
    throw createIntegrationError(
      'discord',
      503,
      'misconfigured',
      'Integração Discord indisponível no runtime atual.',
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw createIntegrationError(
      'discord',
      503,
      'misconfigured',
      'Integração Discord indisponível no runtime atual.',
    );
  }
}

function resolveDiscordOAuthConfig(): DiscordOAuthConfig {
  const clientId = process.env['DISCORD_CLIENT_ID']?.trim();
  const clientSecret = process.env['DISCORD_CLIENT_SECRET']?.trim();
  const redirectUri = process.env['DISCORD_REDIRECT_URI']?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    logIntegrationProviderEvent(
      'discord',
      'integration_discord_unavailable',
      'misconfigured',
      'Discord OAuth config is incomplete in the current runtime.',
    );

    throw createIntegrationError(
      'discord',
      503,
      'misconfigured',
      'Integração Discord indisponível no runtime atual.',
    );
  }

  try {
    assertValidRedirectUri(redirectUri);
  } catch (error) {
    logIntegrationProviderEvent(
      'discord',
      'integration_discord_unavailable',
      'misconfigured',
      'Discord redirect URI is invalid for the current runtime.',
      { targetUrl: redirectUri },
    );
    throw error;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function encodeStatePayload(payload: DiscordStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeStatePayload(value: string): DiscordStatePayload {
  let parsedPayload: Partial<DiscordStatePayload>;

  try {
    parsedPayload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<DiscordStatePayload>;
  } catch {
    throw createIntegrationError(
      'discord',
      400,
      'invalid_request',
      'Callback Discord inválido.',
    );
  }

  if (
    typeof parsedPayload.userId !== 'string' ||
    parsedPayload.userId.trim().length === 0 ||
    typeof parsedPayload.issuedAt !== 'number' ||
    !Number.isFinite(parsedPayload.issuedAt)
  ) {
    throw createIntegrationError(
      'discord',
      400,
      'invalid_request',
      'Callback Discord inválido.',
    );
  }

  return {
    userId: parsedPayload.userId,
    issuedAt: parsedPayload.issuedAt,
  };
}

function createStateValue(userId: string, secret: string): string {
  const encodedPayload = encodeStatePayload({
    userId,
    issuedAt: Date.now(),
  });

  return `${encodedPayload}.${createStateSignature(encodedPayload, secret)}`;
}

function validateStateValue(state: string, secret: string): DiscordStatePayload {
  const segments = state.split('.');

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw createIntegrationError(
      'discord',
      400,
      'invalid_request',
      'Callback Discord inválido.',
    );
  }

  const [encodedPayload, receivedSignature] = segments;
  const expectedSignature = createStateSignature(encodedPayload, secret);
  const receivedSignatureBuffer = Buffer.from(receivedSignature, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw createIntegrationError(
      'discord',
      400,
      'invalid_request',
      'Callback Discord inválido.',
    );
  }

  const payload = decodeStatePayload(encodedPayload);

  if (Date.now() - payload.issuedAt > DISCORD_STATE_TTL_MS) {
    throw createIntegrationError(
      'discord',
      400,
      'invalid_request',
      'Callback Discord inválido ou expirado.',
    );
  }

  return payload;
}

function buildAvatarUrl(userId: string, avatarHash: string | null): string | null {
  if (!avatarHash) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}

export const discordService = {
  createAuthorizationUrl(userId: string): { authorizationUrl: string; state: string } {
    const config = resolveDiscordOAuthConfig();
    const state = createStateValue(userId, config.clientSecret);
    const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);

    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('scope', DISCORD_OAUTH_SCOPE);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('prompt', 'consent');

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
    };
  },

  validateState(state: string): DiscordStatePayload {
    const config = resolveDiscordOAuthConfig();
    return validateStateValue(state, config.clientSecret);
  },

  async exchangeCodeWithRedirectUri(code: string, redirectUri: string): Promise<DiscordTokenSet> {
    const config = resolveDiscordOAuthConfig();
    assertValidRedirectUri(redirectUri);

    try {
      const response = await axios.post<DiscordTokenResponse>(
        DISCORD_TOKEN_URL,
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: DISCORD_TIMEOUT_MS,
        },
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token ?? null,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
        tokenType: response.data.token_type,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
        [400, 401, 403].includes((error as { response?: { status?: number } }).response?.status as number)
      ) {
        throw createIntegrationError(
          'discord',
          400,
          'invalid_request',
          'Autorização Discord inválida ou expirada.',
        );
      }

      throw translateUpstreamError(
        'discord',
        error,
        'Integração Discord indisponível no momento.',
        { targetUrl: DISCORD_TOKEN_URL },
      );
    }
  },

  async exchangeCode(code: string): Promise<DiscordTokenSet> {
    const config = resolveDiscordOAuthConfig();
    return this.exchangeCodeWithRedirectUri(code, config.redirectUri);
  },

  async getCurrentUser(accessToken: string): Promise<DiscordIdentity> {
    try {
      const response = await axios.get<DiscordCurrentUserResponse>(
        DISCORD_CURRENT_USER_URL,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: DISCORD_TIMEOUT_MS,
        },
      );

      return {
        id: response.data.id,
        username: response.data.username,
        globalName: response.data.global_name,
        avatarUrl: buildAvatarUrl(response.data.id, response.data.avatar),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
        [401, 403].includes((error as { response?: { status?: number } }).response?.status as number)
      ) {
        throw createIntegrationError(
          'discord',
          400,
          'invalid_request',
          'Autorização Discord inválida ou expirada.',
        );
      }

      throw translateUpstreamError(
        'discord',
        error,
        'Integração Discord indisponível no momento.',
        { targetUrl: DISCORD_CURRENT_USER_URL },
      );
    }
  },
};
