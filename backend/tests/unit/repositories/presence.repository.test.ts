import { describe, it, expect, vi, beforeEach } from 'vitest';
import { presenceRepository } from '@/core/repositories/presence.repository';

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

vi.mock('@/infra/cache/redis', () => ({
  redis: {
    setex:    vi.fn(),
    get:      vi.fn(),
    del:      vi.fn(),
    publish:  vi.fn(),
    pipeline: vi.fn(),
  },
  REDIS_KEYS: {
    presence:       (userId: string) => `presence:${userId}`,
    friendsList:    (userId: string) => `friends:${userId}`,
    presenceUpdate: 'presence:updates',
  },
  REDIS_TTL: {
    presence: 300,
  },
}));

vi.mock('@/infra/database/client', () => ({
  prisma: {
    userPresence: {
      upsert:     vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { redis }  from '@/infra/cache/redis';
import { prisma } from '@/infra/database/client';

const mockPresenceData = {
  userId:      'user-id-1',
  status:      'ONLINE' as const,
  currentGame: null,
  gameDetails: null,
  platform:    null,
  updatedAt:   new Date().toISOString(),
};

const mockDbPresence = {
  id:          'presence-id-1',
  userId:      'user-id-1',
  status:      'ONLINE' as const,
  currentGame: null,
  gameDetails: null,
  platform:    null,
  updatedAt:   new Date(),
};

describe('presenceRepository', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── set ────────────────────────────────────────────────────
  describe('set', () => {
    it('salva no Redis com TTL correto', async () => {
      vi.mocked(redis.setex).mockResolvedValue('OK');
      vi.mocked(redis.publish).mockResolvedValue(1);
      vi.mocked(prisma.userPresence.upsert).mockResolvedValue(mockDbPresence);

      await presenceRepository.set('user-id-1', { status: 'ONLINE' });

      expect(redis.setex).toHaveBeenCalledWith(
        'presence:user-id-1',
        300,
        expect.any(String),
      );
    });

    it('atualiza Postgres via upsert', async () => {
      vi.mocked(redis.setex).mockResolvedValue('OK');
      vi.mocked(redis.publish).mockResolvedValue(1);
      vi.mocked(prisma.userPresence.upsert).mockResolvedValue(mockDbPresence);

      await presenceRepository.set('user-id-1', { status: 'IN_GAME', currentGame: 'Valorant' });

      expect(prisma.userPresence.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { userId: 'user-id-1' },
          update: expect.objectContaining({ status: 'IN_GAME', currentGame: 'Valorant' }),
        }),
      );
    });

    it('publica no canal Redis Pub/Sub', async () => {
      vi.mocked(redis.setex).mockResolvedValue('OK');
      vi.mocked(redis.publish).mockResolvedValue(1);
      vi.mocked(prisma.userPresence.upsert).mockResolvedValue(mockDbPresence);

      await presenceRepository.set('user-id-1', { status: 'ONLINE' });

      expect(redis.publish).toHaveBeenCalledWith(
        'presence:updates',
        expect.any(String),
      );
    });
  });

  // ── get ────────────────────────────────────────────────────
  describe('get', () => {
    it('retorna dados do Redis quando disponível', async () => {
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockPresenceData));

      const result = await presenceRepository.get('user-id-1');

      expect(result.status).toBe('ONLINE');
      expect(prisma.userPresence.findUnique).not.toHaveBeenCalled();
    });

    it('faz fallback para Postgres quando Redis miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userPresence.findUnique).mockResolvedValue(mockDbPresence);

      const result = await presenceRepository.get('user-id-1');

      expect(result.status).toBe('ONLINE');
      expect(prisma.userPresence.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
      });
    });

    it('retorna OFFLINE quando não encontrado em nenhum layer', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.userPresence.findUnique).mockResolvedValue(null);

      const result = await presenceRepository.get('user-id-1');

      expect(result.status).toBe('OFFLINE');
    });
  });

  // ── setOffline ─────────────────────────────────────────────
  describe('setOffline', () => {
    it('remove chave do Redis', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      vi.mocked(redis.publish).mockResolvedValue(1);
      vi.mocked(prisma.userPresence.upsert).mockResolvedValue(mockDbPresence);

      await presenceRepository.setOffline('user-id-1');

      expect(redis.del).toHaveBeenCalledWith('presence:user-id-1');
    });

    it('atualiza status para OFFLINE no Postgres', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      vi.mocked(redis.publish).mockResolvedValue(1);
      vi.mocked(prisma.userPresence.upsert).mockResolvedValue(mockDbPresence);

      await presenceRepository.setOffline('user-id-1');

      expect(prisma.userPresence.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'OFFLINE' }),
        }),
      );
    });
  });

  // ── getFriendsPresence ─────────────────────────────────────
  describe('getFriendsPresence', () => {
    it('retorna array vazio quando userIds está vazio', async () => {
      const result = await presenceRepository.getFriendsPresence([]);
      expect(result).toEqual([]);
    });

    it('retorna presença de múltiplos usuários via pipeline', async () => {
      const mockPipeline = {
        get:  vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, JSON.stringify(mockPresenceData)],
          [null, null],
        ]),
      };
      vi.mocked(redis.pipeline).mockReturnValue(mockPipeline as never);

      const result = await presenceRepository.getFriendsPresence(['user-id-1', 'user-id-2']);

      expect(result).toHaveLength(2);
      expect(result[0]?.status).toBe('ONLINE');
      expect(result[1]?.status).toBe('OFFLINE');
    });
  });

});