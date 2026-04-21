import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
    expect(
      within(within(items[0] as HTMLElement).getByTestId('presence-badge')).getByText(/^jogando$/i),
    ).toBeInTheDocument();
    expect(
      within(within(items[1] as HTMLElement).getByTestId('presence-badge')).getByText(/^online$/i),
    ).toBeInTheDocument();
    expect(
      within(within(items[2] as HTMLElement).getByTestId('presence-badge')).getByText(/^offline$/i),
    ).toBeInTheDocument();
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
    const firstPresenceBadge = within(items[0] as HTMLElement).getByTestId('presence-badge');
    const secondPresenceBadge = within(items[1] as HTMLElement).getByTestId('presence-badge');

    expect(within(firstPresenceBadge).getByText(/^jogando$/i)).toBeInTheDocument();
    expect(within(firstPresenceBadge).getByText(/jogando marvel rivals/i)).toBeInTheDocument();
    expect(within(firstPresenceBadge).getByText(/^via pc$/i)).toBeInTheDocument();
    expect(within(secondPresenceBadge).getByText(/^online$/i)).toBeInTheDocument();
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

    expect((await screen.findAllByText(/atualizacoes ao vivo indisponiveis/i)).length).toBeGreaterThan(0);
    const items = await screen.findAllByTestId('friend-list-item');
    expect(
      within(within(items[0] as HTMLElement).getByTestId('presence-badge')).getByText(/^online$/i),
    ).toBeInTheDocument();
    expect(
      within(within(items[1] as HTMLElement).getByTestId('presence-badge')).getByText(/^offline$/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/marvel rivals/i)).not.toBeInTheDocument();
  });
});
