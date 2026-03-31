import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    existsByEmailOrUsername: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/core/repositories/profile.repository', () => ({
  profileRepository: {
    findFullProfileByUsername: vi.fn(),
    updateByUserId: vi.fn(),
  },
}));

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    createRequest: vi.fn(),
    findRequestById: vi.fn(),
    existsRequest: vi.fn(),
    existsFriendship: vi.fn(),
    acceptRequest: vi.fn(),
    removeFriendship: vi.fn(),
    findFriendsByUserId: vi.fn(),
    findPendingRequests: vi.fn(),
    findFriendIdsByUserId: vi.fn(),
  },
}));

vi.mock('@/core/repositories/presence.repository', () => ({
  presenceRepository: {
    set: vi.fn(),
    get: vi.fn(),
    setOffline: vi.fn(),
    publishScopedUpdate: vi.fn(),
  },
}));

vi.mock('@/core/repositories/post.repository', () => ({
  postRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    deleteById: vi.fn(),
    findFeedByUserId: vi.fn(),
    toggleInteraction: vi.fn(),
    createComment: vi.fn(),
    findCommentsByPostId: vi.fn(),
    findCommentById: vi.fn(),
  },
}));

vi.mock('@/core/repositories/notification.repository', () => ({
  notificationRepository: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/core/services/notification.service', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));

vi.mock('@/infra/database/client', () => ({
  prisma: {
    platformIntegration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    userGameLibrary: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/infra/integrations/steam/steam.service', () => ({
  steamService: {
    validateSteamId: vi.fn(),
    getOwnedGames: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/igdb/igdb.service', () => ({
  igdbService: {
    searchGame: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/epic/epic.service', () => ({
  epicService: {
    validateToken: vi.fn(),
    getLibrary: vi.fn(),
  },
}));

import { prisma } from '@/infra/database/client';
import { epicService } from '@/infra/integrations/epic/epic.service';
import { igdbService } from '@/infra/integrations/igdb/igdb.service';
import { steamService } from '@/infra/integrations/steam/steam.service';

const mockSteamGames = [
  { appid: 730, name: 'Counter-Strike 2', playtime_forever: 6000, img_icon_url: '' },
  { appid: 570, name: 'Dota 2', playtime_forever: 1200, img_icon_url: '' },
];

const mockEpicGames = [
  { id: 'fortnite', title: 'Fortnite', namespace: 'fn', coverUrl: null },
  { id: 'rocket-league', title: 'Rocket League', namespace: 'rl', coverUrl: 'https://cdn.clutch.gg/rocket.jpg' },
];

const mockSteamGame = mockSteamGames[0]!;

describe('Integrations Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /integrations/steam/connect', () => {
    it('retorna 401 sem token', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        payload: { steamId: '76561198000000000' },
      });

      expect(response.statusCode).toBe(401);
      expect(vi.mocked(steamService.validateSteamId)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 400 com body invalido', async () => {
      const app = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ message: expect.any(String) });
      expect(vi.mocked(prisma.platformIntegration.upsert)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 400 com SteamID invalido', async () => {
      vi.mocked(steamService.validateSteamId).mockResolvedValue(false);

      const app = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { steamId: 'private-profile' },
      });

      expect(response.statusCode).toBe(400);
      expect(vi.mocked(prisma.platformIntegration.upsert)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 200 e importa jogos da Steam', async () => {
      vi.mocked(steamService.validateSteamId).mockResolvedValue(true);
      vi.mocked(steamService.getOwnedGames).mockResolvedValue(mockSteamGames);
      vi.mocked(igdbService.searchGame)
        .mockResolvedValueOnce({ id: 730, name: 'Counter-Strike 2', coverUrl: 'https://images.ct2.jpg', platforms: ['PC'], summary: null })
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.platformIntegration.upsert).mockResolvedValue({ id: 'integration-id-1' } as never);
      vi.mocked(prisma.userGameLibrary.upsert).mockResolvedValue({ id: 'library-id-1' } as never);

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { steamId: '76561198000000000' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        imported: 2,
        message: 'Steam conectado. 2 jogos importados.',
      });
      expect(vi.mocked(prisma.platformIntegration.upsert)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.userGameLibrary.upsert)).toHaveBeenCalledTimes(2);
      await app.close();
    });
  });

  describe('POST /integrations/steam/sync', () => {
    it('retorna 404 quando Steam nao esta conectada', async () => {
      vi.mocked(prisma.platformIntegration.findUnique).mockResolvedValue(null);

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/sync',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      expect(vi.mocked(steamService.getOwnedGames)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 200 e sincroniza biblioteca existente', async () => {
      vi.mocked(prisma.platformIntegration.findUnique).mockResolvedValue({
        userId: 'user-id-1',
        platform: 'STEAM',
        externalId: '76561198000000000',
      } as never);
      vi.mocked(steamService.getOwnedGames).mockResolvedValue([mockSteamGame]);
      vi.mocked(prisma.userGameLibrary.upsert).mockResolvedValue({ id: 'library-id-1' } as never);

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/sync',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        synced: 1,
        message: '1 jogos sincronizados.',
      });
      expect(vi.mocked(steamService.getOwnedGames)).toHaveBeenCalledWith('76561198000000000');
      expect(vi.mocked(prisma.userGameLibrary.upsert)).toHaveBeenCalledTimes(1);
      await app.close();
    });
  });

  describe('GET /integrations/igdb/search', () => {
    it('retorna 400 com query curta', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=a',
      });

      expect(response.statusCode).toBe(400);
      expect(vi.mocked(igdbService.searchGame)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 404 quando jogo nao e encontrado', async () => {
      vi.mocked(igdbService.searchGame).mockResolvedValue(null);

      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=unknown-game',
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it('retorna 200 com metadados do jogo', async () => {
      vi.mocked(igdbService.searchGame).mockResolvedValue({
        id: 730,
        name: 'Counter-Strike 2',
        coverUrl: 'https://images.ct2.jpg',
        platforms: ['PC'],
        summary: 'Competitive FPS',
      });

      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=Counter-Strike 2',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: 730,
        name: 'Counter-Strike 2',
      });
      await app.close();
    });
  });

  describe('POST /integrations/epic/connect', () => {
    it('retorna 400 com body invalido', async () => {
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(vi.mocked(epicService.validateToken)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 400 com token Epic invalido', async () => {
      vi.mocked(epicService.validateToken).mockResolvedValue(false);

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'expired-token' },
      });

      expect(response.statusCode).toBe(400);
      expect(vi.mocked(epicService.getLibrary)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 503 quando o adapter Epic falha', async () => {
      vi.mocked(epicService.validateToken).mockResolvedValue(true);
      vi.mocked(epicService.getLibrary).mockRejectedValue(new Error('Python service offline'));

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'valid-token' },
      });

      expect(response.statusCode).toBe(503);
      expect(vi.mocked(prisma.platformIntegration.upsert)).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 200 e importa jogos da Epic', async () => {
      vi.mocked(epicService.validateToken).mockResolvedValue(true);
      vi.mocked(epicService.getLibrary).mockResolvedValue(mockEpicGames);
      vi.mocked(prisma.platformIntegration.upsert).mockResolvedValue({ id: 'integration-id-1' } as never);
      vi.mocked(prisma.userGameLibrary.upsert).mockResolvedValue({ id: 'library-id-1' } as never);

      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        imported: 2,
        message: 'Epic conectado. 2 jogos importados.',
      });
      expect(vi.mocked(prisma.platformIntegration.upsert)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.userGameLibrary.upsert)).toHaveBeenCalledTimes(2);
      await app.close();
    });
  });
});
