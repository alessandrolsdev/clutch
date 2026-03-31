import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePageContent } from '@/components/profile/profile-page-content';
import {
  fetchProfileByUsername,
  ProfileRequestError,
} from '@/services/profile';
import { type ProfileResponse } from '@/schemas/profile';

vi.mock('@/services/profile', () => ({
  fetchProfileByUsername: vi.fn(),
  ProfileRequestError: class ProfileRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'ProfileRequestError';
      this.status = status;
    }
  },
}));

vi.mock('@/components/friends/friend-button', () => ({
  FriendButton: ({ targetUserId }: { targetUserId: string }) => (
    <div data-testid="friend-button">friend-button:{targetUserId}</div>
  ),
}));

vi.mock('@/components/friends/friends-list', () => ({
  FriendsList: ({ userId }: { userId: string }) => (
    <div data-testid="friends-list">friends-list:{userId}</div>
  ),
}));

const mockedFetchProfile = vi.mocked(fetchProfileByUsername);

const profileFixture: ProfileResponse = {
  id: 'user-1',
  username: 'clutchplayer',
  createdAt: '2026-03-29T22:15:00.000Z',
  profile: {
    displayName: 'CLUTCH Player',
    bio: 'Bio de teste',
    avatarUrl: null,
    bannerUrl: null,
    accentColor: '#7C3AED',
    badges: ['Founder'],
  },
  stats: {
    level: 18,
    xp: 4820,
    reputation: 215,
    friendCount: 2,
    postCount: 2,
  },
  presence: {
    status: 'IN_GAME',
    currentGame: 'Valorant',
    gameDetails: null,
    platform: 'PC',
    updatedAt: '2026-03-29T22:15:00.000Z',
  },
  platformIntegrations: [
    {
      platform: 'STEAM',
      metadata: null,
    },
  ],
  gameLibrary: [
    {
      gameName: 'Valorant',
      coverUrl: null,
      platform: 'PC',
      hoursPlayed: 120,
      lastPlayedAt: '2026-03-29T22:15:00.000Z',
    },
  ],
};

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ProfilePageContent', () => {
  beforeEach(() => {
    mockedFetchProfile.mockReset();
  });

  it('renders loading state', () => {
    mockedFetchProfile.mockImplementation(
      () =>
        new Promise(() => {
          return undefined;
        }),
    );

    renderWithQuery(<ProfilePageContent username="clutchplayer" />);

    expect(screen.getByTestId('profile-loading')).toBeInTheDocument();
  });

  it('renders success state', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<ProfilePageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-success')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { name: /clutch player/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/jogando valorant/i)).toBeInTheDocument();
    expect(screen.getByTestId('friend-button')).toHaveTextContent('friend-button:user-1');
    expect(screen.getByTestId('friends-list')).toHaveTextContent('friends-list:user-1');
  });

  it('renders not found state', async () => {
    mockedFetchProfile.mockRejectedValue(
      new ProfileRequestError(404, 'Perfil nao encontrado.'),
    );

    renderWithQuery(<ProfilePageContent username="unknownuser" />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-not-found')).toBeInTheDocument();
    });
  });

  it('renders generic error state', async () => {
    mockedFetchProfile.mockRejectedValue(new Error('network'));

    renderWithQuery(<ProfilePageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-error')).toBeInTheDocument();
    });
  });
});
