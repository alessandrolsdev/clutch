import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import { fetchFeed } from '@/services/feed';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('feed service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('returns parsed feed response', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          posts: [
            {
              id: 'post-1',
              contentText: 'Primeiro post',
              mediaUrl: null,
              type: 'TEXT',
              gameContext: null,
              createdAt: '2026-03-31T10:00:00.000Z',
              author: {
                id: 'user-1',
                username: 'clutchplayer',
                profile: {
                  displayName: 'CLUTCH Player',
                  avatarUrl: null,
                  accentColor: '#7C3AED',
                },
              },
              _count: {
                interactions: 3,
                comments: 2,
              },
            },
          ],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await fetchFeed({ userId: 'user-1' });

    expect(response.posts).toHaveLength(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/posts/feed/user-1', {
      method: 'GET',
    });
  });

  it('keeps cursor and limit query params for future pagination', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ posts: [], nextCursor: 'post-2' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await fetchFeed({ userId: 'user-1', cursor: 'post-1', limit: 10 });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/posts/feed/user-1?cursor=post-1&limit=10',
      {
        method: 'GET',
      },
    );
  });

  it('throws when backend responds with error', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Falha ao carregar feed.' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(fetchFeed({ userId: 'user-1' })).rejects.toMatchObject({
      name: 'FeedRequestError',
      status: 500,
      message: 'Falha ao carregar feed.',
    });
  });
});
