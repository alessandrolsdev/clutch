import { describe, expect, it, vi } from 'vitest';
import {
  ConnectedAccountConflictError,
  ConnectedAccountInvalidExternalIdError,
  createConnectedAccountService,
} from '@/core/services/connected-account.service';
import { ConnectedAccountUniquenessError } from '@/core/repositories/connected-account.repository';

const createRepository = () => ({
  findByProviderExternalId: vi.fn(),
  upsertConnectedAccount: vi.fn(),
});

describe('connected account service', () => {
  it('cria uma identidade externa conectada com contrato normalizado', async () => {
    const repository = createRepository();
    repository.findByProviderExternalId.mockResolvedValue(null);
    repository.upsertConnectedAccount.mockResolvedValue({
      id: 'account-id-1',
      userId: 'user-id-1',
      provider: 'STEAM',
      externalId: '76561198000000000',
      connectionType: 'CONNECTED_ACCOUNT',
      status: 'CONNECTED',
      dataSource: 'OFFICIAL',
      metadata: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
      lastSyncAt: null,
    });
    const service = createConnectedAccountService({ repository });

    const account = await service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'STEAM',
      externalId: '76561198000000000',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
    });

    expect(repository.upsertConnectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id-1',
        provider: 'STEAM',
        externalId: '76561198000000000',
        connectionType: 'CONNECTED_ACCOUNT',
        status: 'CONNECTED',
      }),
    );
    expect(account).toMatchObject({
      provider: 'STEAM',
      externalId: '76561198000000000',
      connectionType: 'CONNECTED_ACCOUNT',
    });
    expect(account).not.toHaveProperty('accessToken');
    expect(account).not.toHaveProperty('refreshToken');
  });

  it('rejeita identidade conectada sem externalId material', async () => {
    const repository = createRepository();
    const service = createConnectedAccountService({ repository });

    await expect(service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: '   ',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
    })).rejects.toBeInstanceOf(ConnectedAccountInvalidExternalIdError);

    expect(repository.findByProviderExternalId).not.toHaveBeenCalled();
    expect(repository.upsertConnectedAccount).not.toHaveBeenCalled();
  });

  it('normaliza externalId com espacos antes de aplicar ownership', async () => {
    const repository = createRepository();
    repository.findByProviderExternalId.mockResolvedValue(null);
    repository.upsertConnectedAccount.mockResolvedValue({
      id: 'account-id-1',
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      connectionType: 'CONNECTED_ACCOUNT',
      status: 'CONNECTED',
      dataSource: 'OFFICIAL',
      metadata: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
      lastSyncAt: null,
    });
    const service = createConnectedAccountService({ repository });

    await service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: ' discord-user-id ',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
    });

    expect(repository.findByProviderExternalId).toHaveBeenCalledWith(
      'DISCORD',
      'discord-user-id',
    );
    expect(repository.upsertConnectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'discord-user-id' }),
    );
  });

  it('bloqueia ownership duplicado da mesma identidade externa', async () => {
    const repository = createRepository();
    repository.findByProviderExternalId.mockResolvedValue({
      id: 'account-id-1',
      userId: 'other-user-id',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      status: 'CONNECTED',
    });
    const service = createConnectedAccountService({ repository });

    await expect(service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
    })).rejects.toBeInstanceOf(ConnectedAccountConflictError);

    expect(repository.upsertConnectedAccount).not.toHaveBeenCalled();
  });

  it('traduz corrida de unicidade global para conflito de dominio', async () => {
    const repository = createRepository();
    repository.findByProviderExternalId.mockResolvedValue(null);
    repository.upsertConnectedAccount.mockRejectedValue(
      new ConnectedAccountUniquenessError({
        id: 'account-id-1',
        userId: 'other-user-id',
        provider: 'STEAM',
        externalId: '76561198000000000',
        status: 'CONNECTED',
      }),
    );
    const service = createConnectedAccountService({ repository });

    await expect(service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'STEAM',
      externalId: '76561198000000000',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
    })).rejects.toMatchObject({
      provider: 'STEAM',
      externalId: '76561198000000000',
      ownerUserId: 'other-user-id',
    });
  });

  it('permite reconectar a mesma identidade externa ao mesmo usuario', async () => {
    const repository = createRepository();
    repository.findByProviderExternalId.mockResolvedValue({
      id: 'account-id-1',
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      status: 'CONNECTED',
    });
    repository.upsertConnectedAccount.mockResolvedValue({
      id: 'account-id-1',
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      connectionType: 'CONNECTED_ACCOUNT',
      status: 'CONNECTED',
      dataSource: 'OFFICIAL',
      metadata: { username: 'clutchdiscord' },
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
      lastSyncAt: null,
    });
    const service = createConnectedAccountService({ repository });

    await service.connectExternalIdentity({
      userId: 'user-id-1',
      provider: 'DISCORD',
      externalId: 'discord-user-id',
      connectionType: 'CONNECTED_ACCOUNT',
      dataSource: 'OFFICIAL',
      accessToken: 'discord-access-token',
      refreshToken: 'discord-refresh-token',
      metadata: { username: 'clutchdiscord' },
    });

    expect(repository.upsertConnectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.stringMatching(/^enc:v1:/u),
        refreshToken: expect.stringMatching(/^enc:v1:/u),
      }),
    );
  });
});
