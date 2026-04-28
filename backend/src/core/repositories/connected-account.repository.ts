/* eslint-disable no-unused-vars */
import {
  Prisma,
  type Platform,
  type PlatformIntegrationConnectionType,
  type PlatformIntegrationDataSource,
  type PlatformIntegrationStatus,
} from '@prisma/client';
import { prisma } from '../../infra/database/client';

export type ConnectedAccountRecord = {
  id: string;
  userId: string;
  provider: Platform;
  externalId: string;
  connectionType: PlatformIntegrationConnectionType;
  status: PlatformIntegrationStatus;
  dataSource: PlatformIntegrationDataSource;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
};

export type ConnectedAccountOwnershipRecord = Pick<
  ConnectedAccountRecord,
  'id' | 'userId' | 'provider' | 'externalId' | 'status'
>;

export class ConnectedAccountUniquenessError extends Error {
  readonly owner: ConnectedAccountOwnershipRecord | null;

  constructor(owner: ConnectedAccountOwnershipRecord | null) {
    super('Identidade externa já vinculada.');
    this.name = 'ConnectedAccountUniquenessError';
    this.owner = owner;
  }
}

export type UpsertConnectedAccountInput = {
  userId: string;
  provider: Platform;
  externalId: string;
  connectionType: PlatformIntegrationConnectionType;
  status: PlatformIntegrationStatus;
  dataSource: PlatformIntegrationDataSource;
  accessToken?: string | null;
  refreshToken?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  lastSyncAt?: Date | null;
};

function toConnectedAccountRecord(account: {
  id: string;
  userId: string;
  platform: Platform;
  externalId: string;
  connectionType: PlatformIntegrationConnectionType;
  status: PlatformIntegrationStatus;
  dataSource: PlatformIntegrationDataSource;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
}): ConnectedAccountRecord {
  return {
    id: account.id,
    userId: account.userId,
    provider: account.platform,
    externalId: account.externalId,
    connectionType: account.connectionType,
    status: account.status,
    dataSource: account.dataSource,
    metadata: account.metadata,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastSyncAt: account.lastSyncAt,
  };
}

export type ConnectedAccountRepository = {
  findByProviderExternalId(
    provider: Platform,
    externalId: string,
  ): Promise<ConnectedAccountOwnershipRecord | null>;
  findByUserProvider(userId: string, provider: Platform): Promise<ConnectedAccountRecord | null>;
  upsertConnectedAccount(input: UpsertConnectedAccountInput): Promise<ConnectedAccountRecord>;
};

export function createConnectedAccountRepository(): ConnectedAccountRepository {
  async function findByProviderExternalId(
    provider: Platform,
    externalId: string,
  ): Promise<ConnectedAccountOwnershipRecord | null> {
    const account = await prisma.platformIntegration.findUnique({
      where: {
        platform_externalId: {
          platform: provider,
          externalId,
        },
      },
      select: {
        id: true,
        userId: true,
        platform: true,
        externalId: true,
        status: true,
      },
    });

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      userId: account.userId,
      provider: account.platform,
      externalId: account.externalId,
      status: account.status,
    };
  }

  return {
    findByProviderExternalId,

    async findByUserProvider(
      userId: string,
      provider: Platform,
    ): Promise<ConnectedAccountRecord | null> {
      const account = await prisma.platformIntegration.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: provider,
          },
        },
      });

      return account ? toConnectedAccountRecord(account) : null;
    },

    async upsertConnectedAccount(input: UpsertConnectedAccountInput): Promise<ConnectedAccountRecord> {
      try {
        const account = await prisma.platformIntegration.upsert({
          where: {
            userId_platform: {
              userId: input.userId,
              platform: input.provider,
            },
          },
          create: {
            userId: input.userId,
            platform: input.provider,
            externalId: input.externalId,
            connectionType: input.connectionType,
            status: input.status,
            dataSource: input.dataSource,
            accessToken: input.accessToken ?? null,
            refreshToken: input.refreshToken ?? null,
            metadata: input.metadata ?? Prisma.JsonNull,
            isActive: input.status === 'CONNECTED',
            lastSyncAt: input.lastSyncAt ?? null,
          },
          update: {
            externalId: input.externalId,
            connectionType: input.connectionType,
            status: input.status,
            dataSource: input.dataSource,
            accessToken: input.accessToken ?? null,
            refreshToken: input.refreshToken ?? null,
            metadata: input.metadata ?? Prisma.JsonNull,
            isActive: input.status === 'CONNECTED',
            ...(input.lastSyncAt !== undefined ? { lastSyncAt: input.lastSyncAt } : {}),
          },
        });

        return toConnectedAccountRecord(account);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConnectedAccountUniquenessError(
            await findByProviderExternalId(input.provider, input.externalId),
          );
        }

        throw error;
      }
    },
  };
}
