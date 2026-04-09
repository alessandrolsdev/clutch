import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendRequestCard } from '@/components/friends/friend-request-card';
import { ToastProvider } from '@/components/ui/toaster';
import { acceptFriendRequest } from '@/services/friends';

vi.mock('@/services/friends', () => ({
  acceptFriendRequest: vi.fn(),
  FriendsRequestError: class FriendsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'FriendsRequestError';
      this.status = status;
    }
  },
}));

const mockedAcceptFriendRequest = vi.mocked(acceptFriendRequest);

function renderFriendRequestCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <FriendRequestCard
          receiverUserId="user-1"
          request={{
            id: 'request-1',
            createdAt: '2026-03-31T10:00:00.000Z',
            sender: {
              id: 'user-2',
              username: 'pixelsamurai',
              profile: {
                displayName: 'Pixel Samurai',
                avatarUrl: null,
              },
            },
          }}
        />
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe('FriendRequestCard', () => {
  beforeEach(() => {
    mockedAcceptFriendRequest.mockReset();
  });

  it('accepts a pending request', async () => {
    mockedAcceptFriendRequest.mockResolvedValue(undefined);

    renderFriendRequestCard();

    fireEvent.click(screen.getByRole('button', { name: /aceitar pedido/i }));

    await waitFor(() => {
      expect(mockedAcceptFriendRequest).toHaveBeenCalled();
    });
    expect(mockedAcceptFriendRequest.mock.calls[0]?.[0]).toBe('request-1');
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/pedido aceito/i);
  });
});
