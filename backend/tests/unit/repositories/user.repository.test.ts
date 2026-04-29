import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userRepository } from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Mock do Prisma — zero chamadas reais ao banco
// ─────────────────────────────────────────────────────────────

vi.mock('@/infra/database/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      create:     vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

const mockUser = {
  id:            'user-id-1',
  username:      'clutchplayer',
  email:         'player@clutch.gg',
  password_hash: 'password123',
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

describe('userRepository', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findById ───────────────────────────────────────────────
  describe('findById', () => {
    it('retorna o usuário quando ID existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await userRepository.findById('user-id-1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
      });
    });

    it('retorna null quando ID não existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await userRepository.findById('id-inexistente');

      expect(result).toBeNull();
    });
  });

  // ── findByEmail ────────────────────────────────────────────
  describe('findByEmail', () => {
    it('retorna o usuário quando email existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('player@clutch.gg');

      expect(result).toEqual(mockUser);
    });

    it('retorna null quando email não existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await userRepository.findByEmail('naoexiste@clutch.gg');

      expect(result).toBeNull();
    });
  });

  // ── existsByEmailOrUsername ────────────────────────────────
  describe('existsByEmailOrUsername', () => {
    it('retorna true quando email já está cadastrado', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);

      const result = await userRepository.existsByEmailOrUsername(
        'player@clutch.gg',
        'outrousername',
      );

      expect(result).toBe(true);
    });

    it('retorna true quando username já está cadastrado', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);

      const result = await userRepository.existsByEmailOrUsername(
        'outro@clutch.gg',
        'clutchplayer',
      );

      expect(result).toBe(true);
    });

    it('retorna false quando email e username são únicos', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await userRepository.existsByEmailOrUsername(
        'novo@clutch.gg',
        'novoplayer',
      );

      expect(result).toBe(false);
    });
  });

  // ── create ─────────────────────────────────────────────────
  describe('create', () => {
    it('cria usuário com profile, stats e presence aninhados', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await userRepository.create({
        username: 'clutchplayer',
        email:    'player@clutch.gg',
        password: 'password123',
      });

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username:      'clutchplayer',
          email:         'player@clutch.gg',
          password_hash: 'password123',
          profile:  { create: { displayName: 'clutchplayer', avatarUrl: null } },
          stats:    { create: { level: 1, xp: 0 } },
          presence: { create: { status: 'OFFLINE' } },
        }),
      });
    });
  });

});
