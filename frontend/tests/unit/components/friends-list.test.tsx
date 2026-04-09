import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendsList } from '@/components/friends/friends-list';
import { fetchFriends } from '@/services/friends';
import { resetPresenceStore, usePresenceStore } from '@/store/presence-store';

vi.mock('@/services/friends', () => ({
  fetchFriends: vi.fn(),
}));

const mockedFetchFriends = vi.mocked(fetchFriends);

function renderFriendsList() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <FriendsList userId="user-1" />
    </QueryClientProvider>,
  );
}

describe('FriendsList', () => {
  beforeEach(() => {
    mockedFetchFriends.mockReset();
    resetPresenceStore();
  });

  it('orders friends by presence priority', async () => {
    mockedFetchFriends.mockResolvedValue([
      {
        id: 'friend-3',
        username: 'offline',
        profile: { displayName: 'Offline', avatarUrl: null, accentColor: null },
        presence: { status: 'OFFLINE', currentGame: null, platform: null },
      },
      {
        id: 'friend-2',
        username: 'online',
        profile: { displayName: 'Online', avatarUrl: null, accentColor: null },
        presence: { status: 'ONLINE', currentGame: null, platform: null },
      },
      {
        id: 'friend-1',
        username: 'ingame',
        profile: { displayName: 'In Game', avatarUrl: null, accentColor: null },
        presence: { status: 'IN_GAME', currentGame: 'Valorant', platform: 'PC' },
      },
    ]);

    renderFriendsList();

    const items = await screen.findAllByTestId('friend-list-item');
    expect(items[0]).toHaveTextContent(/in game/i);
    expect(items[1]).toHaveTextContent(/online/i);
    expect(items[2]).toHaveTextContent(/offline/i);
  });

  it('reorders the list when realtime presence overrides the fetched snapshot', async () => {
    mockedFetchFriends.mockResolvedValue([
      {
        id: 'friend-1',
        username: 'offline',
        profile: { displayName: 'Offline', avatarUrl: null, accentColor: null },
        presence: { status: 'OFFLINE', currentGame: null, platform: null },
      },
      {
        id: 'friend-2',
        username: 'online',
        profile: { displayName: 'Online', avatarUrl: null, accentColor: null },
        presence: { status: 'ONLINE', currentGame: null, platform: null },
      },
    ]);

    usePresenceStore.getState().setConnectionStatus('connected');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'friend-1',
        status: 'IN_GAME',
        currentGame: 'Marvel Rivals',
        platform: 'PC',
      },
      123,
    );

    renderFriendsList();

    const items = await screen.findAllByTestId('friend-list-item');
    expect(items[0]).toHaveTextContent(/offline/i);
    expect(items[0]).toHaveTextContent(/jogando marvel rivals/i);
    expect(items[1]).toHaveTextContent(/online/i);
  });

  it('falls back to the backend snapshot when realtime is disconnected', async () => {
    mockedFetchFriends.mockResolvedValue([
      {
        id: 'friend-1',
        username: 'offline',
        profile: { displayName: 'Offline', avatarUrl: null, accentColor: null },
        presence: { status: 'OFFLINE', currentGame: null, platform: null },
      },
      {
        id: 'friend-2',
        username: 'online',
        profile: { displayName: 'Online', avatarUrl: null, accentColor: null },
        presence: { status: 'ONLINE', currentGame: null, platform: null },
      },
    ]);

    usePresenceStore.getState().setConnectionStatus('error', 'Realtime indisponivel');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'friend-1',
        status: 'IN_GAME',
        currentGame: 'Marvel Rivals',
        platform: 'PC',
      },
      123,
    );

    renderFriendsList();

    expect((await screen.findAllByText(/realtime indisponivel/i)).length).toBeGreaterThan(0);
    const items = await screen.findAllByTestId('friend-list-item');
    expect(items[0]).toHaveTextContent(/online/i);
    expect(items[1]).toHaveTextContent(/offline/i);
  });
});
