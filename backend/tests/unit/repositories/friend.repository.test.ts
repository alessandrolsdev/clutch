import { describe, it, expect, vi, beforeEach } from 'vitest';
import { friendRepository } from '@/core/repositories/friend.repository';

// ─────────────────────────────────────────────────────────────
// Mock do Prisma
// ─────────────────────────────────────────────────────────────

vi.mock('@/infra/database/client', () => ({
  prisma: {
    friendRequest: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      update:     vi.fn(),
      findMany:   vi.fn(),
    },
    friendship: {
      findFirst:  vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany:   vi.fn(),
    },
    userStats: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/infra/database/client';

const mockRequest = {
  id:         'request-id-1',
  senderId:   'user-id-1',
  receiverId: 'user-id-2',
  status:     'PENDING' as const,
  createdAt:  new Date(),
  updatedAt:  new Date(),
};

describe('friendRepository', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createRequest ──────────────────────────────────────────
  describe('createRequest', () => {
    it('cria pedido com status PENDING', async () => {
      vi.mocked(prisma.friendRequest.create).mockResolvedValue(mockRequest);

      const result = await friendRepository.createRequest('user-id-1', 'user-id-2');

      expect(result.status).toBe('PENDING');
      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: { senderId: 'user-id-1', receiverId: 'user-id-2' },
      });
    });
  });

  // ── existsRequest ──────────────────────────────────────────
  describe('existsRequest', () => {
    it('retorna true quando pedido existe', async () => {
      vi.mocked(prisma.friendRequest.findFirst).mockResolvedValue(mockRequest);

      const result = await friendRepository.existsRequest('user-id-1', 'user-id-2');

      expect(result).toBe(true);
    });

    it('retorna false quando pedido não existe', async () => {
      vi.mocked(prisma.friendRequest.findFirst).mockResolvedValue(null);

      const result = await friendRepository.existsRequest('user-id-1', 'user-id-2');

      expect(result).toBe(false);
    });
  });

  describe('findRequestById', () => {
    it('retorna pedido quando ele existe', async () => {
      vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue(mockRequest);

      const result = await friendRepository.findRequestById('request-id-1');

      expect(result).toEqual(mockRequest);
      expect(prisma.friendRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'request-id-1' },
      });
    });
  });

  // ── existsFriendship ───────────────────────────────────────
  describe('existsFriendship', () => {
    it('retorna true quando amizade existe', async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue({
        id:        'friendship-id-1',
        userId:    'user-id-1',
        friendId:  'user-id-2',
        createdAt: new Date(),
      });

      const result = await friendRepository.existsFriendship('user-id-1', 'user-id-2');

      expect(result).toBe(true);
    });

    it('retorna false quando amizade não existe', async () => {
      vi.mocked(prisma.friendship.findFirst).mockResolvedValue(null);

      const result = await friendRepository.existsFriendship('user-id-1', 'user-id-2');

      expect(result).toBe(false);
    });
  });

  // ── acceptRequest ──────────────────────────────────────────
  describe('acceptRequest', () => {
    it('executa transaction ao aceitar pedido', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      await friendRepository.acceptRequest('request-id-1', 'user-id-1', 'user-id-2');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── removeFriendship ───────────────────────────────────────
  describe('removeFriendship', () => {
    it('executa transaction ao remover amizade', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      await friendRepository.removeFriendship('user-id-1', 'user-id-2');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── findFriendsByUserId ────────────────────────────────────
  describe('findFriendsByUserId', () => {
    it('retorna lista de amigos do usuário', async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([]);

      const result = await friendRepository.findFriendsByUserId('user-id-1');

      expect(result).toEqual([]);
      expect(prisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-id-1' } }),
      );
    });
  });

  describe('findFriendIdsByUserId', () => {
    it('retorna apenas os ids dos amigos do usuário', async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        { friendId: 'friend-id-1' },
        { friendId: 'friend-id-2' },
      ] as never);

      const result = await friendRepository.findFriendIdsByUserId('user-id-1');

      expect(result).toEqual(['friend-id-1', 'friend-id-2']);
      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where:  { userId: 'user-id-1' },
        select: { friendId: true },
      });
    });
  });

  // ── findPendingRequests ────────────────────────────────────
  describe('findPendingRequests', () => {
    it('retorna pedidos pendentes do usuário', async () => {
      vi.mocked(prisma.friendRequest.findMany).mockResolvedValue([]);

      const result = await friendRepository.findPendingRequests('user-id-2');

      expect(result).toEqual([]);
      expect(prisma.friendRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { receiverId: 'user-id-2', status: 'PENDING' },
        }),
      );
    });
  });

});
