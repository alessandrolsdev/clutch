import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationItem } from '@/components/notifications/notification-item';

describe('NotificationItem', () => {
  it('renders a post comment notification with feed CTA and mark-as-read action', () => {
    const onMarkAsRead = vi.fn();

    render(
      <NotificationItem
        notification={{
          id: 'notification-1',
          userId: 'user-1',
          actorId: 'user-2',
          type: 'POST_COMMENT',
          payload: {
            postId: 'post-1',
            commentId: 'comment-1',
            parentId: null,
          },
          isRead: false,
          createdAt: '2026-03-31T10:00:00.000Z',
        }}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    expect(screen.getByText(/novo comentario no seu post/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver feed/i })).toHaveAttribute('href', '/feed');

    fireEvent.click(screen.getByRole('button', { name: /marcar como lida/i }));

    expect(onMarkAsRead).toHaveBeenCalledWith('notification-1');
  });

  it('renders a read friend accepted notification without mark-as-read action', () => {
    render(
      <NotificationItem
        notification={{
          id: 'notification-2',
          userId: 'user-1',
          actorId: 'user-2',
          type: 'FRIEND_ACCEPTED',
          payload: {
            requestId: 'request-1',
            friendId: 'user-2',
          },
          isRead: true,
          createdAt: '2026-03-31T10:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText(/pedido de amizade aceito/i)).toBeInTheDocument();
    expect(screen.getByText(/^lida$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como lida/i })).not.toBeInTheDocument();
  });
});
