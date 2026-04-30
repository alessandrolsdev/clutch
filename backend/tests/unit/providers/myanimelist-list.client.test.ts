import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import { myAnimeListListClient } from '@/infra/integrations/myanimelist/myanimelist-list.client';

describe('myAnimeListListClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca anime list com token bearer, limite inicial e normaliza itens minimos', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            node: {
              id: 5114,
              title: 'Fullmetal Alchemist: Brotherhood',
              main_picture: { medium: 'https://cdn.mal/fma-medium.jpg', large: 'https://cdn.mal/fma-large.jpg' },
            },
            list_status: {
              status: 'completed',
              score: 10,
              num_episodes_watched: 64,
            },
          },
        ],
        paging: { next: 'https://api.myanimelist.net/v2/users/@me/animelist?offset=50' },
      },
    });

    const result = await myAnimeListListClient.fetchAnimeList('mal-access-token');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.myanimelist.net/v2/users/@me/animelist',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mal-access-token' },
        params: {
          fields: 'list_status,main_picture',
          limit: 50,
          offset: 0,
        },
      }),
    );
    expect(result).toEqual([
      {
        id: '5114',
        title: 'Fullmetal Alchemist: Brotherhood',
        kind: 'ANIME',
        coverUrl: 'https://cdn.mal/fma-large.jpg',
        status: 'completed',
        progress: 64,
        score: 10,
      },
    ]);
  });

  it('busca manga list e ignora registros sem identidade ou status confiavel', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            node: {
              id: '2',
              title: 'Berserk',
              main_picture: { medium: 'https://cdn.mal/berserk.jpg' },
            },
            list_status: {
              status: 'reading',
              num_chapters_read: 12,
            },
          },
          {
            node: { id: 0, title: 'Invalid' },
            list_status: { status: 'completed' },
          },
          {
            node: { id: 3, title: 'Missing status' },
            list_status: { status: 'unknown' },
          },
        ],
      },
    });

    const result = await myAnimeListListClient.fetchMangaList('mal-access-token');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.myanimelist.net/v2/users/@me/mangalist',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mal-access-token' },
      }),
    );
    expect(result).toEqual([
      {
        id: '2',
        title: 'Berserk',
        kind: 'MANGA',
        coverUrl: 'https://cdn.mal/berserk.jpg',
        status: 'reading',
        progress: 12,
        score: null,
      },
    ]);
  });

  it('mapeia 401/403 como reauth sem vazar token', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 401 },
      config: { headers: { Authorization: 'Bearer mal-access-token' } },
    });

    await expect(myAnimeListListClient.fetchAnimeList('mal-access-token')).rejects.toMatchObject({
      statusCode: 401,
      reason: 'invalid_credentials',
      clientMessage: 'MyAnimeList precisa ser reconectado antes da importação.',
    });
  });
});
