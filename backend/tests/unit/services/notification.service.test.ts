import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

vi.mock('@/infra/database/client', () => ({
  prisma: {
    notification: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      count:      vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/infra/cache/redis', () => ({
  redis: {
    publish: vi.fn(),
    get:     vi.fn(),
    setex:   vi.fn(),
    del:     vi.fn(),
    pipeline: vi.fn(),
  },
  REDIS_KEYS: {
    presence:       (id: string) => `presence:${id}`,
    presenceUpdate: 'presence:updates',
  },
  REDIS_TTL: { presence: 300 },
}));

import { prisma }               from '@/infra/database/client';
import { redis }                from '@/infra/cache/redis';
import { notificationService }  from '@/core/services/notification.service';
import { notificationRepository } from '@/core/repositories/notification.repository';

const mockNotification = {
  id:        'notif-id-1',
  userId:    'user-id-1',
  actorId:   'user-id-2',
  type:      'FRIEND_REQUEST' as never,
  payload:   { message: 'Pedido de amizade' },
  isRead:    false,
  createdAt: new Date(),
};

describe('notificationService', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('create', () => {
    it('salva notificação no banco', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification);
      vi.mocked(redis.publish).mockResolvedValue(1);

      await notificationService.create({
        userId:  'user-id-1',
        actorId: 'user-id-2',
        type:    'FRIEND_REQUEST',
        payload: { message: 'Pedido de amizade' },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-id-1',
            type:   'FRIEND_REQUEST',
          }),
        }),
      );
    });

    it('publica no Redis após salvar', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification);
      vi.mocked(redis.publish).mockResolvedValue(1);

      await notificationService.create({
        userId:  'user-id-1',
        actorId: 'user-id-2',
        type:    'FRIEND_REQUEST',
        payload: {},
      });

      expect(redis.publish).toHaveBeenCalledWith(
        'notifications:user-id-1',
        expect.any(String),
      );
    });

    it('não falha quando Redis está offline', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification);
      vi.mocked(redis.publish).mockRejectedValue(new Error('Redis offline'));

      await expect(
        notificationService.create({
          userId:  'user-id-1',
          actorId: null,
          type:    'SYSTEM',
          payload: {},
        }),
      ).resolves.not.toThrow();
    });
  });

});

describe('notificationRepository', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('findByUserId', () => {
    it('retorna notificações e unreadCount', async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([mockNotification]);
      vi.mocked(prisma.notification.count).mockResolvedValue(1);

      const result = await notificationRepository.findByUserId('user-id-1');

      expect(result.notifications).toHaveLength(1);
      expect(result.unreadCount).toBe(1);
    });

    it('filtra apenas não lidas quando unreadOnly=true', async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([mockNotification]);
      vi.mocked(prisma.notification.count).mockResolvedValue(1);

      await notificationRepository.findByUserId('user-id-1', true);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-id-1', isRead: false },
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('marca notificação como lida', async () => {
      vi.mocked(prisma.notification.update).mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const result = await notificationRepository.markAsRead('notif-id-1');

      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marca todas as notificações como lidas', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

      await notificationRepository.markAllAsRead('user-id-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-1', isRead: false },
        data:  { isRead: true },
      });
    });
  });

});