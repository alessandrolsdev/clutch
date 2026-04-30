import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsPageContent } from '@/components/settings/integrations-page-content';
import { useAuth } from '@/hooks/use-auth';
import { fetchConnectedAccounts } from '@/services/integrations';
import { fetchProfileByUsername } from '@/services/profile';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/integrations',
  useSearchParams: () => new URLSearchParams(),
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

vi.mock('@/services/integrations', () => ({
  connectEpic: vi.fn(),
  connectSteam: vi.fn(),
  fetchConnectedAccounts: vi.fn(),
  startDiscordOAuth: vi.fn(),
  syncSteamLibrary: vi.fn(),
  IntegrationsRequestError: class IntegrationsRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'IntegrationsRequestError';
      this.status = status;
    }
  },
}));

vi.mock('@/components/settings/connection-center', () => ({
  ConnectionCenter: () => <div data-testid="connection-center" />,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchProfileByUsername = vi.mocked(fetchProfileByUsername);
const mockedFetchConnectedAccounts = vi.mocked(fetchConnectedAccounts);

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
    mockedFetchConnectedAccounts.mockReset();
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
      platformIntegrations: [],
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
    mockedFetchConnectedAccounts.mockResolvedValue({
      providers: [
        {
          provider: 'STEAM',
          displayName: 'Steam',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          capabilities: ['CONNECTED_ACCOUNT', 'LIBRARY_IMPORT'],
        },
        {
          provider: 'EPIC',
          displayName: 'Epic Games',
          status: 'EXPERIMENTAL',
          dataSource: 'EXPERIMENTAL',
          capabilities: ['CONNECTED_ACCOUNT', 'TOKEN_CONNECT', 'LIBRARY_IMPORT'],
        },
        {
          provider: 'DISCORD',
          displayName: 'Discord',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
        },
      ],
      accounts: [
        {
          provider: 'STEAM',
          displayName: 'Steam',
          externalId: '76561198000000000',
          connectionType: 'CONNECTED_ACCOUNT',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          publicProfileVisible: false,
          connected: true,
          needsReauth: false,
          experimental: false,
          canUnlink: true,
          capabilities: ['CONNECTED_ACCOUNT', 'LIBRARY_IMPORT'],
          lastSyncAt: null,
          createdAt: '2026-04-29T10:00:00.000Z',
          updatedAt: '2026-04-29T10:00:00.000Z',
        },
        {
          provider: 'EPIC',
          displayName: 'Epic Games',
          externalId: 'epic:hash',
          connectionType: 'CONNECTED_ACCOUNT',
          status: 'NEEDS_REAUTH',
          dataSource: 'EXPERIMENTAL',
          publicProfileVisible: false,
          connected: false,
          needsReauth: true,
          experimental: true,
          canUnlink: true,
          capabilities: ['CONNECTED_ACCOUNT', 'TOKEN_CONNECT', 'LIBRARY_IMPORT'],
          lastSyncAt: null,
          createdAt: '2026-04-29T10:00:00.000Z',
          updatedAt: '2026-04-29T10:00:00.000Z',
        },
        {
          provider: 'DISCORD',
          displayName: 'Discord',
          externalId: 'discord-user-id',
          connectionType: 'CONNECTED_ACCOUNT',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          publicProfileVisible: false,
          connected: true,
          needsReauth: false,
          experimental: false,
          canUnlink: true,
          capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
          lastSyncAt: null,
          createdAt: '2026-04-29T10:00:00.000Z',
          updatedAt: '2026-04-29T10:00:00.000Z',
        },
      ],
    });

    renderWithQuery(<IntegrationsPageContent />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-integrations-success')).toBeInTheDocument();
    });

    expect(screen.getByText(/fallback manual steam/i)).toBeInTheDocument();
    expect(screen.getByText(/biblioteca epic games/i)).toBeInTheDocument();
    expect(screen.getByText(/^discord$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /vinculo discord e presence bridge/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconectar discord/i })).toBeInTheDocument();
    expect(screen.queryByText(/conta vinculada: clutch guild/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clutchplayer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ainda fora do contrato frontend atual/i)).not.toBeInTheDocument();
  });
});
