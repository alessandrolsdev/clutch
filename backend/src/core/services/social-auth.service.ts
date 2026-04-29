/* eslint-disable no-unused-vars */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Platform, Prisma, User } from '@prisma/client';
import { getProviderDefinition } from '../providers/provider-registry';
import {
  ConnectedAccountConflictError,
  createConnectedAccountService,
  type ConnectedAccountService,
} from './connected-account.service';
import {
  createConnectedAccountRepository,
  type ConnectedAccountRepository,
} from '../repositories/connected-account.repository';
import { userRepository, type CreateUserInput } from '../repositories/user.repository';
import {
  discordSocialOAuthClient,
  googleSocialOAuthClient,
} from '../../infra/integrations/social/social-oauth.clients';
import { IntegrationError } from '../../infra/integrations/integration.errors';

const SOCIAL_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DEVELOPMENT_STATE_SECRET = 'clutch-social-oauth-dev-secret';
const SOCIAL_PLACEHOLDER_EMAIL_DOMAIN = 'users.clutch.local';
const USERNAME_MAX_LENGTH = 30;
const USERNAME_SUFFIX_LENGTH = 6;
const SOCIAL_PASSWORD_SALT_ROUNDS = 12;

export type SocialAuthProvider = 'GOOGLE' | 'DISCORD';

export type SocialAuthStartResult = {
  provider: SocialAuthProvider;
  authorizationUrl: string;
};

export type SocialAuthCallbackResult = {
  provider: SocialAuthProvider;
  user: Pick<User, 'id' | 'username'>;
  isNewUser: boolean;
};

export type SocialAuthProviderIdentity = {
  provider: SocialAuthProvider;
  externalId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  metadata: Prisma.InputJsonObject;
};

export type SocialAuthProviderClient = {
  provider: SocialAuthProvider;
  createAuthorizationUrl(input: { state: string; nonce: string }): string;
  exchangeCodeForIdentity(code: string): Promise<SocialAuthProviderIdentity>;
};

export type SocialAuthService = {
  startLogin(provider: string): Promise<SocialAuthStartResult>;
  completeCallback(input: {
    provider: string;
    code?: string;
    state?: string;
    providerError?: string;
    requestId?: string;
  }): Promise<SocialAuthCallbackResult>;
};

export type SocialAuthErrorReason =
  | 'unsupported_provider'
  | 'invalid_request'
  | 'invalid_state'
  | 'provider_unavailable'
  | 'identity_conflict';

export class SocialAuthError extends Error {
  readonly statusCode: number;
  readonly reason: SocialAuthErrorReason;
  readonly clientMessage: string;
  readonly provider: SocialAuthProvider | null;

  constructor(input: {
    statusCode: number;
    reason: SocialAuthErrorReason;
    clientMessage: string;
    provider?: SocialAuthProvider | null;
  }) {
    super(input.clientMessage);
    this.name = 'SocialAuthError';
    this.statusCode = input.statusCode;
    this.reason = input.reason;
    this.clientMessage = input.clientMessage;
    this.provider = input.provider ?? null;
  }
}

type SocialStatePayload = {
  purpose: 'social_login';
  provider: SocialAuthProvider;
  nonce: string;
  issuedAt: number;
};

type SocialAuthUserGateway = {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
};

type SocialAuthDependencies = {
  providerClients?: Partial<Record<SocialAuthProvider, SocialAuthProviderClient>>;
  users?: SocialAuthUserGateway;
  connectedAccounts?: Pick<
    ConnectedAccountRepository,
    'findByProviderExternalId' | 'findByUserProvider'
  >;
  connectedAccountService?: Pick<ConnectedAccountService, 'connectExternalIdentity'>;
  hashPassword?: (rawPassword: string) => Promise<string>;
};

function createSocialAuthError(input: {
  statusCode: number;
  reason: SocialAuthErrorReason;
  clientMessage: string;
  provider?: SocialAuthProvider | null;
}): SocialAuthError {
  return new SocialAuthError(input);
}

function resolveStateSecret(): string {
  const configuredSecret = process.env['SOCIAL_OAUTH_STATE_SECRET']?.trim()
    ?? process.env['JWT_SECRET']?.trim();

  if (configuredSecret && configuredSecret.length > 0) {
    return configuredSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw createSocialAuthError({
      statusCode: 503,
      reason: 'provider_unavailable',
      clientMessage: 'Login social indisponível no runtime atual.',
    });
  }

  return DEFAULT_DEVELOPMENT_STATE_SECRET;
}

function signState(encodedPayload: string): string {
  return createHmac('sha256', resolveStateSecret()).update(encodedPayload).digest('base64url');
}

function encodeStatePayload(payload: SocialStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeStatePayload(value: string): SocialStatePayload {
  let parsedPayload: Partial<SocialStatePayload>;

  try {
    parsedPayload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SocialStatePayload>;
  } catch {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback social inválido.',
    });
  }

  if (
    parsedPayload.purpose !== 'social_login' ||
    !isSocialAuthProvider(parsedPayload.provider) ||
    typeof parsedPayload.nonce !== 'string' ||
    parsedPayload.nonce.length === 0 ||
    typeof parsedPayload.issuedAt !== 'number' ||
    !Number.isFinite(parsedPayload.issuedAt)
  ) {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback social inválido.',
    });
  }

  return {
    purpose: 'social_login',
    provider: parsedPayload.provider,
    nonce: parsedPayload.nonce,
    issuedAt: parsedPayload.issuedAt,
  };
}

function verifyStateValue(state: string, provider: SocialAuthProvider): SocialStatePayload {
  const segments = state.split('.');

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback social inválido.',
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
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback social inválido.',
      provider,
    });
  }

  const payload = decodeStatePayload(encodedPayload);

  if (payload.provider !== provider || Date.now() - payload.issuedAt > SOCIAL_STATE_TTL_MS) {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'invalid_state',
      clientMessage: 'Callback social inválido ou expirado.',
      provider,
    });
  }

  return payload;
}

export function createSocialOAuthState(provider: SocialAuthProvider): { state: string; nonce: string } {
  const nonce = randomUUID();
  const encodedPayload = encodeStatePayload({
    purpose: 'social_login',
    provider,
    nonce,
    issuedAt: Date.now(),
  });

  return {
    nonce,
    state: `${encodedPayload}.${signState(encodedPayload)}`,
  };
}

function isSocialAuthProvider(value: unknown): value is SocialAuthProvider {
  return value === 'GOOGLE' || value === 'DISCORD';
}

function normalizeSocialAuthProvider(provider: string): SocialAuthProvider {
  const normalizedProvider = provider.trim().toUpperCase();

  if (!isSocialAuthProvider(normalizedProvider)) {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'unsupported_provider',
      clientMessage: 'Provider social não suportado.',
    });
  }

  const providerDefinition = getProviderDefinition(normalizedProvider as Platform);

  if (
    providerDefinition.status === 'UNAVAILABLE' ||
    !providerDefinition.capabilities.includes('SOCIAL_LOGIN')
  ) {
    throw createSocialAuthError({
      statusCode: 400,
      reason: 'unsupported_provider',
      clientMessage: 'Provider social não suportado.',
      provider: normalizedProvider,
    });
  }

  return normalizedProvider;
}

function normalizeVerifiedEmail(identity: SocialAuthProviderIdentity): string | null {
  if (!identity.emailVerified || !identity.email) {
    return null;
  }

  return identity.email.trim().toLowerCase();
}

function buildPlaceholderEmail(provider: SocialAuthProvider, externalId: string): string {
  const safeExternalId = externalId.toLowerCase().replace(/[^a-z0-9_-]+/gu, '-');
  return `social+${provider.toLowerCase()}-${safeExternalId}@${SOCIAL_PLACEHOLDER_EMAIL_DOMAIN}`;
}

function sanitizeUsernameSeed(value: string | null): string {
  const sanitized = (value ?? 'player')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();

  if (sanitized.length >= 3) {
    return sanitized.slice(0, USERNAME_MAX_LENGTH);
  }

  return 'player';
}

async function buildAvailableUsername(
  identity: SocialAuthProviderIdentity,
  users: SocialAuthUserGateway,
): Promise<string> {
  const emailLocalPart = identity.email?.split('@')[0] ?? null;
  const base = sanitizeUsernameSeed(identity.username ?? identity.displayName ?? emailLocalPart);
  const existingBaseUser = await users.findByUsername(base);

  if (!existingBaseUser) {
    return base;
  }

  const suffix = createHmac('sha256', resolveStateSecret())
    .update(`${identity.provider}:${identity.externalId}`)
    .digest('hex')
    .slice(0, USERNAME_SUFFIX_LENGTH);
  const truncatedBase = base.slice(0, USERNAME_MAX_LENGTH - USERNAME_SUFFIX_LENGTH - 1);
  const candidate = `${truncatedBase}_${suffix}`;
  const existingCandidateUser = await users.findByUsername(candidate);

  if (!existingCandidateUser) {
    return candidate;
  }

  return `player_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
}

function mapProviderFailure(error: unknown, provider: SocialAuthProvider): never {
  if (error instanceof SocialAuthError) {
    throw error;
  }

  if (error instanceof IntegrationError) {
    throw createSocialAuthError({
      statusCode: error.statusCode,
      reason: error.reason === 'invalid_request' ? 'invalid_request' : 'provider_unavailable',
      clientMessage: error.clientMessage,
      provider,
    });
  }

  throw createSocialAuthError({
    statusCode: 503,
    reason: 'provider_unavailable',
    clientMessage: `Login ${provider === 'GOOGLE' ? 'Google' : 'Discord'} indisponível no momento.`,
    provider,
  });
}

export function createSocialAuthService(
  dependencies: SocialAuthDependencies = {},
): SocialAuthService {
  const users = dependencies.users ?? userRepository;
  const connectedAccounts = dependencies.connectedAccounts ?? createConnectedAccountRepository();
  const connectedAccountService = dependencies.connectedAccountService ?? createConnectedAccountService();
  const providerClients = {
    GOOGLE: dependencies.providerClients?.GOOGLE ?? googleSocialOAuthClient,
    DISCORD: dependencies.providerClients?.DISCORD ?? discordSocialOAuthClient,
  };
  const hashPassword = dependencies.hashPassword
    ?? ((rawPassword: string): Promise<string> => bcrypt.hash(rawPassword, SOCIAL_PASSWORD_SALT_ROUNDS));

  async function resolveOrCreateUser(
    identity: SocialAuthProviderIdentity,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const verifiedEmail = normalizeVerifiedEmail(identity);

    if (verifiedEmail) {
      const existingEmailUser = await users.findByEmail(verifiedEmail);

      if (existingEmailUser) {
        return {
          user: existingEmailUser,
          isNewUser: false,
        };
      }
    }

    const username = await buildAvailableUsername(identity, users);
    const email = verifiedEmail ?? buildPlaceholderEmail(identity.provider, identity.externalId);
    const password = await hashPassword(randomUUID());
    const user = await users.create({
      username,
      email,
      password,
      displayName: identity.displayName ?? username,
      avatarUrl: identity.avatarUrl,
    });

    return {
      user,
      isNewUser: true,
    };
  }

  return {
    async startLogin(provider): Promise<SocialAuthStartResult> {
      const socialProvider = normalizeSocialAuthProvider(provider);
      const client = providerClients[socialProvider];
      const { state, nonce } = createSocialOAuthState(socialProvider);

      return {
        provider: socialProvider,
        authorizationUrl: client.createAuthorizationUrl({ state, nonce }),
      };
    },

    async completeCallback(input): Promise<SocialAuthCallbackResult> {
      const socialProvider = normalizeSocialAuthProvider(input.provider);

      if (input.providerError) {
        throw createSocialAuthError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Login social cancelado ou negado pelo provider.',
          provider: socialProvider,
        });
      }

      if (!input.code || !input.state) {
        throw createSocialAuthError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Callback social inválido.',
          provider: socialProvider,
        });
      }

      verifyStateValue(input.state, socialProvider);

      let identity: SocialAuthProviderIdentity;

      try {
        identity = await providerClients[socialProvider].exchangeCodeForIdentity(input.code);
      } catch (error) {
        mapProviderFailure(error, socialProvider);
      }

      if (identity.provider !== socialProvider) {
        throw createSocialAuthError({
          statusCode: 400,
          reason: 'invalid_request',
          clientMessage: 'Identidade social inválida.',
          provider: socialProvider,
        });
      }

      const existingIdentity = await connectedAccounts.findByProviderExternalId(
        socialProvider,
        identity.externalId,
      );

      if (existingIdentity) {
        const owner = await users.findById(existingIdentity.userId);

        if (!owner) {
          throw createSocialAuthError({
            statusCode: 409,
            reason: 'identity_conflict',
            clientMessage: 'Identidade social vinculada a uma conta indisponível.',
            provider: socialProvider,
          });
        }

        return {
          provider: socialProvider,
          user: owner,
          isNewUser: false,
        };
      }

      const { user, isNewUser } = await resolveOrCreateUser(identity);
      const existingUserProvider = await connectedAccounts.findByUserProvider(user.id, socialProvider);

      if (existingUserProvider && existingUserProvider.externalId !== identity.externalId) {
        throw createSocialAuthError({
          statusCode: 409,
          reason: 'identity_conflict',
          clientMessage: 'Este usuário já possui outro login social vinculado para este provider.',
          provider: socialProvider,
        });
      }

      try {
        await connectedAccountService.connectExternalIdentity({
          userId: user.id,
          provider: socialProvider,
          externalId: identity.externalId,
          connectionType: 'SOCIAL_LOGIN',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          accessToken: identity.accessToken,
          refreshToken: identity.refreshToken,
          metadata: {
            ...identity.metadata,
            email: identity.email,
            emailVerified: identity.emailVerified,
            displayName: identity.displayName,
            username: identity.username,
            avatarUrl: identity.avatarUrl,
            source: 'social_login',
          },
          lastSyncAt: new Date(),
        });
      } catch (error) {
        if (error instanceof ConnectedAccountConflictError) {
          throw createSocialAuthError({
            statusCode: 409,
            reason: 'identity_conflict',
            clientMessage: 'Esta identidade social já está vinculada a outro usuário.',
            provider: socialProvider,
          });
        }

        throw error;
      }

      return {
        provider: socialProvider,
        user,
        isNewUser,
      };
    },
  };
}
