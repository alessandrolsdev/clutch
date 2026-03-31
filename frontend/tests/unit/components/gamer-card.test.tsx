import React from 'react';
import { render, screen } from '@testing-library/react';
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
  });
});
