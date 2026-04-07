/* eslint-disable no-unused-vars */
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database/client';
import {
  createIntegrationError,
  type IntegrationError,
} from '../../infra/integrations/integration.errors';
import {
  discordService,
  type DiscordIdentity,
  type DiscordTokenSet,
} from '../../infra/integrations/discord/discord.service';
import { writeBackendRuntimeLog } from '../../config/logging';

type PersistDiscordIntegrationInput = {
  externalId: string;
  accessToken: string;
  refreshToken: string | null;
  metadata: Prisma.InputJsonValue;
};

type DiscordOAuthPersistence = {
  upsertDiscordIntegration(
    userId: string,
    data: PersistDiscordIntegrationInput,
  ): Promise<void>;
};

type DiscordOAuthClient = Pick<
typeof discordService,
  'createAuthorizationUrl' | 'validateState' | 'exchangeCode' | 'getCurrentUser'
>;

type DiscordCallbackResult = {
  message: string;
  platform: 'DISCORD';
  externalId: string;
  username: string;
  globalName: string | null;
};

type CompleteDiscordOAuthInput = {
  code?: string;
  state?: string;
  providerError?: string;
  requestId?: string;
};

function createPrismaDiscordOAuthPersistence(): DiscordOAuthPersistence {
  return {
    async upsertDiscordIntegration(userId, data): Promise<void> {
      await prisma.platformIntegration.upsert({
        where: {
          userId_platform: {
            userId,
            platform: 'DISCORD',
          },
        },
        create: {
          userId,
          platform: 'DISCORD',
          externalId: data.externalId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          metadata: data.metadata,
          isActive: true,
        },
        update: {
          externalId: data.externalId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          metadata: data.metadata,
          isActive: true,
        },
      });
    },
  };
}

function normalizeDiscordOAuthError(error: unknown): IntegrationError {
  if (error instanceof Error && error.name === 'IntegrationError') {
    return error as IntegrationError;
  }

  return createIntegrationError(
    'discord',
    503,
    'upstream_unavailable',
    'Integração Discord indisponível no momento.',
  );
}

function buildDiscordMetadata(identity: DiscordIdentity, tokenSet: DiscordTokenSet): Prisma.InputJsonValue {
  return {
    username: identity.username,
    globalName: identity.globalName,
    avatarUrl: identity.avatarUrl,
    tokenType: tokenSet.tokenType,
    scope: tokenSet.scope,
    tokenExpiresAt: new Date(Date.now() + tokenSet.expiresIn * 1000).toISOString(),
  };
}

export type DiscordOAuthService = ReturnType<typeof createDiscordOAuthService>;

export function createDiscordOAuthService(dependencies?: {
  discordClient?: DiscordOAuthClient;
  persistence?: DiscordOAuthPersistence;
}): {
  getAuthorizationUrl: (input: { userId: string; requestId?: string }) => Promise<{ authorizationUrl: string }>;
  completeCallback: (input: CompleteDiscordOAuthInput) => Promise<DiscordCallbackResult>;
} {
  const discordClient = dependencies?.discordClient ?? discordService;
  const persistence = dependencies?.persistence ?? createPrismaDiscordOAuthPersistence();

  return {
    async getAuthorizationUrl({
      userId,
      requestId,
    }: {
      userId: string;
      requestId?: string;
    }): Promise<{ authorizationUrl: string }> {
      writeBackendRuntimeLog(
        'info',
        'integration_discord_oauth_started',
        'Discord OAuth flow started.',
        {
          requestId,
          provider: 'discord',
          userId,
        },
      );

      const { authorizationUrl } = discordClient.createAuthorizationUrl(userId);

      return {
        authorizationUrl,
      };
    },

    async completeCallback({
      code,
      state,
      providerError,
      requestId,
    }: CompleteDiscordOAuthInput): Promise<DiscordCallbackResult> {
      writeBackendRuntimeLog(
        'info',
        'integration_discord_oauth_callback_received',
        'Discord OAuth callback received.',
        {
          requestId,
          provider: 'discord',
        },
      );

      try {
        if (providerError) {
          throw createIntegrationError(
            'discord',
            400,
            'invalid_request',
            'Autorização Discord não foi concluída.',
          );
        }

        if (!code || !state) {
          throw createIntegrationError(
            'discord',
            400,
            'invalid_request',
            'Callback Discord inválido.',
          );
        }

        const statePayload = discordClient.validateState(state);
        const tokenSet = await discordClient.exchangeCode(code);
        const identity = await discordClient.getCurrentUser(tokenSet.accessToken);

        await persistence.upsertDiscordIntegration(statePayload.userId, {
          externalId: identity.id,
          accessToken: tokenSet.accessToken,
          refreshToken: tokenSet.refreshToken,
          metadata: buildDiscordMetadata(identity, tokenSet),
        });

        writeBackendRuntimeLog(
          'info',
          'integration_discord_link_succeeded',
          'Discord account linked successfully.',
          {
            requestId,
            provider: 'discord',
            userId: statePayload.userId,
            externalId: identity.id,
          },
        );

        return {
          message: 'Discord conectado com sucesso.',
          platform: 'DISCORD',
          externalId: identity.id,
          username: identity.username,
          globalName: identity.globalName,
        };
      } catch (error) {
        const integrationError = normalizeDiscordOAuthError(error);

        writeBackendRuntimeLog(
          'warn',
          'integration_discord_oauth_failed',
          'Discord OAuth flow failed.',
          {
            requestId,
            provider: 'discord',
            reason: integrationError.reason,
            status: integrationError.statusCode,
          },
        );

        throw integrationError;
      }
    },
  };
}
