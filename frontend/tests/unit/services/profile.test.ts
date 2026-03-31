import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  fetchProfileByUsername,
  ProfileRequestError,
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
});
