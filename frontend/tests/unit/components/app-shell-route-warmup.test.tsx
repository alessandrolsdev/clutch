import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellRouteWarmup } from '@/components/layout/app-shell-route-warmup';
import { useAuth } from '@/hooks/use-auth';
import { fetchFeed } from '@/services/feed';
import { fetchFriends } from '@/services/friends';
import { fetchNotifications } from '@/services/notifications';
import { fetchProfileByUsername } from '@/services/profile';

const prefetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: prefetchMock,
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/feed', () => ({
  fetchFeed: vi.fn(),
}));

vi.mock('@/services/friends', () => ({
  fetchFriends: vi.fn(),
}));

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
}));

vi.mock('@/services/profile', () => ({
  fetchProfileByUsername: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchFeed = vi.mocked(fetchFeed);
const mockedFetchFriends = vi.mocked(fetchFriends);
const mockedFetchNotifications = vi.mocked(fetchNotifications);
const mockedFetchProfileByUsername = vi.mocked(fetchProfileByUsername);

function renderWarmup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AppShellRouteWarmup />
    </QueryClientProvider>,
  );
}

describe('AppShellRouteWarmup', () => {
  beforeEach(() => {
    prefetchMock.mockReset();
    mockedUseAuth.mockReset();
    mockedFetchFeed.mockReset();
    mockedFetchFriends.mockReset();
    mockedFetchNotifications.mockReset();
    mockedFetchProfileByUsername.mockReset();

    mockedFetchFeed.mockResolvedValue({
      posts: [],
      nextCursor: null,
    });
    mockedFetchFriends.mockResolvedValue([]);
    mockedFetchNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });
    mockedFetchProfileByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'clutchplayer',
      createdAt: '2026-04-12T00:00:00.000Z',
      profile: {
        displayName: 'Clutch Player',
        bio: null,
        avatarUrl: null,
        bannerUrl: null,
        accentColor: '#7C3AED',
        badges: [],
      },
      stats: {
        level: 7,
        xp: 700,
        reputation: 12,
        friendCount: 0,
        postCount: 0,
      },
      presence: {
        status: 'ONLINE',
        currentGame: null,
        gameDetails: null,
        platform: 'WEB',
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      platformIntegrations: [],
      gameLibrary: [],
      socialContinuity: {
        currentStreakDays: 0,
        activeFriendOffensiveCount: 0,
        strongestFriendOffensive: null,
      },
    });
  });

  it('prefetches hot routes and key shell queries for an authenticated user', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });

    renderWarmup();

    await waitFor(() => {
      expect(prefetchMock).toHaveBeenCalledWith('/feed');
      expect(prefetchMock).toHaveBeenCalledWith('/notifications');
      expect(prefetchMock).toHaveBeenCalledWith('/settings');
      expect(prefetchMock).toHaveBeenCalledWith('/clutchplayer');
    });

    await waitFor(() => {
      expect(mockedFetchFeed).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: undefined,
      });
      expect(mockedFetchNotifications).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockedFetchProfileByUsername).toHaveBeenCalledWith('clutchplayer');
      expect(mockedFetchFriends).toHaveBeenCalledWith('user-1');
    });
  });

  it('does not prefetch while the session is still loading', () => {
    mockedUseAuth.mockReturnValue({
      status: 'loading',
      user: null,
      logout: vi.fn(),
    });

    renderWarmup();

    expect(prefetchMock).not.toHaveBeenCalled();
    expect(mockedFetchFeed).not.toHaveBeenCalled();
    expect(mockedFetchNotifications).not.toHaveBeenCalled();
    expect(mockedFetchProfileByUsername).not.toHaveBeenCalled();
    expect(mockedFetchFriends).not.toHaveBeenCalled();
  });
});
