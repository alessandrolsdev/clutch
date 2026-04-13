import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { NotificationsPageContent } from '@/components/notifications/notifications-page-content';
import { ToastProvider } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNotifications,
  markNotificationAsRead,
  NotificationsRequestError,
} from '@/services/notifications';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  NotificationsRequestError: class NotificationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'NotificationsRequestError';
      this.status = status;
    }
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchNotifications = vi.mocked(fetchNotifications);
const mockedMarkNotificationAsRead = vi.mocked(markNotificationAsRead);

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ToastProvider>,
  );
}

describe('Notifications social cache sync', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchNotifications.mockReset();
    mockedMarkNotificationAsRead.mockReset();

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
  });

  it('updates bell and page immediately when a notification is marked as read', async () => {
    const deferred = createDeferred<{
      id: string;
      userId: string;
      actorId: string | null;
      type: 'FRIEND_REQUEST';
      payload: { requestId: string; senderId: string };
      isRead: boolean;
      createdAt: string;
    }>();
    mockedMarkNotificationAsRead.mockReturnValue(deferred.promise);

    renderWithQuery(
      <>
        <NotificationsBell />
        <NotificationsPageContent />
      </>,
    );

    await screen.findByText(/seu inbox social/i);

    fireEvent.click(screen.getByRole('button', { name: /marcar como lida/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open notifications preview/i })).toHaveTextContent(
        '0',
      );
    });
    expect(screen.getByText(/^lida$/i)).toBeInTheDocument();

    await act(async () => {
      deferred.resolve({
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
    });

    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/notificacao atualizada/i);
  });

  it('rolls back the unread count when marking a notification as read fails', async () => {
    const deferred = createDeferred<never>();
    mockedMarkNotificationAsRead.mockReturnValue(deferred.promise);

    renderWithQuery(
      <>
        <NotificationsBell />
        <NotificationsPageContent />
      </>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /marcar como lida/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open notifications preview/i })).toHaveTextContent(
        '0',
      );
    });

    await act(async () => {
      deferred.reject(new NotificationsRequestError(503, 'Inbox indisponivel.'));
    });

    expect(await screen.findByTestId('toast-item')).toHaveTextContent(
      /nao foi possivel atualizar a notificacao/i,
    );
    expect(screen.getByRole('button', { name: /open notifications preview/i })).toHaveTextContent(
      '1',
    );
  });
});
