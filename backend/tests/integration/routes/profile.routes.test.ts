import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/profile.repository', () => ({
  profileRepository: {
    findFullProfileByUsername: vi.fn(),
    updateByUserId:            vi.fn(),
  },
}));

vi.mock('@/core/services/social-continuity.service', () => ({
  socialContinuityService: {
    summarizeUser: vi.fn(),
  },
}));

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(), findByEmail: vi.fn(), findByUsername: vi.fn(),
    existsByEmailOrUsername: vi.fn(), create: vi.fn(),
  },
}));

import { profileRepository } from '@/core/repositories/profile.repository';
import { socialContinuityService } from '@/core/services/social-continuity.service';
import { userRepository }    from '@/core/repositories/user.repository';

const mockUser = {
  id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg',
  password_hash: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

const mockFullProfile = {
  id: 'user-id-1', username: 'clutchplayer', createdAt: new Date(),
  profile: { displayName: 'Clutch Player', bio: null, avatarUrl: null, bannerUrl: null, accentColor: '#FF5500', badges: [] },
  stats: { level: 5, xp: 1200, reputation: 80, friendCount: 12, postCount: 34 },
  presence: { status: 'ONLINE', currentGame: null, gameDetails: null, platform: null, updatedAt: new Date() },
  platformIntegrations: [], gameLibrary: [],
};

const mockSocialContinuity = {
  currentStreakDays: 3,
  activeFriendOffensiveCount: 1,
  strongestFriendOffensive: {
    friendId: 'friend-1',
    friendUsername: 'duoqueue',
    days: 2,
    lastQualifiedAt: '2026-04-22T00:00:00.000Z',
  },
};

const mockUpdatedProfile = {
  id: 'profile-id-1', userId: 'user-id-1', displayName: 'Novo Nome',
  bio: 'Nova bio', avatarUrl: null, bannerUrl: null, accentColor: null,
  badges: [], createdAt: new Date(), updatedAt: new Date(),
};

describe('Profile Routes', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(socialContinuityService.summarizeUser).mockResolvedValue(mockSocialContinuity);
  });

  describe('GET /profiles/:username', () => {
    it('retorna 200 com perfil completo', async () => {
      vi.mocked(profileRepository.findFullProfileByUsername).mockResolvedValue(mockFullProfile);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/profiles/clutchplayer' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        username: 'clutchplayer',
        socialContinuity: {
          currentStreakDays: 3,
          activeFriendOffensiveCount: 1,
          strongestFriendOffensive: {
            friendId: 'friend-1',
            friendUsername: 'duoqueue',
            days: 2,
          },
        },
      });
      await app.close();
    });

    it('retorna 404 quando username não existe', async () => {
      vi.mocked(profileRepository.findFullProfileByUsername).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/profiles/naoexiste' });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it('retorna toda a gameLibrary sem truncar em 10 itens', async () => {
      vi.mocked(profileRepository.findFullProfileByUsername).mockResolvedValue({
        ...mockFullProfile,
        gameLibrary: Array.from({ length: 12 }, (_, index) => ({
          gameName: `Game ${index + 1}`,
          coverUrl: null,
          platform: 'STEAM',
          hoursPlayed: index,
          lastPlayedAt: null,
        })),
      });

      const app = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/profiles/clutchplayer' });

      expect(response.statusCode).toBe(200);
      expect(response.json().gameLibrary).toHaveLength(12);
      await app.close();
    });
  });

  describe('PATCH /profiles/:username', () => {
    it('retorna 200 quando dono edita o perfil', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);
      vi.mocked(profileRepository.updateByUserId).mockResolvedValue(mockUpdatedProfile);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { Authorization: `Bearer ${token}` },
        payload: { displayName: 'Novo Nome', bio: 'Nova bio' },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'PATCH', url: '/profiles/clutchplayer', payload: {} });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 403 quando outro usuário tenta editar', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);

      const app   = await buildApp();
      const token = generateTestToken(app, 'outro-user-id');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { Authorization: `Bearer ${token}` },
        payload: { displayName: 'Invasor' },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });

    it('retorna 404 quando username não existe', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(null);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/naoexiste',
        headers: { Authorization: `Bearer ${token}` },
        payload: { displayName: 'Novo Nome' },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it('retorna 400 com accentColor inválido', async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue(mockUser);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/profiles/clutchplayer',
        headers: { Authorization: `Bearer ${token}` },
        payload: { accentColor: 'vermelho' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

});
