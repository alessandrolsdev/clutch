/* eslint-disable no-unused-vars */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  Platform,
  PlatformIntegrationConnectionType,
  PlatformIntegrationStatus,
  Prisma,
  User,
} from '@prisma/client';
import { getProviderDefinition, listProviderDefinitions } from '../providers/provider-registry';
import {
  createConnectedAccountRepository,
  type ConnectedAccountRecord,
  type ConnectedAccountRepository,
} from '../repositories/connected-account.repository';
import {
  ConnectedAccountConflictError,
  createConnectedAccountService,
  type ConnectedAccountService,
} from './connected-account.service';
import {
  createInMemorySocialOAuthStateStore,
  type SocialAuthProvider,
  type SocialAuthProviderClient,
  type SocialAuthProviderIdentity,
  type SocialOAuthStateStore,
} from './social-auth.service';
import {
  discordSocialOAuthClient,
  googleSocialOAuthClient,
} from '../../infra/integrations/social/social-oauth.clients';
import {
  steamOpenIdClient,
  type SteamOpenIdCallbackParams,
  type SteamOpenIdClient,
} from '../../infra/integrations/steam/steam-openid.client';
import { userRepository } from '../repositories/user.repository';
import { IntegrationError } from '../../infra/integrations/integration.errors';

const ACCOUNT_CONNECTION_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DEVELOPMENT_STATE_SECRET = 'clutch-account-connection-dev-secret';
const SOCIAL_PLACEHOLDER_EMAIL_DOMAIN = 'users.clutch.local';
const ACCOUNT_CONNECTION_CALLBACK_PATHS: Record<AccountConnectionMode, string> = {
  link: 'link',
  reauth: 'reauth',
};

export type AccountConnectionMode = 'link' | 'reauth';
type BrowserAccountConnectionProvider = SocialAuthProvider | 'STEAM';

export type PublicConnectedAccount = {
  provider: Platform;
  displayName: string;
  externalId: string;
  connectionType: PlatformIntegrationConnectionType;
  status: PlatformIntegrationStatus;
  dataSource: ConnectedAccountRecord['dataSource'];
  publicProfileVisible: boolean;
  connected: boolean;
  needsReauth: boolean;
  experimental: boolean;
  canUnlink: boolean;
  capabilities: string[];
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicConnectedAccountProvider = {
  provider: Platform;
  displayName: string;
  status: PlatformIntegrationStatus;
  dataSource: ConnectedAccountRecord['dataSource'];
  capabilities: string[];
};

export type AccountConnectionStartResult = {
  provider: BrowserAccountConnectionProvider;
  authorizationUrl: string;
};

export type AccountConnectionCallbackResult = {
  provider: BrowserAccountConnectionProvider;
  externalId: string;
  status: PlatformIntegrationStatus;
  connectionType: PlatformIntegrationConnectionType;
  message: string;
};

export type AccountConnectionErrorReason =
  | 'unsupported_provider'
  | 'invalid_request'
  | 'invalid_state'
  | 'provider_unavailable'
  | 'identity_conflict'
  | 'not_connected'
  | 'unsafe_unlink'
  | 'visibility_not_allowed';

export class AccountConnectionError extends Error {
  readonly statusCode: number;
  readonly reason: AccountConnectionErrorReason;
  readonly clientMessage: string;
  readonly provider: Platform | null;

  constructor(input: {
    statusCode: number;
    reason: AccountConnectionErrorReason;
    clientMessage: string;
    provider?: Platform | null;
  }) {
    super(input.clientMessage);
    this.name = 'AccountConnectionError';
    this.statusCode = input.statusCode;
    this.reason = input.reason;
    this.clientMessage = input.clientMessage;
    this.provider = input.provider ?? null;
  }
}

export type AccountConnectionService = {
  listConnectedAccounts(userId: string): Promise<{
    accounts: PublicConnectedAccount[];
    providers: PublicConnectedAccountProvider[];
  }>;
  startLink(input: { userId: string; provider: string }): Promise<AccountConnectionStartResult>;
  completeLink(input: {
    provider: string;
    code?: string;
    state?: string;
    providerError?: string;
    openIdParams?: SteamOpenIdCallbackParams;
  }): Promise<AccountConnectionCallbackResult>;
  unlink(input: { userId: string; provider: string }): Promise<{ message: string; provider: Platform }>;
  updateVisibility(input: {
    userId: string;
    provider: string;
    publicProfileVisible: boolean;
  }): Promise<PublicConnectedAccount>;
  startReauth(input: { userId: string; provider: string }): Promise<AccountConnectionStartResult>;
  completeReauth(input: {
    provider: string;
    code?: string;
    state?: string;
    providerError?: string;
  }): Promise<AccountConnectionCallbackResult>;
};

type AccountConnectionUserGateway = {
  findById(id: string): Promise<User | null>;
};

type AccountConnectionDependencies = {
  providerClients?: Partial<Record<SocialAuthProvider, SocialAuthProviderClient>>;
  steamClient?: SteamOpenIdClient;
  users?: AccountConnectionUserGateway;
  repository?: Pick<
    ConnectedAccountRepository,
    | 'listByUser'
    | 'findByProviderExternalId'
    | 'findByUserProvider'
    | 'deleteByUserProvider'
    | 'updateVisibility'
  >;
  connectedAccountService?: Pick<ConnectedAccountService, 'connectExternalIdentity'>;
  stateStore?: SocialOAuthStateStore;
};

type AccountConnectionStatePayload = {
  purpose: 'account_connection';
  mode: AccountConnectionMode;
  provider: BrowserAccountConnectionProvider;
  userId: string;
  expectedExternalId?: string;
  nonce: string;
  issuedAt: number;
};

function createAccountConnectionError(input: {
  statusCode: number;
  reason: AccountConnectionErrorReason;
  clientMessage: string;
  provider?: Platform | null;
}): AccountConnectionError {
  return new AccountConnectionError(input);
}

function resolveStateSecret(): string {
  const configuredSecret = process.env['ACCOUNT_CONNECTION_STATE_SECRET']?.trim()
    ?? process.env['SOCIAL_OAUTH_STATE_SECRET']?.trim()
    ?? process.env['JWT_SECRET']?.trim();

  if (configuredSecret && configuredSecret.length > 0) {
    return configuredSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw createAccountConnectionError({
      statusCode: 503,
      reason: 'provider_unavailable',
      clientMessage: 'Conexões de conta indisponíveis no runtime atual.',
    });
  }

  return DEFAULT_DEVELOPMENT_STATE_SECRET;
}

function signState(encodedPayload: string): string {
  return createHmac('sha256', resolveStateSecret()).update(encodedPayload).digest('base64url');
}

function encodeStatePayload(payload: AccountConnectionStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function isSocialOAuthProvider(value: unknown): value is SocialAuthProvider {
  return value === 'GOOGLE' || value === 'DISCORD';
}

function isBrowserAccountConnectionProvider(value: unknown): value is BrowserAccountConnectionProvider {
  return isSocialOAuthProvider(value) || value === 'STEAM';
}

function decodeStatePayload(value: string): AccountConnectionStatePayload {
  let parsedPayload: Partial<AccountConnectionStatePayload>;

  try {
    parsedPayload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<AccountConnectionStatePayload>;
  } catch {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido.',
    });
  }

  if (
    parsedPayload.purpose !== 'account_connection' ||
    (parsedPayload.mode !== 'link' && parsedPayload.mode !== 'reauth') ||
    !isBrowserAccountConnectionProvider(parsedPayload.provider) ||
    typeof parsedPayload.userId !== 'string' ||
    parsedPayload.userId.length === 0 ||
    typeof parsedPayload.nonce !== 'string' ||
    parsedPayload.nonce.length === 0 ||
    typeof parsedPayload.issuedAt !== 'number' ||
    !Number.isFinite(parsedPayload.issuedAt)
  ) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido.',
    });
  }

  return {
    purpose: 'account_connection',
    mode: parsedPayload.mode,
    provider: parsedPayload.provider,
    userId: parsedPayload.userId,
    expectedExternalId: parsedPayload.expectedExternalId,
    nonce: parsedPayload.nonce,
    issuedAt: parsedPayload.issuedAt,
  };
}

function createConnectionState(input: {
  provider: BrowserAccountConnectionProvider;
  userId: string;
  mode: AccountConnectionMode;
  expectedExternalId?: string;
}): { state: string; nonce: string } {
  const nonce = randomUUID();
  const encodedPayload = encodeStatePayload({
    purpose: 'account_connection',
    mode: input.mode,
    provider: input.provider,
    userId: input.userId,
    expectedExternalId: input.expectedExternalId,
    nonce,
    issuedAt: Date.now(),
  });

  return {
    nonce,
    state: `${encodedPayload}.${signState(encodedPayload)}`,
  };
}

function verifyStateValue(
  state: string,
  provider: BrowserAccountConnectionProvider,
  mode: AccountConnectionMode,
): AccountConnectionStatePayload {
  const segments = state.split('.');

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido.',
      provider,
    });
  }

  const [encodedPayload, receivedSignature] = segments;
  const expectedSignature = signState(encodedPayload);
  const receivedBuffer = Buffer.from(receivedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido.',
      provider,
    });
  }

  const payload = decodeStatePayload(encodedPayload);

  if (
    payload.provider !== provider ||
    payload.mode !== mode ||
    Date.now() - payload.issuedAt > ACCOUNT_CONNECTION_STATE_TTL_MS
  ) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback de conexão inválido ou expirado.',
      provider,
    });
  }

  return payload;
}

function normalizePlatform(provider: string): Platform {
  const normalizedProvider = provider.trim().toUpperCase();
  const knownProvider = listProviderDefinitions().find(
    (definition) => definition.provider === normalizedProvider,
  );

  if (!knownProvider) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'unsupported_provider',
      clientMessage: 'Provider de conta não suportado.',
    });
  }

  return knownProvider.provider;
}

function normalizeOAuthProvider(provider: string): SocialAuthProvider {
  const normalizedProvider = normalizePlatform(provider);
  const definition = getProviderDefinition(normalizedProvider);

  if (
    !isSocialOAuthProvider(normalizedProvider) ||
    definition.status === 'UNAVAILABLE' ||
    !definition.capabilities.includes('OAUTH_CONNECT')
  ) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'unsupported_provider',
      clientMessage: 'Provider não suporta conexão OAuth neste momento.',
      provider: normalizedProvider,
    });
  }

  return normalizedProvider;
}

function normalizeSteamOpenIdProvider(provider: string): 'STEAM' {
  const normalizedProvider = normalizePlatform(provider);
  const definition = getProviderDefinition(normalizedProvider);

  if (
    normalizedProvider !== 'STEAM' ||
    definition.status === 'UNAVAILABLE' ||
    !definition.capabilities.includes('OPENID_CONNECT')
  ) {
    throw createAccountConnectionError({
      statusCode: 400,
      reason: 'unsupported_provider',
      clientMessage: 'Provider não suporta conexão OpenID neste momento.',
      provider: normalizedProvider,
    });
  }

  return 'STEAM';
}

function assertSafePublicUrl(value: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw createAccountConnectionError({
      statusCode: 503,
      reason: 'provider_unavailable',
      clientMessage: 'Conexão Steam indisponível no runtime atual.',
      provider: 'STEAM',
    });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw createAccountConnectionError({
      statusCode: 503,
      reason: 'provider_unavailable',
      clientMessage: 'Conexão Steam indisponível no runtime atual.',
      provider: 'STEAM',
    });
  }

  return parsedUrl;
}

function resolveSteamOpenIdBaseReturnUrl(): string {
  const explicitReturnUrl = process.env['STEAM_OPENID_RETURN_URL']?.trim();

  if (explicitReturnUrl) {
    return assertSafePublicUrl(explicitReturnUrl).toString();
  }

  const publicAppUrl = process.env['PUBLIC_APP_URL']?.trim()
    ?? process.env['APP_PUBLIC_URL']?.trim()
    ?? process.env['FRONTEND_PUBLIC_URL']?.trim()
    ?? process.env['NEXT_PUBLIC_APP_URL']?.trim();

  if (publicAppUrl) {
    return assertSafePublicUrl(new URL('/api/auth/accounts/steam/link/callback', publicAppUrl).toString()).toString();
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw createAccountConnectionError({
      statusCode: 503,
      reason: 'provider_unavailable',
      clientMessage: 'Conexão Steam indisponível no runtime atual.',
      provider: 'STEAM',
    });
  }

  return 'http://localhost/api/auth/accounts/steam/link/callback';
}

function resolveSteamOpenIdReturnTo(state: string): string {
  const returnUrl = assertSafePublicUrl(resolveSteamOpenIdBaseReturnUrl());
  returnUrl.searchParams.set('state', state);

  return returnUrl.toString();
}

function resolveSteamOpenIdRealm(returnTo: string): string {
  const explicitRealm = process.env['STEAM_OPENID_REALM']?.trim();

  if (explicitRealm) {
    return assertSafePublicUrl(explicitRealm).origin;
  }

  return assertSafePublicUrl(returnTo).origin;
}

function getDefaultSocialRedirectUri(provider: SocialAuthProvider): string | undefined {
  if (provider === 'GOOGLE') {
    return process.env['GOOGLE_REDIRECT_URI']?.trim();
  }

  return process.env['DISCORD_SOCIAL_REDIRECT_URI']?.trim();
}

function getExplicitAccountConnectionRedirectUri(
  provider: SocialAuthProvider,
  mode: AccountConnectionMode,
): string | undefined {
  return process.env[`${provider}_ACCOUNT_${mode.toUpperCase()}_REDIRECT_URI`]?.trim();
}

function deriveAccountConnectionRedirectUri(
  provider: SocialAuthProvider,
  mode: AccountConnectionMode,
): string | undefined {
  const defaultRedirectUri = getDefaultSocialRedirectUri(provider);

  if (!defaultRedirectUri) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(defaultRedirectUri);
    const providerSlug = provider.toLowerCase();
    const callbackMode = ACCOUNT_CONNECTION_CALLBACK_PATHS[mode];
    const nextPathname = parsedUrl.pathname.replace(
      `/auth/social/${providerSlug}/callback`,
      `/auth/accounts/${providerSlug}/${callbackMode}/callback`,
    );

    if (nextPathname === parsedUrl.pathname) {
      return undefined;
    }

    parsedUrl.pathname = nextPathname;

    return parsedUrl.toString();
  } catch {
    return undefined;
  }
}

function resolveAccountConnectionRedirectUri(
  provider: SocialAuthProvider,
  mode: AccountConnectionMode,
): string | undefined {
  return getExplicitAccountConnectionRedirectUri(provider, mode)
    ?? deriveAccountConnectionRedirectUri(provider, mode);
}

function toPublicAccount(account: ConnectedAccountRecord, canUnlink: boolean): PublicConnectedAccount {
  const definition = getProviderDefinition(account.provider);

  return {
    provider: account.provider,
    displayName: definition.displayName,
    externalId: account.externalId,
    connectionType: account.connectionType,
    status: account.status,
    dataSource: account.dataSource,
    publicProfileVisible: account.publicProfileVisible,
    connected: account.status === 'CONNECTED',
    needsReauth: account.status === 'NEEDS_REAUTH',
    experimental: account.status === 'UNAVAILABLE' || account.dataSource === 'EXPERIMENTAL',
    canUnlink,
    capabilities: definition.capabilities,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function listPublicProviders(accounts: ConnectedAccountRecord[]): PublicConnectedAccountProvider[] {
  const accountProviders = new Set(accounts.map((account) => account.provider));

  return listProviderDefinitions()
    .filter((definition) =>
      definition.visibleInConnectionCenter === true ||
      definition.status !== 'UNAVAILABLE' ||
      accountProviders.has(definition.provider))
    .map((definition) => ({
      provider: definition.provider,
      displayName: definition.displayName,
      status: definition.status,
      dataSource: definition.dataSource,
      capabilities: definition.capabilities,
    }));
}

function hasViablePasswordLogin(user: User): boolean {
  return !user.email.toLowerCase().endsWith(`@${SOCIAL_PLACEHOLDER_EMAIL_DOMAIN}`);
}

function canUnlinkAccount(input: {
  account: ConnectedAccountRecord;
  accounts: ConnectedAccountRecord[];
  user: User | null;
}): boolean {
  if (input.account.status === 'UNAVAILABLE') {
    return false;
  }

  if (input.account.connectionType !== 'SOCIAL_LOGIN') {
    return true;
  }

  if (input.user && hasViablePasswordLogin(input.user)) {
    return true;
  }

  return input.accounts.some(
    (candidate) => candidate.connectionType === 'SOCIAL_LOGIN' &&
      candidate.provider !== input.account.provider &&
      candidate.status === 'CONNECTED',
  );
}

function canPublishAccount(account: ConnectedAccountRecord): boolean {
  return account.status === 'CONNECTED' && account.dataSource === 'OFFICIAL';
}

function mapProviderFailure(error: unknown, provider: BrowserAccountConnectionProvider): never {
  if (error instanceof AccountConnectionError) {
    throw error;
  }

  if (error instanceof IntegrationError) {
    throw createAccountConnectionError({
      statusCode: error.statusCode,
      reason: error.reason === 'invalid_request' ? 'invalid_request' : 'provider_unavailable',
      clientMessage: error.clientMessage,
      provider,
    });
  }

  throw createAccountConnectionError({
    statusCode: 503,
    reason: 'provider_unavailable',
    clientMessage: 'Provider indisponível no momento.',
    provider,
  });
}

function buildIdentityMetadata(identity: SocialAuthProviderIdentity): Prisma.InputJsonObject {
  return {
    ...identity.metadata,
    email: identity.email,
    emailVerified: identity.emailVerified,
    displayName: identity.displayName,
    username: identity.username,
    avatarUrl: identity.avatarUrl,
    source: 'account_connection',
  };
}

export function createAccountConnectionService(
  dependencies: AccountConnectionDependencies = {},
): AccountConnectionService {
  const users = dependencies.users ?? userRepository;
  const repository = dependencies.repository ?? createConnectedAccountRepository();
  const connectedAccountService = dependencies.connectedAccountService ?? createConnectedAccountService();
  const stateStore = dependencies.stateStore ?? createInMemorySocialOAuthStateStore();
  const providerClients = {
    GOOGLE: dependencies.providerClients?.GOOGLE ?? googleSocialOAuthClient,
    DISCORD: dependencies.providerClients?.DISCORD ?? discordSocialOAuthClient,
  };
  const steamClient = dependencies.steamClient ?? steamOpenIdClient;

  async function exchangeIdentity(
    provider: SocialAuthProvider,
    code: string,
    redirectUri?: string,
  ): Promise<SocialAuthProviderIdentity> {
    try {
      const identity = await providerClients[provider].exchangeCodeForIdentity(code, { redirectUri });

      if (identity.provider !== provider) {
        throw createAccountConnectionError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Identidade externa inválida.',
          provider,
        });
      }

      return identity;
    } catch (error) {
      mapProviderFailure(error, provider);
    }
  }

  async function assertCanRemoveAccount(
    userId: string,
    account: ConnectedAccountRecord,
  ): Promise<void> {
    if (account.connectionType !== 'SOCIAL_LOGIN') {
      return;
    }

    const user = await users.findById(userId);

    if (!user) {
      throw createAccountConnectionError({
        statusCode: 404,
        reason: 'not_connected',
        clientMessage: 'Usuário não encontrado.',
        provider: account.provider,
      });
    }

    if (hasViablePasswordLogin(user)) {
      return;
    }

    const accounts = await repository.listByUser(userId);
    const remainingSocialLoginCount = accounts.filter(
      (candidate) => candidate.connectionType === 'SOCIAL_LOGIN' &&
        candidate.provider !== account.provider &&
        candidate.status === 'CONNECTED',
    ).length;

    if (remainingSocialLoginCount === 0) {
      throw createAccountConnectionError({
        statusCode: 409,
        reason: 'unsafe_unlink',
        clientMessage: 'Não é possível remover o último método de login da conta.',
        provider: account.provider,
      });
    }
  }

  async function startOAuthFlow(input: {
    userId: string;
    provider: string;
    mode: AccountConnectionMode;
    expectedExternalId?: string;
  }): Promise<AccountConnectionStartResult> {
    const provider = normalizeOAuthProvider(input.provider);
    const { state, nonce } = createConnectionState({
      userId: input.userId,
      provider,
      mode: input.mode,
      expectedExternalId: input.expectedExternalId,
    });
    const authorizationUrl = providerClients[provider].createAuthorizationUrl({
      state,
      nonce,
      redirectUri: resolveAccountConnectionRedirectUri(provider, input.mode),
    });

    await stateStore.store(state, ACCOUNT_CONNECTION_STATE_TTL_MS);

    return {
      provider,
      authorizationUrl,
    };
  }

  async function startSteamOpenIdFlow(input: {
    userId: string;
    provider: string;
  }): Promise<AccountConnectionStartResult> {
    const provider = normalizeSteamOpenIdProvider(input.provider);
    const { state } = createConnectionState({
      userId: input.userId,
      provider,
      mode: 'link',
    });
    const returnTo = resolveSteamOpenIdReturnTo(state);
    const authorizationUrl = steamClient.createAuthorizationUrl({
      returnTo,
      realm: resolveSteamOpenIdRealm(returnTo),
    });

    await stateStore.store(state, ACCOUNT_CONNECTION_STATE_TTL_MS);

    return {
      provider,
      authorizationUrl,
    };
  }

  async function completeOAuthCallback(input: {
    provider: string;
    code?: string;
    state?: string;
    providerError?: string;
    mode: AccountConnectionMode;
  }): Promise<{ provider: SocialAuthProvider; identity: SocialAuthProviderIdentity; statePayload: AccountConnectionStatePayload }> {
    const provider = normalizeOAuthProvider(input.provider);

    if (input.providerError) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_request',
        clientMessage: 'Conexão cancelada ou negada pelo provider.',
        provider,
      });
    }

    if (!input.code || !input.state) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_request',
        clientMessage: 'Callback de conexão inválido.',
        provider,
      });
    }

    const statePayload = verifyStateValue(input.state, provider, input.mode);

    if (!await stateStore.consume(input.state)) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_state',
        clientMessage: 'Callback de conexão inválido ou expirado.',
        provider,
      });
    }

    return {
      provider,
      identity: await exchangeIdentity(
        provider,
        input.code,
        resolveAccountConnectionRedirectUri(provider, input.mode),
      ),
      statePayload,
    };
  }

  async function completeSteamOpenIdCallback(input: {
    provider: string;
    state?: string;
    providerError?: string;
    openIdParams?: SteamOpenIdCallbackParams;
  }): Promise<{ provider: 'STEAM'; externalId: string; statePayload: AccountConnectionStatePayload }> {
    const provider = normalizeSteamOpenIdProvider(input.provider);

    if (input.providerError) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_request',
        clientMessage: 'Conexão Steam cancelada ou negada.',
        provider,
      });
    }

    if (!input.state) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_request',
        clientMessage: 'Callback Steam inválido.',
        provider,
      });
    }

    const statePayload = verifyStateValue(input.state, provider, 'link');

    if (!await stateStore.consume(input.state)) {
      throw createAccountConnectionError({
        statusCode: 400,
        reason: 'invalid_state',
        clientMessage: 'Callback Steam inválido ou expirado.',
        provider,
      });
    }

    try {
      const verification = await steamClient.verifyCallback(
        input.openIdParams ?? {},
        { expectedReturnTo: resolveSteamOpenIdReturnTo(input.state) },
      );

      return {
        provider,
        externalId: verification.steamId,
        statePayload,
      };
    } catch (error) {
      mapProviderFailure(error, provider);
    }
  }

  return {
    async listConnectedAccounts(userId): Promise<{
      accounts: PublicConnectedAccount[];
      providers: PublicConnectedAccountProvider[];
    }> {
      const accounts = await repository.listByUser(userId);
      const user = await users.findById(userId);

      return {
        providers: listPublicProviders(accounts),
        accounts: accounts.map((account) => toPublicAccount(account, canUnlinkAccount({
          account,
          accounts,
          user,
        }))),
      };
    },

    async startLink(input): Promise<AccountConnectionStartResult> {
      if (normalizePlatform(input.provider) === 'STEAM') {
        return startSteamOpenIdFlow(input);
      }

      return startOAuthFlow({
        userId: input.userId,
        provider: input.provider,
        mode: 'link',
      });
    },

    async completeLink(input): Promise<AccountConnectionCallbackResult> {
      if (normalizePlatform(input.provider) === 'STEAM') {
        const { provider, externalId, statePayload } = await completeSteamOpenIdCallback(input);
        const existingIdentity = await repository.findByProviderExternalId(provider, externalId);

        if (existingIdentity && existingIdentity.userId !== statePayload.userId) {
          throw createAccountConnectionError({
            statusCode: 409,
            reason: 'identity_conflict',
            clientMessage: 'Esta identidade externa já está vinculada a outro usuário.',
            provider,
          });
        }

        const existingUserProvider = await repository.findByUserProvider(statePayload.userId, provider);

        if (existingUserProvider && existingUserProvider.externalId !== externalId) {
          throw createAccountConnectionError({
            statusCode: 409,
            reason: 'identity_conflict',
            clientMessage: 'Este usuário já possui outra identidade Steam vinculada.',
            provider,
          });
        }

        try {
          await connectedAccountService.connectExternalIdentity({
            userId: statePayload.userId,
            provider,
            externalId,
            connectionType: 'CONNECTED_ACCOUNT',
            status: 'CONNECTED',
            dataSource: getProviderDefinition(provider).dataSource,
            metadata: {
              source: 'steam_openid',
              ownershipProof: 'openid',
              ownershipVerifiedAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          if (error instanceof ConnectedAccountConflictError) {
            throw createAccountConnectionError({
              statusCode: 409,
              reason: 'identity_conflict',
              clientMessage: 'Esta identidade externa já está vinculada a outro usuário.',
              provider,
            });
          }

          throw error;
        }

        return {
          provider,
          externalId,
          status: 'CONNECTED',
          connectionType: 'CONNECTED_ACCOUNT',
          message: 'Steam verificada e conectada com sucesso.',
        };
      }

      const { provider, identity, statePayload } = await completeOAuthCallback({
        ...input,
        mode: 'link',
      });
      const existingIdentity = await repository.findByProviderExternalId(provider, identity.externalId);

      if (existingIdentity && existingIdentity.userId !== statePayload.userId) {
        throw createAccountConnectionError({
          statusCode: 409,
          reason: 'identity_conflict',
          clientMessage: 'Esta identidade externa já está vinculada a outro usuário.',
          provider,
        });
      }

      const existingUserProvider = await repository.findByUserProvider(statePayload.userId, provider);

      if (existingUserProvider && existingUserProvider.externalId !== identity.externalId) {
        throw createAccountConnectionError({
          statusCode: 409,
          reason: 'identity_conflict',
          clientMessage: 'Este usuário já possui outra identidade vinculada para este provider.',
          provider,
        });
      }

      try {
        await connectedAccountService.connectExternalIdentity({
          userId: statePayload.userId,
          provider,
          externalId: identity.externalId,
          connectionType: 'SOCIAL_LOGIN',
          status: 'CONNECTED',
          dataSource: getProviderDefinition(provider).dataSource,
          accessToken: identity.accessToken,
          refreshToken: identity.refreshToken,
          metadata: buildIdentityMetadata(identity),
          lastSyncAt: new Date(),
        });
      } catch (error) {
        if (error instanceof ConnectedAccountConflictError) {
          throw createAccountConnectionError({
            statusCode: 409,
            reason: 'identity_conflict',
            clientMessage: 'Esta identidade externa já está vinculada a outro usuário.',
            provider,
          });
        }

        throw error;
      }

      return {
        provider,
        externalId: identity.externalId,
        status: 'CONNECTED',
        connectionType: 'SOCIAL_LOGIN',
        message: `${getProviderDefinition(provider).displayName} vinculado com sucesso.`,
      };
    },

    async unlink(input): Promise<{ message: string; provider: Platform }> {
      const provider = normalizePlatform(input.provider);
      const account = await repository.findByUserProvider(input.userId, provider);

      if (!account) {
        throw createAccountConnectionError({
          statusCode: 404,
          reason: 'not_connected',
          clientMessage: 'Conta externa não encontrada.',
          provider,
        });
      }

      await assertCanRemoveAccount(input.userId, account);
      await repository.deleteByUserProvider(input.userId, provider);

      return {
        provider,
        message: `${getProviderDefinition(provider).displayName} desconectado com sucesso.`,
      };
    },

    async updateVisibility(input): Promise<PublicConnectedAccount> {
      const provider = normalizePlatform(input.provider);
      const account = await repository.findByUserProvider(input.userId, provider);

      if (!account) {
        throw createAccountConnectionError({
          statusCode: 404,
          reason: 'not_connected',
          clientMessage: 'Conta externa não encontrada.',
          provider,
        });
      }

      if (input.publicProfileVisible && !canPublishAccount(account)) {
        throw createAccountConnectionError({
          statusCode: 409,
          reason: 'visibility_not_allowed',
          clientMessage: 'Apenas contas ativas e oficiais podem aparecer publicamente.',
          provider,
        });
      }

      const updatedAccount = await repository.updateVisibility({
        userId: input.userId,
        provider,
        publicProfileVisible: input.publicProfileVisible,
      });

      if (!updatedAccount) {
        throw createAccountConnectionError({
          statusCode: 404,
          reason: 'not_connected',
          clientMessage: 'Conta externa não encontrada.',
          provider,
        });
      }

      const accounts = await repository.listByUser(input.userId);
      const user = await users.findById(input.userId);

      return toPublicAccount(updatedAccount, canUnlinkAccount({
        account: updatedAccount,
        accounts,
        user,
      }));
    },

    async startReauth(input): Promise<AccountConnectionStartResult> {
      const provider = normalizeOAuthProvider(input.provider);
      const account = await repository.findByUserProvider(input.userId, provider);

      if (!account) {
        throw createAccountConnectionError({
          statusCode: 404,
          reason: 'not_connected',
          clientMessage: 'Conta externa não encontrada.',
          provider,
        });
      }

      if (account.status !== 'NEEDS_REAUTH') {
        throw createAccountConnectionError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Esta conta não precisa de reconexão.',
          provider,
        });
      }

      return startOAuthFlow({
        userId: input.userId,
        provider,
        mode: 'reauth',
        expectedExternalId: account.externalId,
      });
    },

    async completeReauth(input): Promise<AccountConnectionCallbackResult> {
      const { provider, identity, statePayload } = await completeOAuthCallback({
        ...input,
        mode: 'reauth',
      });
      const expectedExternalId = statePayload.expectedExternalId;

      if (!expectedExternalId || identity.externalId !== expectedExternalId) {
        throw createAccountConnectionError({
          statusCode: 409,
          reason: 'identity_conflict',
          clientMessage: 'A identidade retornada pelo provider não corresponde à conta original.',
          provider,
        });
      }

      const account = await repository.findByUserProvider(statePayload.userId, provider);

      if (!account || account.externalId !== expectedExternalId) {
        throw createAccountConnectionError({
          statusCode: account ? 409 : 404,
          reason: account ? 'identity_conflict' : 'not_connected',
          clientMessage: account
            ? 'A conta original mudou desde o início da reconexão.'
            : 'Conta externa não encontrada.',
          provider,
        });
      }

      if (account.status !== 'NEEDS_REAUTH') {
        throw createAccountConnectionError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Esta conta não precisa de reconexão.',
          provider,
        });
      }

      await connectedAccountService.connectExternalIdentity({
        userId: statePayload.userId,
        provider,
        externalId: identity.externalId,
        connectionType: account.connectionType,
        status: 'CONNECTED',
        dataSource: account.dataSource,
        accessToken: identity.accessToken,
        refreshToken: identity.refreshToken,
        metadata: buildIdentityMetadata(identity),
        lastSyncAt: new Date(),
      });

      return {
        provider,
        externalId: identity.externalId,
        status: 'CONNECTED',
        connectionType: account.connectionType,
        message: `${getProviderDefinition(provider).displayName} reconectado com sucesso.`,
      };
    },
  };
}
