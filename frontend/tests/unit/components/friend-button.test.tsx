import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendButton } from '@/components/friends/friend-button';
import { ToastProvider } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import { type ProfileResponse } from '@/schemas/profile';
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

function createProfileFixture({
  id,
  username,
  friendCount,
}: {
  id: string;
  username: string;
  friendCount: number;
}): ProfileResponse {
  return {
    id,
    username,
    createdAt: '2026-03-29T22:15:00.000Z',
    profile: {
      displayName: username,
      bio: null,
      avatarUrl: null,
      bannerUrl: null,
      accentColor: '#7C3AED',
      badges: [],
    },
    stats: {
      level: 10,
      xp: 1000,
      reputation: 200,
      friendCount,
      postCount: 3,
    },
    presence: {
      status: 'ONLINE',
      currentGame: null,
      gameDetails: null,
      platform: 'PC',
      updatedAt: '2026-03-29T22:15:00.000Z',
    },
    platformIntegrations: [],
    gameLibrary: [],
    socialContinuity: {
      currentStreakDays: 0,
      activeFriendOffensiveCount: 0,
      strongestFriendOffensive: null,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function renderFriendButton(targetUserId = 'user-2') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <FriendButton targetUserId={targetUserId} />
      </QueryClientProvider>
    </ToastProvider>,
  );

  return { queryClient };
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
    const deferred = createDeferred<{ id: string; status: 'PENDING' }>();
    mockedSendFriendRequest.mockReturnValue(deferred.promise);

    renderFriendButton();

    fireEvent.click(await screen.findByRole('button', { name: /adicionar amigo/i }));

    expect(await screen.findByRole('button', { name: /pedido enviado/i })).toBeDisabled();

    deferred.resolve({
      id: 'request-1',
      status: 'PENDING',
    });

    await waitFor(() => {
      expect(mockedSendFriendRequest).toHaveBeenCalled();
    });
    expect(mockedSendFriendRequest.mock.calls[0]?.[0]).toBe('user-2');

    expect(await screen.findByRole('button', { name: /pedido enviado/i })).toBeDisabled();
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/pedido enviado/i);
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
    const deferred = createDeferred<void>();
    mockedAcceptFriendRequest.mockReturnValue(deferred.promise);

    const { queryClient } = renderFriendButton();
    queryClient.setQueryData(
      ['profile', 'clutchplayer'],
      createProfileFixture({
        id: 'user-1',
        username: 'clutchplayer',
        friendCount: 2,
      }),
    );
    queryClient.setQueryData(
      ['profile', 'pixelsamurai'],
      createProfileFixture({
        id: 'user-2',
        username: 'pixelsamurai',
        friendCount: 4,
      }),
    );
    queryClient.setQueryData(['friends', 'user-2'], []);

    fireEvent.click(await screen.findByRole('button', { name: /aceitar pedido/i }));

    expect(await screen.findByRole('button', { name: /^amigos$/i })).toBeDisabled();
    await waitFor(() => {
      expect(
        queryClient.getQueryData<ProfileResponse>(['profile', 'clutchplayer'])?.stats.friendCount,
      ).toBe(3);
      expect(
        queryClient.getQueryData<ProfileResponse>(['profile', 'pixelsamurai'])?.stats.friendCount,
      ).toBe(5);
      expect(queryClient.getQueryData<Array<{ id: string }>>(['friends', 'user-2'])).toEqual([
        expect.objectContaining({
          id: 'user-1',
          username: 'clutchplayer',
        }),
      ]);
    });

    await act(async () => {
      deferred.resolve();
    });

    await waitFor(() => {
      expect(mockedAcceptFriendRequest).toHaveBeenCalled();
    });
    expect(mockedAcceptFriendRequest.mock.calls[0]?.[0]).toBe('request-1');
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/amizade confirmada/i);
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
    const deferred = createDeferred<void>();
    mockedRemoveFriend.mockReturnValue(deferred.promise);

    const { queryClient } = renderFriendButton();
    queryClient.setQueryData(
      ['profile', 'clutchplayer'],
      createProfileFixture({
        id: 'user-1',
        username: 'clutchplayer',
        friendCount: 3,
      }),
    );
    queryClient.setQueryData(
      ['profile', 'pixelsamurai'],
      createProfileFixture({
        id: 'user-2',
        username: 'pixelsamurai',
        friendCount: 6,
      }),
    );
    queryClient.setQueryData(['friends', 'user-2'], [
      {
        id: 'user-1',
        username: 'clutchplayer',
        profile: null,
        presence: null,
      },
    ]);

    expect(await screen.findByRole('button', { name: /^amigos$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /remover/i }));

    expect(await screen.findByRole('button', { name: /adicionar amigo/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        queryClient.getQueryData<ProfileResponse>(['profile', 'clutchplayer'])?.stats.friendCount,
      ).toBe(2);
      expect(
        queryClient.getQueryData<ProfileResponse>(['profile', 'pixelsamurai'])?.stats.friendCount,
      ).toBe(5);
      expect(queryClient.getQueryData(['friends', 'user-2'])).toEqual([]);
    });

    await act(async () => {
      deferred.resolve();
    });

    await waitFor(() => {
      expect(mockedRemoveFriend).toHaveBeenCalled();
    });
    expect(mockedRemoveFriend.mock.calls[0]?.[0]).toBe('user-2');
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/amizade removida/i);
  });
});
