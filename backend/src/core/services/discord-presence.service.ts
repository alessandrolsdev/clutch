/* eslint-disable no-unused-vars */
import { PresenceStatus } from '@prisma/client';
import { prisma } from '../../infra/database/client';
import {
  createIntegrationError,
  type IntegrationError,
} from '../../infra/integrations/integration.errors';
import {
  friendRepository,
} from '../repositories/friend.repository';
import {
  presenceRepository,
  type PresenceData,
} from '../repositories/presence.repository';
import { writeBackendRuntimeLog } from '../../config/logging';

type DiscordPresenceIngestInput = {
  externalId: string;
  status: PresenceStatus;
  currentGame?: string | null;
  gameDetails?: Record<string, unknown> | null;
  requestId?: string;
};

type DiscordPresencePersistence = {
  findLinkedUserIdByExternalId(externalId: string): Promise<string | null>;
  findFriendIdsByUserId(userId: string): Promise<string[]>;
  setPresence(
    userId: string,
    input: {
      status: PresenceStatus;
      currentGame?: string | null;
      gameDetails?: Record<string, unknown> | null;
      platform?: string | null;
    },
  ): Promise<PresenceData>;
  publishScopedUpdate(presence: PresenceData, recipientIds: string[]): Promise<void>;
};

function createPrismaDiscordPresencePersistence(): DiscordPresencePersistence {
  return {
    async findLinkedUserIdByExternalId(externalId): Promise<string | null> {
      const integration = await prisma.platformIntegration.findFirst({
        where: {
          platform: 'DISCORD',
          externalId,
          isActive: true,
        },
        select: {
          userId: true,
        },
      });

      return integration?.userId ?? null;
    },
    async findFriendIdsByUserId(userId): Promise<string[]> {
      return friendRepository.findFriendIdsByUserId(userId);
    },
    async setPresence(userId, input): Promise<PresenceData> {
      return presenceRepository.set(userId, input);
    },
    async publishScopedUpdate(presence, recipientIds): Promise<void> {
      await presenceRepository.publishScopedUpdate(presence, recipientIds);
    },
  };
}

function normalizeDiscordPresenceError(error: unknown): IntegrationError {
  if (error instanceof Error && error.name === 'IntegrationError') {
    return error as IntegrationError;
  }

  return createIntegrationError(
    'discord',
    503,
    'upstream_unavailable',
    'Presença Discord indisponível no momento.',
  );
}

function buildPresencePayload(input: DiscordPresenceIngestInput): {
  status: PresenceStatus;
  currentGame: string | null;
  gameDetails: Record<string, unknown> | null;
  platform: 'DISCORD' | null;
} {
  const shouldClearActivity = input.status === 'OFFLINE';

  return {
    status: input.status,
    currentGame: shouldClearActivity ? null : input.currentGame ?? null,
    gameDetails: shouldClearActivity ? null : input.gameDetails ?? null,
    platform: shouldClearActivity ? null : 'DISCORD',
  };
}

export type DiscordPresenceService = ReturnType<typeof createDiscordPresenceService>;

export function createDiscordPresenceService(dependencies?: {
  persistence?: DiscordPresencePersistence;
}): {
  ingestPresence: (input: DiscordPresenceIngestInput) => Promise<{
    message: string;
    userId: string;
    externalId: string;
    status: PresenceStatus;
    platform: 'DISCORD' | null;
    updatedAt: string;
  }>;
} {
  const persistence = dependencies?.persistence ?? createPrismaDiscordPresencePersistence();

  return {
    async ingestPresence(input): Promise<{
      message: string;
      userId: string;
      externalId: string;
      status: PresenceStatus;
      platform: 'DISCORD' | null;
      updatedAt: string;
    }> {
      writeBackendRuntimeLog(
        'info',
        'integration_discord_presence_ingest_received',
        'Discord presence ingest received.',
        {
          requestId: input.requestId,
          provider: 'discord',
          externalId: input.externalId,
          status: input.status,
        },
      );

      try {
        const userId = await persistence.findLinkedUserIdByExternalId(input.externalId);

        if (!userId) {
          throw createIntegrationError(
            'discord',
            404,
            'not_connected',
            'Conta Discord não vinculada a um usuário CLUTCH.',
          );
        }

        const normalizedPresence = buildPresencePayload(input);
        const presence = await persistence.setPresence(userId, normalizedPresence);
        const friendIds = await persistence.findFriendIdsByUserId(userId);
        await persistence.publishScopedUpdate(presence, friendIds);

        writeBackendRuntimeLog(
          'info',
          'integration_discord_presence_ingest_succeeded',
          'Discord presence ingest succeeded.',
          {
            requestId: input.requestId,
            provider: 'discord',
            externalId: input.externalId,
            userId,
            status: presence.status,
          },
        );

        return {
          message: 'Presença Discord atualizada.',
          userId,
          externalId: input.externalId,
          status: presence.status,
          platform: normalizedPresence.platform,
          updatedAt: presence.updatedAt,
        };
      } catch (error) {
        const integrationError = normalizeDiscordPresenceError(error);

        writeBackendRuntimeLog(
          'warn',
          'integration_discord_presence_ingest_failed',
          'Discord presence ingest failed.',
          {
            requestId: input.requestId,
            provider: 'discord',
            externalId: input.externalId,
            reason: integrationError.reason,
            status: integrationError.statusCode,
          },
        );

        throw integrationError;
      }
    },
  };
}
