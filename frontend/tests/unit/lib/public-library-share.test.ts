import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@/schemas/profile';
import {
  buildPublicLibraryCanonicalUrl,
  buildPublicLibraryDescription,
  buildPublicLibraryMetadata,
  buildPublicLibraryTitle,
} from '@/lib/profile/public-library-share';

const profileFixture: ProfileResponse = {
  id: 'user-1',
  username: 'clutchplayer',
  createdAt: '2026-03-29T22:15:00.000Z',
  profile: {
    displayName: 'CLUTCH Player',
    bio: 'Bio de teste do perfil publico',
    avatarUrl: 'https://cdn.clutch.gg/avatar.jpg',
    bannerUrl: 'https://cdn.clutch.gg/banner.jpg',
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
    platform: null,
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
      coverUrl: 'https://cdn.clutch.gg/valorant.jpg',
      platform: 'PC',
      hoursPlayed: 120,
      lastPlayedAt: '2026-03-29T22:15:00.000Z',
    },
    {
      gameName: 'Fortnite',
      coverUrl: 'https://cdn.clutch.gg/fortnite.jpg',
      platform: 'EPIC',
      hoursPlayed: 30,
      lastPlayedAt: '2026-03-28T22:15:00.000Z',
    },
  ],
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
};

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

describe('public library share metadata helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://clutch.gg';
    process.env.PUBLIC_APP_URL = '';
  });

  it('builds title, description and canonical from the real public library contract', () => {
    const metadata = buildPublicLibraryMetadata('clutchplayer', profileFixture);

    expect(buildPublicLibraryTitle('clutchplayer', profileFixture)).toBe(
      'Biblioteca de CLUTCH Player (@clutchplayer) | CLUTCH',
    );
    expect(buildPublicLibraryDescription('clutchplayer', profileFixture)).toBe(
      'Explore a biblioteca publica de @clutchplayer no CLUTCH com 2 jogos, 150h registradas, 2 plataformas, destaque para Valorant.',
    );
    expect(buildPublicLibraryCanonicalUrl('clutchplayer')).toBe(
      'https://clutch.gg/clutchplayer/library',
    );
    expect(metadata.alternates?.canonical).toBe(
      'https://clutch.gg/clutchplayer/library',
    );
    expect(metadata.openGraph?.url).toBe(
      'https://clutch.gg/clutchplayer/library',
    );
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.clutch.gg/valorant.jpg',
        alt: 'Biblioteca de CLUTCH Player (@clutchplayer) | CLUTCH',
      },
      {
        url: 'https://cdn.clutch.gg/banner.jpg',
        alt: 'Biblioteca de CLUTCH Player (@clutchplayer) | CLUTCH',
      },
      {
        url: 'https://cdn.clutch.gg/avatar.jpg',
        alt: 'Biblioteca de CLUTCH Player (@clutchplayer) | CLUTCH',
      },
    ]);
  });

  it('falls back to an honest library summary when richer fields are absent', () => {
    const metadata = buildPublicLibraryMetadata('ghostplayer', {
      ...profileFixture,
      username: 'ghostplayer',
      profile: {
        ...profileFixture.profile,
        displayName: null,
        avatarUrl: null,
        bannerUrl: null,
      },
      gameLibrary: [],
    });

    expect(buildPublicLibraryTitle('ghostplayer', null)).toBe(
      'Biblioteca de @ghostplayer | CLUTCH',
    );
    expect(buildPublicLibraryDescription('ghostplayer', null)).toBe(
      'Explore a biblioteca publica de @ghostplayer no CLUTCH.',
    );
    expect(metadata.alternates?.canonical).toBe(
      'https://clutch.gg/ghostplayer/library',
    );
    expect(metadata.openGraph?.images).toBeUndefined();
    expect(metadata.twitter).toMatchObject({
      card: 'summary',
    });
  });
});

afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  process.env.PUBLIC_APP_URL = originalPublicAppUrl;
});
