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
    badges: ['Founder', 'Ranked Grinder', 'Community Host'],
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
  socialContinuity: {
    currentStreakDays: 4,
    activeFriendOffensiveCount: 1,
    strongestFriendOffensive: {
      friendId: 'friend-1',
      friendUsername: 'duoqueue',
      days: 3,
      lastQualifiedAt: '2026-03-29T00:00:00.000Z',
    },
  },
  otakuShowcase: null,
};

describe('GamerCard', () => {
  beforeEach(() => {
    resetPresenceStore();
  });

  it('renders featured title, special badges and visible social progress from current profile data', () => {
    render(<GamerCard profile={profileFixture} />);

    expect(screen.getByTestId('profile-featured-title')).toHaveTextContent('Founder');
    expect(screen.getByTestId('profile-special-badges')).toHaveTextContent('Ranked Grinder');
    expect(screen.getByTestId('profile-special-badges')).toHaveTextContent('Community Host');
    expect(screen.getByTestId('profile-social-progress')).toHaveTextContent(
      /progresso social visivel/i,
    );
    expect(screen.getByTestId('profile-social-progress')).toHaveTextContent('215');
    expect(screen.getByTestId('profile-social-progress')).toHaveTextContent('2');
    expect(screen.getByTestId('profile-social-continuity')).toHaveTextContent(/4 dias/i);
    expect(screen.getByTestId('profile-social-continuity')).toHaveTextContent(
      /com @duoqueue/i,
    );
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

    expect(screen.getByText(/^jogando$/i)).toBeInTheDocument();
    expect(screen.getByTestId('presence-source-badge')).toHaveTextContent(/ao vivo/i);
    expect(screen.getByText(/jogando valorant/i)).toBeInTheDocument();
    expect(screen.getByText(/via pc • presenca ao vivo/i)).toBeInTheDocument();
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

    expect(screen.getByText(/^offline$/i)).toBeInTheDocument();
    expect(screen.getByText(/sem sessao publica ativa/i)).toBeInTheDocument();
    expect(screen.getByTestId('presence-source-badge')).toHaveTextContent(/snapshot/i);
    expect(
      screen.getByText(/nenhuma plataforma publica ativa • snapshot do backend/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/esse jogador ainda nao adicionou uma bio/i)).toBeInTheDocument();
  });

  it('renders connected platforms with friendlier labels from the profile contract', () => {
    render(
      <GamerCard
        profile={{
          ...profileFixture,
          platformIntegrations: [
            { platform: 'STEAM', displayName: 'Steam', connectionType: 'CONNECTED_ACCOUNT' },
            { platform: 'DISCORD', displayName: 'Discord', connectionType: 'CONNECTED_ACCOUNT' },
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

  it('omits featured title and special badges when no badge source exists', () => {
    render(
      <GamerCard
        profile={{
          ...profileFixture,
          profile: {
            ...profileFixture.profile,
            badges: [],
          },
        }}
      />,
    );

    expect(screen.queryByTestId('profile-featured-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-special-badges')).not.toBeInTheDocument();
  });

  it('renders honest fallbacks when no active friend offensive exists', () => {
    render(
      <GamerCard
        profile={{
          ...profileFixture,
          socialContinuity: {
            currentStreakDays: 0,
            activeFriendOffensiveCount: 0,
            strongestFriendOffensive: null,
          },
        }}
      />,
    );

    expect(screen.getByTestId('profile-social-continuity')).toHaveTextContent(
      /sem atividade/i,
    );
    expect(screen.getByTestId('profile-social-continuity')).toHaveTextContent(
      /sem ofensiva/i,
    );
    expect(screen.getByTestId('profile-social-continuity')).toHaveTextContent(
      /ainda sem sobreposicao ativa com amigos/i,
    );
  });
});
