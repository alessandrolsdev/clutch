import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileRepository } from '@/core/repositories/profile.repository';

// ─────────────────────────────────────────────────────────────
// Mock do Prisma
// ─────────────────────────────────────────────────────────────

vi.mock('@/infra/database/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    profile: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

const mockFullProfile = {
  id:        'user-id-1',
  username:  'clutchplayer',
  createdAt: new Date(),
  profile: {
    displayName: 'Clutch Player',
    bio:         'Gamer profissional',
    avatarUrl:   null,
    bannerUrl:   null,
    accentColor: '#FF5500',
    badges:      [],
  },
  stats: {
    level:       5,
    xp:          1200,
    reputation:  80,
    friendCount: 12,
    postCount:   34,
  },
  presence: {
    status:      'ONLINE',
    currentGame: null,
    gameDetails: null,
    platform:    null,
    updatedAt:   new Date(),
  },
  platformIntegrations: [],
  gameLibrary:          [],
};

const mockProfile = {
  id:          'profile-id-1',
  userId:      'user-id-1',
  displayName: 'Clutch Player',
  bio:         'Bio atualizada',
  avatarUrl:   null,
  bannerUrl:   null,
  accentColor: null,
  badges:      [],
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

describe('profileRepository', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findFullProfileByUsername ──────────────────────────────
  describe('findFullProfileByUsername', () => {
    it('retorna perfil completo quando username existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockFullProfile as never);

      const result = await profileRepository.findFullProfileByUsername('clutchplayer');

      expect(result).toEqual(mockFullProfile);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { username: 'clutchplayer' } }),
      );
    });

    it('retorna null quando username não existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await profileRepository.findFullProfileByUsername('naoexiste');

      expect(result).toBeNull();
    });
  });

  // ── updateByUserId ─────────────────────────────────────────
  describe('updateByUserId', () => {
    it('atualiza e retorna o perfil com novos dados', async () => {
      vi.mocked(prisma.profile.update).mockResolvedValue(mockProfile);

      const result = await profileRepository.updateByUserId('user-id-1', {
        bio: 'Bio atualizada',
      });

      expect(result.bio).toBe('Bio atualizada');
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
        data:  { bio: 'Bio atualizada' },
      });
    });
  });

});