import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../helpers/build-app';

vi.mock('@/core/repositories/post.repository', () => ({
  postRepository: {
    create:              vi.fn(),
    findById:            vi.fn(),
    deleteById:          vi.fn(),
    findFeedByUserId:    vi.fn(),
    toggleInteraction:   vi.fn(),
    createComment:       vi.fn(),
    findCommentsByPostId: vi.fn(),
  },
}));

vi.mock('@/core/repositories/presence.repository', () => ({
  presenceRepository: {
    set:        vi.fn(),
    get:        vi.fn(),
    setOffline: vi.fn(),
  },
}));

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    findById:                vi.fn(),
    findByEmail:             vi.fn(),
    findByUsername:          vi.fn(),
    existsByEmailOrUsername: vi.fn(),
    create:                  vi.fn(),
  },
}));

vi.mock('@/core/repositories/profile.repository', () => ({
  profileRepository: {
    findFullProfileByUsername: vi.fn(),
    updateByUserId:            vi.fn(),
  },
}));

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    createRequest:       vi.fn(),
    findRequestById:     vi.fn(),
    existsRequest:       vi.fn(),
    existsFriendship:    vi.fn(),
    acceptRequest:       vi.fn(),
    removeFriendship:    vi.fn(),
    findFriendsByUserId: vi.fn(),
    findPendingRequests: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/steam/steam.service',  () => ({ steamService:  {} }));
vi.mock('@/infra/integrations/igdb/igdb.service',    () => ({ igdbService:   {} }));
vi.mock('@/infra/integrations/epic/epic.service',    () => ({ epicService:   {} }));

import { postRepository }     from '@/core/repositories/post.repository';
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
  ...mockPresenceOffline,
  status:      'IN_GAME' as const,
  currentGame: 'Valorant',
  platform:    'PC',
};

describe('Posts Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  // ── POST /posts ──────────────────────────────────────────
  describe('POST /posts', () => {

    it('retorna 201 com post criado', async () => {
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresenceOffline);
      vi.mocked(postRepository.create).mockResolvedValue(mockPost);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { contentText: 'Hello CLUTCH!' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ contentText: 'Hello CLUTCH!' });
      await app.close();
    });

    it('captura gameContext quando IN_GAME', async () => {
      vi.mocked(presenceRepository.get).mockResolvedValue(mockPresenceInGame);
      vi.mocked(postRepository.create).mockResolvedValue({
        ...mockPost,
        gameContext: { gameName: 'Valorant' },
      } as never);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { contentText: 'Jogando Valorant!' },
      });

      expect(response.statusCode).toBe(201);
      expect(postRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gameContext: expect.objectContaining({ gameName: 'Valorant' }),
        }),
      );
      await app.close();
    });

    it('retorna 400 sem conteúdo', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        headers: { 'x-user-id': 'user-id-1' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 401 sem header', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts',
        payload: { contentText: 'test' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

  });

  // ── GET /posts/feed/:userId ──────────────────────────────
  describe('GET /posts/feed/:userId', () => {

    it('retorna 200 com feed paginado', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(postRepository.findFeedByUserId).mockResolvedValue({
        posts: [], nextCursor: null,
      });

      const app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url:    '/posts/feed/user-id-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ posts: [], nextCursor: null });
      await app.close();
    });

    it('retorna 404 quando usuário não existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url:    '/posts/feed/inexistente',
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

  });

  // ── POST /posts/:id/interactions ─────────────────────────
  describe('POST /posts/:id/interactions', () => {

    it('retorna 200 adicionando reaction', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.toggleInteraction).mockResolvedValue({ added: true });

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts/post-id-1/interactions',
        headers: { 'x-user-id': 'user-id-2' },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ added: true });
      await app.close();
    });

    it('retorna 400 ao reagir ao próprio post', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts/post-id-1/interactions',
        headers: { 'x-user-id': 'user-id-1' },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 404 para post inexistente', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts/inexistente/interactions',
        headers: { 'x-user-id': 'user-id-2' },
        payload: { type: 'GG' },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

  });

  // ── POST /posts/comments ─────────────────────────────────
  describe('POST /posts/comments', () => {

    it('retorna 201 com comentário criado', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.createComment).mockResolvedValue({
        id: 'c1', postId: 'post-id-1', userId: 'user-id-2',
        parentId: null, content: 'Ótimo post!', createdAt: new Date(),
      });

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/posts/comments',
        headers: { 'x-user-id': 'user-id-2' },
        payload: { postId: 'post-id-1', content: 'Ótimo post!' },
      });

      expect(response.statusCode).toBe(201);
      await app.close();
    });

  });

  // ── DELETE /posts/:id ────────────────────────────────────
  describe('DELETE /posts/:id', () => {

    it('retorna 200 deletando post do próprio usuário', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);
      vi.mocked(postRepository.deleteById).mockResolvedValue(undefined);

      const app = await buildApp();
      const response = await app.inject({
        method:  'DELETE',
        url:     '/posts/post-id-1',
        headers: { 'x-user-id': 'user-id-1' },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 403 deletando post de outro usuário', async () => {
      vi.mocked(postRepository.findById).mockResolvedValue(mockPost);

      const app = await buildApp();
      const response = await app.inject({
        method:  'DELETE',
        url:     '/posts/post-id-1',
        headers: { 'x-user-id': 'user-id-2' },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });

  });

});