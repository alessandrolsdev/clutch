import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPageContent } from '@/components/notifications/notifications-page-content';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchNotifications = vi.mocked(fetchNotifications);
const mockedMarkNotificationAsRead = vi.mocked(markNotificationAsRead);
const mockedMarkAllNotificationsAsRead = vi.mocked(markAllNotificationsAsRead);

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('NotificationsPageContent', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchNotifications.mockReset();
    mockedMarkNotificationAsRead.mockReset();
    mockedMarkAllNotificationsAsRead.mockReset();
  });

  it('renders loading state while auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      status: 'loading',
      user: null,
      logout: vi.fn(),
    });

    renderWithQuery(<NotificationsPageContent />);

    expect(screen.getByTestId('notifications-loading')).toBeInTheDocument();
  });

  it('renders notifications on success and marks all as read', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchNotifications.mockResolvedValue({
      notifications: [
        {
          id: 'notification-1',
          userId: 'user-1',
          actorId: 'user-2',
          type: 'POST_LIKE',
          payload: {
            postId: 'post-1',
            interactionType: 'GG',
          },
          isRead: false,
          createdAt: '2026-03-31T10:00:00.000Z',
        },
      ],
      unreadCount: 1,
    });
    mockedMarkAllNotificationsAsRead.mockResolvedValue(undefined);

    renderWithQuery(<NotificationsPageContent />);

    expect(await screen.findByText(/nova reaction no seu post/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /marcar todas como lidas/i }));

    await waitFor(() => {
      expect(mockedMarkAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

  it('marks a single notification as read from the list', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
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
    mockedMarkNotificationAsRead.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-1',
      actorId: 'user-2',
      type: 'FRIEND_REQUEST',
      payload: {
        requestId: 'request-1',
        senderId: 'user-2',
      },
      isRead: true,
      createdAt: '2026-03-31T10:00:00.000Z',
    });

    renderWithQuery(<NotificationsPageContent />);

    fireEvent.click(await screen.findByRole('button', { name: /marcar como lida/i }));

    await waitFor(() => {
      expect(mockedMarkNotificationAsRead).toHaveBeenCalled();
    });

    expect(mockedMarkNotificationAsRead.mock.calls[0]?.[0]).toBe('notification-1');
  });

  it('renders empty state when there are no notifications', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    renderWithQuery(<NotificationsPageContent />);

    expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
  });

  it('renders generic error state when notifications request fails', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchNotifications.mockRejectedValue(new Error('network'));

    renderWithQuery(<NotificationsPageContent />);

    expect(await screen.findByTestId('notifications-error')).toBeInTheDocument();
  });
});
