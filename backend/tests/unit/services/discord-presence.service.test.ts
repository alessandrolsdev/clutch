import { describe, expect, it, vi } from 'vitest';
import { createDiscordPresenceService } from '@/core/services/discord-presence.service';

describe('discord-presence.service', () => {
  it('normaliza a presenca Discord e publica o update para amigos', async () => {
    const persistence = {
      findLinkedUserIdByExternalId: vi.fn().mockResolvedValue('user-id-1'),
      findFriendIdsByUserId: vi.fn().mockResolvedValue(['friend-id-1', 'friend-id-2']),
      setPresence: vi.fn().mockResolvedValue({
        userId: 'user-id-1',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        gameDetails: { activityType: 'PLAYING' },
        platform: 'DISCORD',
        updatedAt: '2026-04-13T18:30:00.000Z',
      }),
      publishScopedUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const service = createDiscordPresenceService({ persistence });

    const result = await service.ingestPresence({
      externalId: 'discord-user-1',
      status: 'IN_GAME',
      currentGame: 'Valorant',
      gameDetails: { activityType: 'PLAYING' },
      requestId: 'req-1',
    });

    expect(persistence.findLinkedUserIdByExternalId).toHaveBeenCalledWith('discord-user-1');
    expect(persistence.setPresence).toHaveBeenCalledWith('user-id-1', {
      status: 'IN_GAME',
      currentGame: 'Valorant',
      gameDetails: { activityType: 'PLAYING' },
      platform: 'DISCORD',
    });
    expect(persistence.findFriendIdsByUserId).toHaveBeenCalledWith('user-id-1');
    expect(persistence.publishScopedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id-1',
        status: 'IN_GAME',
      }),
      ['friend-id-1', 'friend-id-2'],
    );
    expect(result).toMatchObject({
      message: 'Presença Discord atualizada.',
      userId: 'user-id-1',
      externalId: 'discord-user-1',
      status: 'IN_GAME',
      platform: 'DISCORD',
    });
  });

  it('limpa a atividade quando o provider marca a presenca como offline', async () => {
    const persistence = {
      findLinkedUserIdByExternalId: vi.fn().mockResolvedValue('user-id-1'),
      findFriendIdsByUserId: vi.fn().mockResolvedValue([]),
      setPresence: vi.fn().mockResolvedValue({
        userId: 'user-id-1',
        status: 'OFFLINE',
        currentGame: null,
        gameDetails: null,
        platform: null,
        updatedAt: '2026-04-13T18:31:00.000Z',
      }),
      publishScopedUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const service = createDiscordPresenceService({ persistence });

    await service.ingestPresence({
      externalId: 'discord-user-1',
      status: 'OFFLINE',
      currentGame: 'Nao deveria persistir',
      gameDetails: { shouldBeCleared: true },
    });

    expect(persistence.setPresence).toHaveBeenCalledWith('user-id-1', {
      status: 'OFFLINE',
      currentGame: null,
      gameDetails: null,
      platform: null,
    });
  });

  it('retorna erro coerente quando a conta Discord nao esta vinculada', async () => {
    const persistence = {
      findLinkedUserIdByExternalId: vi.fn().mockResolvedValue(null),
      findFriendIdsByUserId: vi.fn(),
      setPresence: vi.fn(),
      publishScopedUpdate: vi.fn(),
    };

    const service = createDiscordPresenceService({ persistence });

    await expect(
      service.ingestPresence({
        externalId: 'discord-user-missing',
        status: 'ONLINE',
      }),
    ).rejects.toMatchObject({
      name: 'IntegrationError',
      statusCode: 404,
      reason: 'not_connected',
      clientMessage: 'Conta Discord não vinculada a um usuário CLUTCH.',
    });

    expect(persistence.setPresence).not.toHaveBeenCalled();
    expect(persistence.publishScopedUpdate).not.toHaveBeenCalled();
  });
});
