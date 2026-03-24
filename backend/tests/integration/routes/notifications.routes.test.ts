import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/notification.repository', () => ({
  notificationRepository: {
    findByUserId: vi.fn(), findById: vi.fn(),
    markAsRead: vi.fn(), markAllAsRead: vi.fn(), create: vi.fn(),
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

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    createRequest: vi.fn(), findRequestById: vi.fn(), existsRequest: vi.fn(),
    existsFriendship: vi.fn(), acceptRequest: vi.fn(), removeFriendship: vi.fn(),
    findFriendsByUserId: vi.fn(), findPendingRequests: vi.fn(),
  },
}));

vi.mock('@/core/repositories/presence.repository', () => ({
  presenceRepository: { set: vi.fn(), get: vi.fn(), setOffline: vi.fn() },
}));

vi.mock('@/core/repositories/post.repository', () => ({
  postRepository: {
    create: vi.fn(), findById: vi.fn(), deleteById: vi.fn(),
    findFeedByUserId: vi.fn(), toggleInteraction: vi.fn(),
    createComment: vi.fn(), findCommentsByPostId: vi.fn(),
  },
}));

vi.mock('@/infra/integrations/steam/steam.service',  () => ({ steamService:  {} }));
vi.mock('@/infra/integrations/igdb/igdb.service',    () => ({ igdbService:   {} }));
vi.mock('@/infra/integrations/epic/epic.service',    () => ({ epicService:   {} }));

import { notificationRepository } from '@/core/repositories/notification.repository';

const mockNotification = {
  id: 'notif-id-1', userId: 'user-id-1', actorId: 'user-id-2',
  type: 'FRIEND_REQUEST' as never, payload: {}, isRead: false, createdAt: new Date(),
};

describe('Notifications Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('GET /notifications/:userId', () => {
    it('retorna 200 com notificações e unreadCount', async () => {
      vi.mocked(notificationRepository.findByUserId).mockResolvedValue({
        notifications: [mockNotification], unreadCount: 1,
      });

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'GET',
        url:     '/notifications/user-id-1',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ unreadCount: 1 });
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/notifications/user-id-1' });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 403 consultando notificações de outro usuário', async () => {
      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'GET',
        url:     '/notifications/user-id-2',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('retorna 200 marcando todas como lidas', async () => {
      vi.mocked(notificationRepository.markAllAsRead).mockResolvedValue(undefined);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/notifications/read-all',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('retorna 200 marcando como lida', async () => {
      vi.mocked(notificationRepository.findById).mockResolvedValue(mockNotification);
      vi.mocked(notificationRepository.markAsRead).mockResolvedValue({ ...mockNotification, isRead: true });

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/notifications/notif-id-1/read',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('retorna 404 para notificação inexistente', async () => {
      vi.mocked(notificationRepository.findById).mockResolvedValue(null);

      const app   = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method:  'PATCH',
        url:     '/notifications/inexistente/read',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

});