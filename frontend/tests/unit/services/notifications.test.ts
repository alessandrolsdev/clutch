import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('notifications service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('returns parsed notifications list', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          notifications: [
            {
              id: 'notification-1',
              userId: 'user-1',
              actorId: 'user-2',
              type: 'FRIEND_REQUEST',
              payload: {
                requestId: 'request-1',
                senderId: 'user-2',
              },
              isRead: false,
              createdAt: '2026-03-31T10:00:00.000Z',
            },
          ],
          unreadCount: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await fetchNotifications({ userId: 'user-1' });

    expect(response.unreadCount).toBe(1);
    expect(response.notifications).toHaveLength(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/notifications/user-1', {
      method: 'GET',
    });
  });

  it('supports unread-only notifications query', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({ notifications: [], unreadCount: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await fetchNotifications({ userId: 'user-1', unreadOnly: true });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/notifications/user-1?unreadOnly=true',
      { method: 'GET' },
    );
  });

  it('marks a single notification as read', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'notification-1',
          userId: 'user-1',
          actorId: 'user-2',
          type: 'POST_COMMENT',
          payload: {
            postId: 'post-1',
            commentId: 'comment-1',
            parentId: null,
          },
          isRead: true,
          createdAt: '2026-03-31T10:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await markNotificationAsRead('notification-1');

    expect(response.isRead).toBe(true);
    expect(mockedApiRequest).toHaveBeenCalledWith('/notifications/notification-1/read', {
      method: 'PATCH',
    });
  });

  it('marks all notifications as read', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Todas as notificacoes marcadas como lidas.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await markAllNotificationsAsRead();

    expect(mockedApiRequest).toHaveBeenCalledWith('/notifications/read-all', {
      method: 'PATCH',
    });
  });
});
