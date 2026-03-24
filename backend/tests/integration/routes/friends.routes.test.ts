import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    createRequest: vi.fn(), findRequestById: vi.fn(), existsRequest: vi.fn(),
    existsFriendship: vi.fn(), acceptRequest: vi.fn(), removeFriendship: vi.fn(),
    findFriendsByUserId: vi.fn(), findPendingRequests: vi.fn(),
  },
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

vi.mock('@/infra/integrations/steam/steam.service',  () => ({ steamService:  {} }));
vi.mock('@/infra/integrations/igdb/igdb.service',    () => ({ igdbService:   {} }));
vi.mock('@/infra/integrations/epic/epic.service',    () => ({ epicService:   {} }));

import { friendRepository } from '@/core/repositories/friend.repository';
import { userRepository }   from '@/core/repositories/user.repository';

const mockUser = {
  id: 'user-id-1', username: 'clutchplayer', email: 'player@clutch.gg',
  password_hash: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

const mockRequest = {
  id: 'request-id-1', senderId: 'user-id-1', receiverId: 'user-id-2',
  status: 'PENDING' as const, createdAt: new Date(), updatedAt: new Date(),
};

describe('Friends Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('POST /friends/request/:targetId', () => {
    it('retorna 201 com dados válidos', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue({ ...mockUser, id: 'user-id-2' });
      vi.mocked(friendRepository.existsFriendship).mockResolvedValue(false);
      vi.mocked(friendRepository.existsRequest).mockResolvedValue(false);
      vi.mocked(friendRepository.createRequest).mockResolvedValue(mockRequest);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/request/user-id-2',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(201);
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'POST', url: '/friends/request/user-id-2' });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 400 enviando pedido para si mesmo', async () => {
      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/request/user-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 404 quando target não existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/request/user-id-999',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it('retorna 409 quando pedido já existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue({ ...mockUser, id: 'user-id-2' });
      vi.mocked(friendRepository.existsFriendship).mockResolvedValue(false);
      vi.mocked(friendRepository.existsRequest).mockResolvedValue(true);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/request/user-id-2',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(409);
      await app.close();
    });
  });

  describe('POST /friends/accept/:requestId', () => {
    it('retorna 200 aceitando pedido válido', async () => {
      vi.mocked(friendRepository.findRequestById).mockResolvedValue(mockRequest);
      vi.mocked(friendRepository.acceptRequest).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/accept/request-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 403 quando remetente tenta aceitar', async () => {
      vi.mocked(friendRepository.findRequestById).mockResolvedValue(mockRequest);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/accept/request-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });

    it('retorna 404 quando pedido não existe', async () => {
      vi.mocked(friendRepository.findRequestById).mockResolvedValue(null);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-2');

      const response = await app.inject({
        method:  'POST',
        url:     '/friends/accept/inexistente',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('DELETE /friends/:friendId', () => {
    it('retorna 200 removendo amizade existente', async () => {
      vi.mocked(friendRepository.existsFriendship).mockResolvedValue(true);
      vi.mocked(friendRepository.removeFriendship).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'DELETE',
        url:     '/friends/user-id-2',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 404 quando amizade não existe', async () => {
      vi.mocked(friendRepository.existsFriendship).mockResolvedValue(false);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'DELETE',
        url:     '/friends/user-id-999',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('GET /friends/requests/:userId', () => {
    it('retorna 200 com pedidos pendentes', async () => {
      vi.mocked(friendRepository.findPendingRequests).mockResolvedValue([]);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'GET',
        url:     '/friends/requests/user-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 403 consultando pedidos de outro usuário', async () => {
      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'GET',
        url:     '/friends/requests/user-id-2',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('GET /friends/:userId', () => {
    it('retorna 200 com lista de amigos', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(friendRepository.findFriendsByUserId).mockResolvedValue([]);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/friends/user-id-1' });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 404 quando usuário não existe', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/friends/inexistente' });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

});