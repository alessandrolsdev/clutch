import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  fetchProfileByUsername,
  ProfileRequestError,
  updateProfileByUsername,
} from '@/services/profile';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('profile service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('parses and returns the profile contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
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
          gameLibrary: [],
          socialContinuity: {
            currentStreakDays: 0,
            activeFriendOffensiveCount: 0,
            strongestFriendOffensive: null,
          },
          otakuShowcase: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const profile = await fetchProfileByUsername('clutchplayer');

    expect(profile.username).toBe('clutchplayer');
    expect(mockedApiRequest).toHaveBeenCalledWith('/profiles/clutchplayer', {
      method: 'GET',
    });
  });

  it('maps 404 to ProfileRequestError', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Perfil nao encontrado.' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(fetchProfileByUsername('missinguser')).rejects.toMatchObject({
      name: 'ProfileRequestError',
      status: 404,
      message: 'Perfil nao encontrado.',
    } satisfies Partial<ProfileRequestError>);
  });

  it('maps generic backend errors', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Erro interno.' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(fetchProfileByUsername('clutchplayer')).rejects.toMatchObject({
      name: 'ProfileRequestError',
      status: 500,
      message: 'Erro interno.',
    } satisfies Partial<ProfileRequestError>);
  });

  it('updates the profile with the real patch contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'profile-1',
          userId: 'user-1',
          displayName: 'CLUTCH Player',
          bio: 'Bio',
          avatarUrl: 'https://cdn.clutch.gg/avatar.jpg',
          bannerUrl: 'https://cdn.clutch.gg/banner.jpg',
          accentColor: '#7C3AED',
          badges: ['Founder'],
          createdAt: '2026-03-29T22:15:00.000Z',
          updatedAt: '2026-03-31T22:15:00.000Z',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await updateProfileByUsername('clutchplayer', {
      displayName: 'CLUTCH Player',
      bio: 'Bio',
      avatarUrl: 'https://cdn.clutch.gg/avatar.jpg',
      bannerUrl: 'https://cdn.clutch.gg/banner.jpg',
      accentColor: '#7C3AED',
    });

    expect(response.userId).toBe('user-1');
    expect(mockedApiRequest).toHaveBeenCalledWith('/profiles/clutchplayer', {
      method: 'PATCH',
      body: {
        displayName: 'CLUTCH Player',
        bio: 'Bio',
        avatarUrl: 'https://cdn.clutch.gg/avatar.jpg',
        bannerUrl: 'https://cdn.clutch.gg/banner.jpg',
        accentColor: '#7C3AED',
      },
    });
  });
});
