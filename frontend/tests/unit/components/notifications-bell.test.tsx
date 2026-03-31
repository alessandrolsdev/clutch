import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNotifications,
} from '@/services/notifications';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchNotifications = vi.mocked(fetchNotifications);

function renderNotificationsBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsBell />
    </QueryClientProvider>,
  );
}

describe('NotificationsBell', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchNotifications.mockReset();

    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
  });

  it('renders the unread notifications count and opens the dropdown', async () => {
    mockedFetchNotifications.mockResolvedValue({
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
    });

    renderNotificationsBell();

    expect(await screen.findByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open notifications preview/i }));

    expect(await screen.findByText(/activity inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/pedido de amizade recebido/i)).toBeInTheDocument();
  });
});
