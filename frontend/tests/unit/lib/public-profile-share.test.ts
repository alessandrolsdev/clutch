import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@/schemas/profile';
import {
  buildPublicProfileCanonicalUrl,
  buildPublicProfileDescription,
  buildPublicProfileMetadata,
  buildPublicProfileTitle,
} from '@/lib/profile/public-profile-share';

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
      coverUrl: null,
      platform: 'PC',
      hoursPlayed: 120,
      lastPlayedAt: '2026-03-29T22:15:00.000Z',
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
  otakuShowcase: null,
};

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

describe('public profile share metadata helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://clutch.gg';
    process.env.PUBLIC_APP_URL = '';
  });

  it('builds title, description and canonical from the real public profile contract', () => {
    const metadata = buildPublicProfileMetadata('clutchplayer', profileFixture);

    expect(buildPublicProfileTitle('clutchplayer', profileFixture)).toBe(
      'CLUTCH Player (@clutchplayer) | CLUTCH',
    );
    expect(buildPublicProfileDescription('clutchplayer', profileFixture)).toBe(
      'Bio de teste do perfil publico',
    );
    expect(buildPublicProfileCanonicalUrl('clutchplayer')).toBe(
      'https://clutch.gg/clutchplayer',
    );
    expect(metadata.alternates?.canonical).toBe('https://clutch.gg/clutchplayer');
    expect(metadata.openGraph?.url).toBe('https://clutch.gg/clutchplayer');
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.clutch.gg/banner.jpg',
        alt: 'CLUTCH Player (@clutchplayer) | CLUTCH',
      },
      {
        url: 'https://cdn.clutch.gg/avatar.jpg',
        alt: 'CLUTCH Player (@clutchplayer) | CLUTCH',
      },
    ]);
  });

  it('falls back to an honest public-profile summary when richer fields are absent', () => {
    const metadata = buildPublicProfileMetadata('ghostplayer', null);

    expect(buildPublicProfileTitle('ghostplayer', null)).toBe('@ghostplayer | CLUTCH');
    expect(buildPublicProfileDescription('ghostplayer', null)).toBe(
      'Perfil gamer de @ghostplayer no CLUTCH',
    );
    expect(metadata.alternates?.canonical).toBe('https://clutch.gg/ghostplayer');
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
