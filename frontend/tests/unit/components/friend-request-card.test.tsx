import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendRequestCard } from '@/components/friends/friend-request-card';
import { ToastProvider } from '@/components/ui/toaster';
import { type ProfileResponse } from '@/schemas/profile';
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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
          receiverUsername="clutchplayer"
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

  return { queryClient };
}

describe('FriendRequestCard', () => {
  beforeEach(() => {
    mockedAcceptFriendRequest.mockReset();
  });

  it('accepts a pending request', async () => {
    const deferred = createDeferred<void>();
    mockedAcceptFriendRequest.mockReturnValue(deferred.promise);

    const { queryClient } = renderFriendRequestCard();
    queryClient.setQueryData(
      ['profile', 'clutchplayer'],
      createProfileFixture({
        id: 'user-1',
        username: 'clutchplayer',
        friendCount: 1,
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

    fireEvent.click(screen.getByRole('button', { name: /aceitar pedido/i }));
    await waitFor(() => {
      expect(
        queryClient.getQueryData<ProfileResponse>(['profile', 'clutchplayer'])?.stats.friendCount,
      ).toBe(2);
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
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(/pedido aceito/i);
  });
});
