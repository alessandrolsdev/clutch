import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/post.repository', () => ({
  postRepository: {
    create: vi.fn(), findById: vi.fn(), deleteById: vi.fn(),
    findFeedByUserId: vi.fn(), toggleInteraction: vi.fn(),
    createComment: vi.fn(), findCommentsByPostId: vi.fn(),
  },
}));

vi.mock('@/core/repositories/presence.repository', () => ({
  presenceRepository: { set: vi.fn(), get: vi.fn(), setOffline: vi.fn(), publishScopedUpdate: vi.fn() },
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
    findFriendsByUserId: vi.fn(), findPendingRequests: vi.fn(), findFriendIdsByUserId: vi.fn(),
  },
}));

vi.mock('@/core/services/notification.service', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/steam/steam.service',  () => ({ steamService:  {} }));
vi.mock('@/infra/integrations/igdb/igdb.service',    () => ({ igdbService:   {} }));
vi.mock('@/infra/integrations/epic/epic.service',    () => ({ epicService:   {} }));

import { postRepository }     from '@/core/repositories/post.repository';
import { notificationService } from '@/core/services/notification.service';
import { presenceRepository } from '@/core/repositories/presence.repository';
import { userRepository }     from '@/core/repositories/user.repository';

const mockUser = {
  id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg',
  password_hash: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

const mockPost = {
  id: 'post-id-1', userId: 'user-id-1', contentText: 'Hello CLUTCH!',
  mediaUrl: null, type: 'TEXT' as const, gameContext: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockPresenceOffline = {
  userId: 'user-id-1', status: 'OFFLINE' as const,
  currentGame: null, gameDetails: null, platform: null,
  updatedAt: new Date().toISOString(),
};

const mockPresenceInGame = {
  ...mockPresenceOffline, status: 'IN_GAME' as const,
  currentGame: 'Valorant', platform: 'PC',
};

describe('Posts Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('POST /posts', () => {
    it('retorna 201 com post criado', async () => {
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresenceOffline);
      vi.mocked(postRepository.create).mockResolvedValue(mockPost);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { Authorization: `Bearer ${token}` },
        payload: { contentText: 'Hello CLUTCH!' },
      });

      expect(response.statusCode).toBe(201);
      await app.close();
    });

    it('captura gameContext quando IN_GAME', async () => {
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresenceInGame);
      vi.mocked(postRepository.create).mockResolvedValue({ ...mockPost, gameContext: { gameName: 'Valorant' } } as never);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { Authorization: `Bearer ${token}` },
        payload: { contentText: 'Jogando Valorant!' },
      });

      expect(response.statusCode).toBe(201);
      await app.close();
    });

    it('retorna 400 sem conteúdo', async () => {
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresenceOffline);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'POST', url: '/posts', payload: { contentText: 'test' } });

      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('GET /posts/feed/:userId', () => {
    it('retorna 200 com feed paginado', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(postRepository.findFeedByUserId).mockResolvedValue({ posts: [], nextCursor: null });

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/posts/feed/user-id-1' });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 404 quando usuário não existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/posts/feed/inexistente' });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('POST /posts/:id/interactions', () => {
    it('retorna 200 adicionando reaction', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.toggleInteraction).mockResolvedValue({ added: true });

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'POST',
        url:     '/posts/post-id-1/interactions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(200);
      expect(notificationService.create).toHaveBeenCalledWith({
        userId:  'user-id-1',
        actorId: 'user-id-2',
        type:    'POST_LIKE',
        payload: {
          postId:          'post-id-1',
          interactionType: 'GG',
        },
      });
      await app.close();
    });

    it('retorna 400 ao reagir ao próprio post', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/posts/post-id-1/interactions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(400);
      expect(notificationService.create).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 404 para post inexistente', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(null);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'POST',
        url:     '/posts/inexistente/interactions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('POST /posts/comments', () => {
    it('retorna 201 com comentário criado', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.createComment).mockResolvedValue({
        id: 'c1', postId: 'post-id-1', userId: 'user-id-2',
        parentId: null, content: 'Ótimo post!', createdAt: new Date(),
      });

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'POST',
        url:     '/posts/comments',
        headers: { Authorization: `Bearer ${token}` },
        payload: { postId: 'post-id-1', content: 'Ótimo post!' },
      });

      expect(response.statusCode).toBe(201);
      expect(notificationService.create).toHaveBeenCalledWith({
        userId:  'user-id-1',
        actorId: 'user-id-2',
        type:    'POST_COMMENT',
        payload: {
          postId:    'post-id-1',
          commentId: 'c1',
          parentId:  null,
        },
      });
      await app.close();
    });
  });

  describe('DELETE /posts/:id', () => {
    it('retorna 200 deletando post do próprio usuário', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.deleteById).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'DELETE',
        url:     '/posts/post-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 403 deletando post de outro usuário', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'DELETE',
        url:     '/posts/post-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });
  });

});
