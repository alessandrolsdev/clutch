import { randomBytes } from 'node:crypto';
import axios from 'axios';
import {
  createIntegrationError,
  logIntegrationProviderEvent,
  translateUpstreamError,
} from '../integration.errors';
import type {
  AccountConnectionProviderClient,
  AccountConnectionProviderIdentity,
} from '../../../core/services/account-connection.service';

const MYANIMELIST_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const MYANIMELIST_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const MYANIMELIST_ME_URL = 'https://api.myanimelist.net/v2/users/@me';
const MYANIMELIST_TIMEOUT_MS = 10_000;
const MYANIMELIST_PKCE_VERIFIER_BYTES = 48;

type MyAnimeListOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type MyAnimeListTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type MyAnimeListUserResponse = {
  id?: number | string;
  name?: string;
  picture?: string;
};

export function isMyAnimeListOAuthConfigured(): boolean {
  const clientId = process.env['MYANIMELIST_CLIENT_ID']?.trim();
  const clientSecret = process.env['MYANIMELIST_CLIENT_SECRET']?.trim();
  const redirectUri = process.env['MYANIMELIST_ACCOUNT_LINK_REDIRECT_URI']?.trim()
    ?? process.env['MYANIMELIST_REDIRECT_URI']?.trim();

  return Boolean(clientId && clientSecret && redirectUri);
}

export function createMyAnimeListCodeVerifier(): string {
  return randomBytes(MYANIMELIST_PKCE_VERIFIER_BYTES).toString('base64url');
}

function assertValidRedirectUri(redirectUri: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redirectUri);
  } catch {
    throw createIntegrationError(
      'myanimelist',
      503,
      'misconfigured',
      'Conexão MyAnimeList indisponível no runtime atual.',
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw createIntegrationError(
      'myanimelist',
      503,
      'misconfigured',
      'Conexão MyAnimeList indisponível no runtime atual.',
    );
  }
}

function resolveMyAnimeListOAuthConfig(redirectUriOverride?: string): MyAnimeListOAuthConfig {
  const clientId = process.env['MYANIMELIST_CLIENT_ID']?.trim();
  const clientSecret = process.env['MYANIMELIST_CLIENT_SECRET']?.trim();
  const redirectUri = redirectUriOverride?.trim()
    || process.env['MYANIMELIST_ACCOUNT_LINK_REDIRECT_URI']?.trim()
    || process.env['MYANIMELIST_REDIRECT_URI']?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    logIntegrationProviderEvent(
      'myanimelist',
      'integration_myanimelist_unavailable',
      'misconfigured',
      'MyAnimeList OAuth config is incomplete in the current runtime.',
    );

    throw createIntegrationError(
      'myanimelist',
      503,
      'misconfigured',
      'Conexão MyAnimeList indisponível no runtime atual.',
    );
  }

  assertValidRedirectUri(redirectUri);

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function buildMyAnimeListAuthorizationUrl(input: {
  state: string;
  redirectUri?: string;
  codeChallenge?: string;
}): string {
  const config = resolveMyAnimeListOAuthConfig(input.redirectUri);

  if (!input.codeChallenge || input.codeChallenge.trim().length === 0) {
    throw createIntegrationError(
      'myanimelist',
      400,
      'invalid_request',
      'Código PKCE MyAnimeList inválido.',
    );
  }

  const authorizationUrl = new URL(MYANIMELIST_AUTHORIZE_URL);

  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('state', input.state);
  // MyAnimeList currently documents only PKCE plain, so the verifier is also the challenge.
  authorizationUrl.searchParams.set('code_challenge', input.codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'plain');

  return authorizationUrl.toString();
}

async function exchangeMyAnimeListCode(input: {
  code: string;
  codeVerifier?: string;
  config: MyAnimeListOAuthConfig;
}): Promise<MyAnimeListTokenResponse> {
  if (!input.codeVerifier || input.codeVerifier.trim().length === 0) {
    throw createIntegrationError(
      'myanimelist',
      400,
      'invalid_request',
      'Verifier PKCE MyAnimeList inválido.',
    );
  }

  try {
    const response = await axios.post<MyAnimeListTokenResponse>(
      MYANIMELIST_TOKEN_URL,
      new URLSearchParams({
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.config.redirectUri,
        code_verifier: input.codeVerifier,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: MYANIMELIST_TIMEOUT_MS,
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
        'myanimelist',
        400,
        'invalid_request',
        'Autorização MyAnimeList inválida ou expirada.',
      );
    }

    throw translateUpstreamError(
      'myanimelist',
      error,
      'Conexão MyAnimeList indisponível no momento.',
      { targetUrl: MYANIMELIST_TOKEN_URL },
    );
  }
}

async function fetchMyAnimeListUser(accessToken: string): Promise<MyAnimeListUserResponse> {
  try {
    const response = await axios.get<MyAnimeListUserResponse>(
      MYANIMELIST_ME_URL,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: MYANIMELIST_TIMEOUT_MS,
      },
    );

    return response.data;
  } catch (error) {
    throw translateUpstreamError(
      'myanimelist',
      error,
      'Conexão MyAnimeList indisponível no momento.',
      { targetUrl: MYANIMELIST_ME_URL },
    );
  }
}

function normalizeMyAnimeListExternalId(value: MyAnimeListUserResponse['id']): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  throw createIntegrationError(
    'myanimelist',
    400,
    'invalid_request',
    'Identidade MyAnimeList inválida.',
  );
}

export const myAnimeListOAuthClient: AccountConnectionProviderClient = {
  provider: 'MYANIMELIST',

  createAuthorizationUrl(input): string {
    return buildMyAnimeListAuthorizationUrl(input);
  },

  async exchangeCodeForIdentity(code, input): Promise<AccountConnectionProviderIdentity> {
    const config = resolveMyAnimeListOAuthConfig(input?.redirectUri);
    const tokenSet = await exchangeMyAnimeListCode({
      code,
      codeVerifier: input?.codeVerifier,
      config,
    });

    if (typeof tokenSet.access_token !== 'string' || tokenSet.access_token.trim().length === 0) {
      throw createIntegrationError(
        'myanimelist',
        400,
        'invalid_request',
        'Token MyAnimeList inválido.',
      );
    }

    const userInfo = await fetchMyAnimeListUser(tokenSet.access_token);
    const externalId = normalizeMyAnimeListExternalId(userInfo.id);
    const displayName = typeof userInfo.name === 'string' && userInfo.name.trim().length > 0
      ? userInfo.name.trim()
      : null;

    return {
      provider: 'MYANIMELIST',
      externalId,
      email: null,
      emailVerified: false,
      displayName,
      username: displayName,
      avatarUrl: typeof userInfo.picture === 'string' && userInfo.picture.trim().length > 0
        ? userInfo.picture.trim()
        : null,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token ?? null,
      metadata: {
        name: displayName,
        picture: typeof userInfo.picture === 'string' ? userInfo.picture : null,
        tokenType: tokenSet.token_type ?? null,
        expiresIn: tokenSet.expires_in ?? null,
        source: 'myanimelist_oauth',
      },
    };
  },
};
