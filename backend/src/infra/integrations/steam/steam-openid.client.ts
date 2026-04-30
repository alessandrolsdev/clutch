import axios from 'axios';
import {
  createIntegrationError,
  IntegrationError,
  translateUpstreamError,
} from '../integration.errors';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_OPENID_NS = 'http://specs.openid.net/auth/2.0';
const STEAM_OPENID_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const STEAM_OPENID_TIMEOUT_MS = 10_000;
const STEAM_OPENID_CLAIMED_ID_PATTERN = /^\/openid\/id\/(\d{17,20})$/u;

export type SteamOpenIdCallbackParams = Record<string, string | undefined>;

export type SteamOpenIdVerificationResult = {
  steamId: string;
};

export type SteamOpenIdClient = {
  createAuthorizationUrl: typeof createSteamOpenIdAuthorizationUrl;
  verifyCallback: typeof verifySteamOpenIdCallback;
};

function getRequiredParam(
  params: SteamOpenIdCallbackParams,
  key: string,
): string {
  const value = params[key]?.trim();

  if (!value) {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }

  return value;
}

function assertSteamOpenIdEndpoint(value: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'steamcommunity.com' ||
    parsedUrl.pathname !== '/openid/login' ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }
}

export function extractSteamIdFromClaimedId(claimedId: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(claimedId);
  } catch {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Identidade Steam inválida.',
    );
  }

  const match = STEAM_OPENID_CLAIMED_ID_PATTERN.exec(parsedUrl.pathname);

  if (
    !match?.[1] ||
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.hostname !== 'steamcommunity.com' ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Identidade Steam inválida.',
    );
  }

  return match[1];
}

function assertExpectedReturnTo(receivedReturnTo: string, expectedReturnTo: string): void {
  if (receivedReturnTo !== expectedReturnTo) {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }
}

function buildVerificationBody(params: SteamOpenIdCallbackParams): string {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith('openid.') || typeof value !== 'string') {
      continue;
    }

    body.set(key, value);
  }

  body.set('openid.mode', 'check_authentication');

  return body.toString();
}

function isValidSteamOpenIdVerificationResponse(payload: unknown): boolean {
  if (typeof payload !== 'string') {
    return false;
  }

  return payload
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .includes('is_valid:true');
}

function validateCallbackShape(
  params: SteamOpenIdCallbackParams,
  expectedReturnTo: string,
): string {
  const mode = getRequiredParam(params, 'openid.mode');

  if (mode === 'cancel') {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Conexão Steam cancelada.',
    );
  }

  if (mode !== 'id_res') {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }

  const namespace = getRequiredParam(params, 'openid.ns');
  const endpoint = getRequiredParam(params, 'openid.op_endpoint');
  const claimedId = getRequiredParam(params, 'openid.claimed_id');
  const identity = getRequiredParam(params, 'openid.identity');
  const returnTo = getRequiredParam(params, 'openid.return_to');
  getRequiredParam(params, 'openid.signed');
  getRequiredParam(params, 'openid.sig');

  if (namespace !== STEAM_OPENID_NS || claimedId !== identity) {
    throw createIntegrationError(
      'steam',
      400,
      'invalid_request',
      'Callback Steam inválido.',
    );
  }

  assertSteamOpenIdEndpoint(endpoint);
  assertExpectedReturnTo(returnTo, expectedReturnTo);

  return extractSteamIdFromClaimedId(claimedId);
}

function createSteamOpenIdAuthorizationUrl(input: {
  returnTo: string;
  realm: string;
}): string {
  const authorizationUrl = new URL(STEAM_OPENID_ENDPOINT);

  authorizationUrl.searchParams.set('openid.ns', STEAM_OPENID_NS);
  authorizationUrl.searchParams.set('openid.mode', 'checkid_setup');
  authorizationUrl.searchParams.set('openid.return_to', input.returnTo);
  authorizationUrl.searchParams.set('openid.realm', input.realm);
  authorizationUrl.searchParams.set('openid.identity', STEAM_OPENID_IDENTIFIER_SELECT);
  authorizationUrl.searchParams.set('openid.claimed_id', STEAM_OPENID_IDENTIFIER_SELECT);

  return authorizationUrl.toString();
}

async function verifySteamOpenIdCallback(
  params: SteamOpenIdCallbackParams,
  options: { expectedReturnTo: string },
): Promise<SteamOpenIdVerificationResult> {
  const steamId = validateCallbackShape(params, options.expectedReturnTo);

  try {
    const response = await axios.post<string>(
      STEAM_OPENID_ENDPOINT,
      buildVerificationBody(params),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: STEAM_OPENID_TIMEOUT_MS,
        responseType: 'text',
      },
    );

    if (!isValidSteamOpenIdVerificationResponse(response.data)) {
      throw createIntegrationError(
        'steam',
        400,
        'invalid_request',
        'Callback Steam inválido.',
      );
    }

    return { steamId };
  } catch (error) {
    if (error instanceof IntegrationError) {
      throw error;
    }

    throw translateUpstreamError(
      'steam',
      error,
      'Steam OpenID indisponível no momento.',
      { targetUrl: STEAM_OPENID_ENDPOINT },
    );
  }
}

export const steamOpenIdClient: SteamOpenIdClient = {
  createAuthorizationUrl: createSteamOpenIdAuthorizationUrl,
  verifyCallback: verifySteamOpenIdCallback,
};
