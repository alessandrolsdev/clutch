import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/presence.repository', () => ({
  presenceRepository: { set: vi.fn(), get: vi.fn(), setOffline: vi.fn() },
}));

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(), findByEmail: vi.fn(), findByUsername: vi.fn(),
    existsByEmailOrUsername: vi.fn(), create: vi.fn(),
  },
}));

vi.mock('@/core/repositories/profile.repository', () => ({
  profileRepository: { findFullProfileByUsername: vi.fn(), updateByUserId: vi.fn() },
}));

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    createRequest: vi.fn(), findRequestById: vi.fn(), existsRequest: vi.fn(),
    existsFriendship: vi.fn(), acceptRequest: vi.fn(), removeFriendship: vi.fn(),
    findFriendsByUserId: vi.fn(), findPendingRequests: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/steam/steam.service',  () => ({ steamService:  {} }));
vi.mock('@/infra/integrations/igdb/igdb.service',    () => ({ igdbService:   {} }));
vi.mock('@/infra/integrations/epic/epic.service',    () => ({ epicService:   {} }));

import { presenceRepository } from '@/core/repositories/presence.repository';
import { userRepository }     from '@/core/repositories/user.repository';

const mockUser = {
  id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg',
  password_hash: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

const mockPresence = {
  userId: 'user-id-1', status: 'ONLINE' as const,
  currentGame: null, gameDetails: null, platform: null,
  updatedAt: new Date().toISOString(),
};

describe('Presence Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('POST /presence', () => {
    it('retorna 200 atualizando para ONLINE', async () => {
      vi.mocked(presenceRepository.set).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/presence',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: 'ONLINE' },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 200 atualizando para IN_GAME', async () => {
      vi.mocked(presenceRepository.set).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/presence',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: 'IN_GAME', currentGame: 'Valorant', platform: 'PC' },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'POST', url: '/presence', payload: { status: 'ONLINE' } });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 400 com status inválido', async () => {
      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/presence',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: 'JOGANDO' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('GET /presence/:userId', () => {
    it('retorna 200 com presença atual', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresence);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/presence/user-id-1' });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 404 quando usuário não existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/presence/inexistente' });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

});