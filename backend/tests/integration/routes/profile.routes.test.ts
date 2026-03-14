import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../helpers/build-app';

// ─────────────────────────────────────────────────────────────
// Mock dos repositories — sem banco real
// ─────────────────────────────────────────────────────────────

vi.mock('@/core/repositories/profile.repository', () => ({
  profileRepository: {
    findFullProfileByUsername: vi.fn(),
    updateByUserId:            vi.fn(),
  },
}));

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    existsByEmailOrUsername: vi.fn(),
    create:                  vi.fn(),
    findByEmail:             vi.fn(),
    findByUsername:          vi.fn(),
    findById:                vi.fn(),
  },
}));

import { profileRepository } from '@/core/repositories/profile.repository';
import { userRepository }     from '@/core/repositories/user.repository';

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

const mockUser = {
  id:            'user-id-1',
  username:      'clutchplayer',
  email:         'player@clutch.gg',
  password_hash: 'password123',
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

const mockUpdatedProfile = {
  id:          'profile-id-1',
  userId:      'user-id-1',
  displayName: 'Novo Nome',
  bio:         'Nova bio',
  avatarUrl:   null,
  bannerUrl:   null,
  accentColor: null,
  badges:      [],
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

describe('Profile Routes', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /profiles/:username ──────────────────────────────
  describe('GET /profiles/:username', () => {

    it('retorna 200 com perfil completo', async () => {
      vi.mocked(profileRepository.findFullProfileByUsername).mockResolvedValue(
        mockFullProfile,
      );

      const app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url:    '/profiles/clutchplayer',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        username: 'clutchplayer',
        profile:  { displayName: 'Clutch Player' },
        stats:    { level: 5 },
      });

      await app.close();
    });

    it('retorna 404 quando username não existe', async () => {
      vi.mocked(profileRepository.findFullProfileByUsername).mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url:    '/profiles/naoexiste',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        message: 'Perfil não encontrado.',
      });

      await app.close();
    });

  });

  // ── PATCH /profiles/:username ────────────────────────────
  describe('PATCH /profiles/:username', () => {

    it('retorna 200 quando dono edita o perfil', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);
      vi.mocked(profileRepository.updateByUserId).mockResolvedValue(mockUpdatedProfile);

      const app = await buildApp();
      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { displayName: 'Novo Nome', bio: 'Nova bio' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        displayName: 'Novo Nome',
      });

      await app.close();
    });

    it('retorna 401 sem header x-user-id', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        payload: { displayName: 'Novo Nome' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 403 quando outro usuário tenta editar', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);

      const app = await buildApp();
      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { 'x-user-id': 'outro-user-id' },
        payload: { displayName: 'Invasor' },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });

    it('retorna 404 quando username não existe', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/naoexiste',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { displayName: 'Novo Nome' },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it('retorna 400 com accentColor inválido', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);

      const app = await buildApp();
      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { accentColor: 'vermelho' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

  });

});