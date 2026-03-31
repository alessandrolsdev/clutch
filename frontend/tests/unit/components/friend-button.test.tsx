import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendButton } from '@/components/friends/friend-button';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchPendingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from '@/services/friends';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/friends', () => ({
  fetchFriends: vi.fn(),
  fetchPendingFriendRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  FriendsRequestError: class FriendsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'FriendsRequestError';
      this.status = status;
    }
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchFriends = vi.mocked(fetchFriends);
const mockedFetchPendingFriendRequests = vi.mocked(fetchPendingFriendRequests);
const mockedSendFriendRequest = vi.mocked(sendFriendRequest);
const mockedAcceptFriendRequest = vi.mocked(acceptFriendRequest);
const mockedRemoveFriend = vi.mocked(removeFriend);

function renderFriendButton(targetUserId = 'user-2') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <FriendButton targetUserId={targetUserId} />
    </QueryClientProvider>,
  );
}

describe('FriendButton', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchFriends.mockReset();
    mockedFetchPendingFriendRequests.mockReset();
    mockedSendFriendRequest.mockReset();
    mockedAcceptFriendRequest.mockReset();
    mockedRemoveFriend.mockReset();

    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchFriends.mockResolvedValue([]);
    mockedFetchPendingFriendRequests.mockResolvedValue([]);
  });

  it('renders the own-profile state', async () => {
    renderFriendButton('user-1');

    expect(await screen.findByRole('button', { name: /seu perfil/i })).toBeDisabled();
  });

  it('sends a friend request from the default state', async () => {
    mockedSendFriendRequest.mockResolvedValue({
      id: 'request-1',
      status: 'PENDING',
    });

    renderFriendButton();

    fireEvent.click(await screen.findByRole('button', { name: /adicionar amigo/i }));

    await waitFor(() => {
      expect(mockedSendFriendRequest).toHaveBeenCalled();
    });
    expect(mockedSendFriendRequest.mock.calls[0]?.[0]).toBe('user-2');

    expect(await screen.findByRole('button', { name: /pedido enviado/i })).toBeDisabled();
  });

  it('accepts an incoming request state', async () => {
    mockedFetchPendingFriendRequests.mockResolvedValue([
      {
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
      },
    ]);
    mockedAcceptFriendRequest.mockResolvedValue(undefined);

    renderFriendButton();

    fireEvent.click(await screen.findByRole('button', { name: /aceitar pedido/i }));

    await waitFor(() => {
      expect(mockedAcceptFriendRequest).toHaveBeenCalled();
    });
    expect(mockedAcceptFriendRequest.mock.calls[0]?.[0]).toBe('request-1');
  });

  it('renders the friend state and removes friendship', async () => {
    mockedFetchFriends.mockResolvedValue([
      {
        id: 'user-2',
        username: 'pixelsamurai',
        profile: {
          displayName: 'Pixel Samurai',
          avatarUrl: null,
          accentColor: '#06B6D4',
        },
        presence: {
          status: 'ONLINE',
          currentGame: null,
          platform: 'PC',
        },
      },
    ]);
    mockedRemoveFriend.mockResolvedValue(undefined);

    renderFriendButton();

    expect(await screen.findByRole('button', { name: /^amigos$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /remover/i }));

    await waitFor(() => {
      expect(mockedRemoveFriend).toHaveBeenCalled();
    });
    expect(mockedRemoveFriend.mock.calls[0]?.[0]).toBe('user-2');
  });
});
