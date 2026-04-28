/* eslint-disable no-unused-vars */
import type {
  Platform,
  PlatformIntegrationConnectionType,
  PlatformIntegrationDataSource,
  PlatformIntegrationStatus,
  Prisma,
} from '@prisma/client';
import { protectSensitiveToken } from '../../config/protected-token';
import {
  createConnectedAccountRepository,
  type ConnectedAccountRecord,
  type ConnectedAccountRepository,
  ConnectedAccountUniquenessError,
} from '../repositories/connected-account.repository';

export class ConnectedAccountConflictError extends Error {
  readonly provider: Platform;
  readonly externalId: string;
  readonly ownerUserId: string;

  constructor(provider: Platform, externalId: string, ownerUserId: string) {
    super('Identidade externa já vinculada a outro usuário.');
    this.name = 'ConnectedAccountConflictError';
    this.provider = provider;
    this.externalId = externalId;
    this.ownerUserId = ownerUserId;
  }
}

export type ConnectExternalIdentityInput = {
  userId: string;
  provider: Platform;
  externalId: string;
  connectionType: PlatformIntegrationConnectionType;
  dataSource: PlatformIntegrationDataSource;
  status?: PlatformIntegrationStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  lastSyncAt?: Date | null;
};

export type ConnectedAccountService = {
  connectExternalIdentity(input: ConnectExternalIdentityInput): Promise<ConnectedAccountRecord>;
};

export function createConnectedAccountService(dependencies?: {
  repository?: Pick<
    ConnectedAccountRepository,
    'findByProviderExternalId' | 'upsertConnectedAccount'
  >;
}): ConnectedAccountService {
  const repository = dependencies?.repository ?? createConnectedAccountRepository();

  return {
    async connectExternalIdentity(input: ConnectExternalIdentityInput): Promise<ConnectedAccountRecord> {
      const existingIdentity = await repository.findByProviderExternalId(
        input.provider,
        input.externalId,
      );

      if (existingIdentity && existingIdentity.userId !== input.userId) {
        throw new ConnectedAccountConflictError(
          input.provider,
          input.externalId,
          existingIdentity.userId,
        );
      }

      try {
        return await repository.upsertConnectedAccount({
          userId: input.userId,
          provider: input.provider,
          externalId: input.externalId,
          connectionType: input.connectionType,
          status: input.status ?? 'CONNECTED',
          dataSource: input.dataSource,
          accessToken: protectSensitiveToken(input.accessToken),
          refreshToken: protectSensitiveToken(input.refreshToken),
          metadata: input.metadata ?? null,
          lastSyncAt: input.lastSyncAt,
        });
      } catch (error) {
        if (error instanceof ConnectedAccountUniquenessError && error.owner) {
          throw new ConnectedAccountConflictError(
            input.provider,
            input.externalId,
            error.owner.userId,
          );
        }

        throw error;
      }
    },
  };
}
