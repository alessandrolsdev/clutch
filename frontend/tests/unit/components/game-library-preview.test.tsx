import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameLibraryPreview } from '@/components/profile/game-library-preview';
import { type ProfileResponse } from '@/schemas/profile';

type GameFixture = ProfileResponse['gameLibrary'];

describe('GameLibraryPreview', () => {
  it('sorts the preview by recency and exposes social metadata already present in the contract', () => {
    const games: GameFixture = [
      {
        gameName: 'Old Ranked Match',
        coverUrl: null,
        platform: 'PC',
        hoursPlayed: 40,
        lastPlayedAt: '2026-03-20T10:00:00.000Z',
      },
      {
        gameName: 'Most Recent Session',
        coverUrl: null,
        platform: 'STEAM',
        hoursPlayed: 12,
        lastPlayedAt: '2026-03-30T10:00:00.000Z',
      },
      {
        gameName: 'Hours Only',
        coverUrl: null,
        platform: 'STEAM',
        hoursPlayed: 90,
        lastPlayedAt: null,
      },
    ];

    render(<GameLibraryPreview username="clutchplayer" games={games} />);

    expect(screen.getByTestId('game-library-preview')).toBeInTheDocument();
    expect(screen.getByText(/3 jogos no payload atual/i)).toBeInTheDocument();
    expect(screen.getByText(/2 plataformas/i)).toBeInTheDocument();
    expect(screen.getByText(/142h registradas/i)).toBeInTheDocument();

    const cards = screen.getAllByTestId('profile-library-game');
    expect(
      within(cards[0] as HTMLElement).getByText(/most recent session/i),
    ).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText(/30 de mar\. de 2026/i)).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText(/old ranked match/i)).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText(/hours only/i)).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText(/sem atividade recente/i)).toBeInTheDocument();
  });

  it('renders an honest empty state when no games are available', () => {
    render(<GameLibraryPreview username="clutchplayer" games={[]} />);

    expect(
      screen.getByText(/ainda nao ha jogos visiveis nesta biblioteca/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/horas ainda indisponiveis/i)).toBeInTheDocument();
  });
});
