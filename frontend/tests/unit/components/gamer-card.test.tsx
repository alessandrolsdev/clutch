import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GamerCard } from '@/components/profile/gamer-card';
import { type ProfileResponse } from '@/schemas/profile';
import { resetPresenceStore, usePresenceStore } from '@/store/presence-store';

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
    status: 'OFFLINE',
    currentGame: null,
    gameDetails: null,
    platform: null,
    updatedAt: '2026-03-29T22:15:00.000Z',
  },
  platformIntegrations: [],
  gameLibrary: [],
};

describe('GamerCard', () => {
  beforeEach(() => {
    resetPresenceStore();
  });

  it('overrides static profile presence with realtime store data', () => {
    usePresenceStore.getState().setConnectionStatus('connected');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'user-1',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        platform: 'PC',
      },
      123,
    );

    render(<GamerCard profile={profileFixture} />);

    expect(screen.getByText(/in game/i)).toBeInTheDocument();
    expect(screen.getByText(/jogando valorant/i)).toBeInTheDocument();
    expect(screen.getByText(/plataforma atual: pc/i)).toBeInTheDocument();
    expect(screen.getByText(/nivel 18/i)).toBeInTheDocument();
    expect(screen.getByText(/founder/i)).toBeInTheDocument();
    const platformsSection = screen.getByTestId('profile-platform-badges');
    expect(
      within(platformsSection).getByText(/^plataformas conectadas$/i),
    ).toBeInTheDocument();
    expect(
      within(platformsSection).getByText(/sem plataformas conectadas visiveis neste perfil/i),
    ).toBeInTheDocument();
  });

  it('falls back to the backend snapshot when realtime is not connected', () => {
    usePresenceStore.getState().setConnectionStatus('error', 'Realtime indisponivel');
    usePresenceStore.getState().upsertPresence(
      {
        userId: 'user-1',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        platform: 'PC',
      },
      123,
    );

    render(
      <GamerCard
        profile={{
          ...profileFixture,
          profile: {
            ...profileFixture.profile,
            bio: null,
          },
        }}
      />,
    );

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(screen.getByText(/sem atividade ativa/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhuma sessao publica no momento/i)).toBeInTheDocument();
    expect(screen.getByText(/esse jogador ainda nao adicionou uma bio/i)).toBeInTheDocument();
  });

  it('renders connected platforms with friendlier labels from the profile contract', () => {
    render(
      <GamerCard
        profile={{
          ...profileFixture,
          platformIntegrations: [
            { platform: 'STEAM', metadata: null },
            { platform: 'DISCORD', metadata: null },
          ],
        }}
      />,
    );

    const platformsSection = screen.getByTestId('profile-platform-badges');
    expect(
      within(platformsSection).getByText(/2 plataformas conectadas/i),
    ).toBeInTheDocument();
    expect(within(platformsSection).getByText(/^steam$/i)).toBeInTheDocument();
    expect(within(platformsSection).getByText(/^discord$/i)).toBeInTheDocument();
  });
});
