import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryPageContent } from '@/components/library/library-page-content';
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
    status: 'ONLINE',
    currentGame: null,
    gameDetails: null,
    platform: 'PC',
    updatedAt: '2026-03-29T22:15:00.000Z',
  },
  platformIntegrations: [
    { platform: 'STEAM', metadata: null },
    { platform: 'EPIC', metadata: null },
  ],
  gameLibrary: [
    {
      gameName: 'Counter-Strike 2',
      coverUrl: null,
      platform: 'STEAM',
      hoursPlayed: 980,
      lastPlayedAt: '2026-03-30T10:00:00.000Z',
    },
    {
      gameName: 'Fortnite',
      coverUrl: null,
      platform: 'EPIC',
      hoursPlayed: 12,
      lastPlayedAt: '2026-03-29T10:00:00.000Z',
    },
    {
      gameName: 'Valorant',
      coverUrl: null,
      platform: 'PC',
      hoursPlayed: 120,
      lastPlayedAt: '2026-03-28T10:00:00.000Z',
    },
    {
      gameName: 'Dota 2',
      coverUrl: null,
      platform: 'STEAM',
      hoursPlayed: 45,
      lastPlayedAt: '2026-03-27T10:00:00.000Z',
    },
  ],
  socialContinuity: {
    currentStreakDays: 0,
    activeFriendOffensiveCount: 0,
    strongestFriendOffensive: null,
  },
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

describe('LibraryPageContent', () => {
  beforeEach(() => {
    mockedFetchProfile.mockReset();
  });

  it('renders loading state while profile is pending', () => {
    mockedFetchProfile.mockImplementation(
      () =>
        new Promise(() => {
          return undefined;
        }),
    );

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    expect(screen.getByTestId('library-loading')).toBeInTheDocument();
  });

  it('renders the library grid with real profile data', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-success')).toBeInTheDocument();
    });

    expect(screen.getByText(/biblioteca de @clutchplayer/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1157h')).toBeInTheDocument();
    expect(screen.getByText(/exibindo 4 de 4 jogos/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('library-game-card')).toHaveLength(4);
  });

  it('renders every library item returned by the profile contract, including more than 10 games', async () => {
    mockedFetchProfile.mockResolvedValue({
      ...profileFixture,
      gameLibrary: Array.from({ length: 12 }, (_, index) => ({
        gameName: `Game ${index + 1}`,
        coverUrl: null,
        platform: 'STEAM',
        hoursPlayed: index + 1,
        lastPlayedAt: `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      })),
    });

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('library-game-card')).toHaveLength(12);
  });

  it('filters the library by platform', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /steam \(2\)/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId('library-game-card')).toHaveLength(2);
    });

    expect(screen.getByText(/plataforma: steam/i)).toBeInTheDocument();
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
    expect(screen.getByText('Dota 2')).toBeInTheDocument();
    expect(screen.queryByText('Fortnite')).not.toBeInTheDocument();
  });

  it('filters the library by local search', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/counter-strike 2/i), {
      target: { value: 'fort' },
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('library-game-card')).toHaveLength(1);
    });

    expect(screen.getByText('Fortnite')).toBeInTheDocument();
  });

  it('sorts the library alphabetically when requested', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /alfabetica/i }));

    await waitFor(() => {
      const cards = screen.getAllByTestId('library-game-card');
      expect(within(cards[0] as HTMLElement).getByText('Counter-Strike 2')).toBeInTheDocument();
      expect(within(cards[1] as HTMLElement).getByText('Dota 2')).toBeInTheDocument();
    });
  });

  it('renders empty state when the profile has no games', async () => {
    mockedFetchProfile.mockResolvedValue({
      ...profileFixture,
      gameLibrary: [],
    });

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/biblioteca vazia/i)).toBeInTheDocument();
  });

  it('renders a distinct empty state when filters remove all current results', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/counter-strike 2/i), {
      target: { value: 'zzz' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/nenhum jogo corresponde aos filtros atuais/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /limpar refinamentos/i })).toHaveLength(2);
  });

  it('clears active refinements and restores the full library grid', async () => {
    mockedFetchProfile.mockResolvedValue(profileFixture);

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/counter-strike 2/i), {
      target: { value: 'fort' },
    });

    fireEvent.click(screen.getByRole('button', { name: /epic \(1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /alfabetica/i }));

    await waitFor(() => {
      expect(screen.getByText(/busca: fort/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /limpar refinamentos/i })[0] as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/exibindo 4 de 4 jogos/i)).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('library-game-card')).toHaveLength(4);
    expect(screen.queryByText(/busca: fort/i)).not.toBeInTheDocument();
  });

  it('keeps sorting deterministic when hours and last activity are missing', async () => {
    mockedFetchProfile.mockResolvedValue({
      ...profileFixture,
      gameLibrary: [
        {
          gameName: 'Bravo Game',
          coverUrl: null,
          platform: 'STEAM',
          hoursPlayed: null,
          lastPlayedAt: null,
        },
        {
          gameName: 'Alpha Game',
          coverUrl: null,
          platform: 'STEAM',
          hoursPlayed: null,
          lastPlayedAt: null,
        },
      ],
    });

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-grid')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('library-game-card');
    expect(within(cards[0] as HTMLElement).getByText('Alpha Game')).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText('Bravo Game')).toBeInTheDocument();
    expect(screen.getAllByText(/sem capa/i)).toHaveLength(2);
    expect(screen.getAllByText(/horas indisponiveis/i)).toHaveLength(2);
  });

  it('renders error state when the profile request fails', async () => {
    mockedFetchProfile.mockRejectedValue(
      new ProfileRequestError(503, 'Nao foi possivel carregar o perfil agora.'),
    );

    renderWithQuery(<LibraryPageContent username="clutchplayer" />);

    await waitFor(() => {
      expect(screen.getByTestId('library-error')).toBeInTheDocument();
    });
  });
});
