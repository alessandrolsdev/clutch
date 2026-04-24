import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsPageContent } from '@/components/settings/integrations-page-content';
import { useAuth } from '@/hooks/use-auth';
import { fetchProfileByUsername } from '@/services/profile';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/integrations',
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

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

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchProfileByUsername = vi.mocked(fetchProfileByUsername);

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

describe('IntegrationsPageContent', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedFetchProfileByUsername.mockReset();
  });

  it('renders integrations status including discord connection state', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchProfileByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'clutchplayer',
      createdAt: '2026-03-29T22:15:00.000Z',
      profile: {
        displayName: 'CLUTCH Player',
        bio: 'Bio',
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
        status: 'ONLINE',
        currentGame: null,
        gameDetails: null,
        platform: 'PC',
        updatedAt: '2026-03-29T22:15:00.000Z',
      },
      platformIntegrations: [
        { platform: 'STEAM', metadata: null },
        { platform: 'EPIC', metadata: null },
        {
          platform: 'DISCORD',
          metadata: {
            username: 'clutchplayer',
            globalName: 'CLUTCH Guild',
          },
        },
      ],
      gameLibrary: [
        {
          gameName: 'Counter-Strike 2',
          coverUrl: null,
          platform: 'STEAM',
          hoursPlayed: 100,
          lastPlayedAt: '2026-03-29T22:15:00.000Z',
        },
      ],
      socialContinuity: {
        currentStreakDays: 0,
        activeFriendOffensiveCount: 0,
        strongestFriendOffensive: null,
      },
      otakuShowcase: null,
    });

    renderWithQuery(<IntegrationsPageContent />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-integrations-success')).toBeInTheDocument();
    });

    expect(screen.getByText(/biblioteca steam/i)).toBeInTheDocument();
    expect(screen.getByText(/biblioteca epic games/i)).toBeInTheDocument();
    expect(screen.getByText(/^discord$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /vinculo discord e presence bridge/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconectar discord/i })).toBeInTheDocument();
    expect(screen.getByText(/conta vinculada: clutch guild/i)).toBeInTheDocument();
    expect(screen.queryByText(/ainda fora do contrato frontend atual/i)).not.toBeInTheDocument();
  });
});
