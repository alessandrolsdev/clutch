import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  createPost,
  createPostComment,
  deletePost,
  fetchFeed,
  fetchPostComments,
  togglePostInteraction,
} from '@/services/feed';

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

  it('keeps cursor and limit query params for infinite scroll', async () => {
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

  it('throws when backend responds with feed error', async () => {
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

  it('creates a post with the real backend payload', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'post-10',
          userId: 'user-1',
          contentText: 'Novo post',
          mediaUrl: null,
          type: 'TEXT',
          gameContext: null,
          createdAt: '2026-03-31T12:00:00.000Z',
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await createPost({
      contentText: 'Novo post',
      mediaUrl: '',
      type: 'TEXT',
    });

    expect(response.id).toBe('post-10');
    expect(mockedApiRequest).toHaveBeenCalledWith('/posts', {
      method: 'POST',
      body: {
        contentText: 'Novo post',
        mediaUrl: undefined,
        type: 'TEXT',
      },
    });
  });

  it('toggles a post interaction with the real backend payload', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ added: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const response = await togglePostInteraction({
      postId: 'post-1',
      type: 'GG',
    });

    expect(response.added).toBe(true);
    expect(mockedApiRequest).toHaveBeenCalledWith('/posts/post-1/interactions', {
      method: 'POST',
      body: {
        type: 'GG',
      },
    });
  });

  it('returns parsed post comments', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'comment-1',
            content: 'Boa run!',
            parentId: null,
            createdAt: '2026-03-31T10:00:00.000Z',
            author: {
              id: 'user-2',
              username: 'pixelsamurai',
              profile: {
                displayName: 'Pixel Samurai',
                avatarUrl: null,
              },
            },
            replies: [
              {
                id: 'reply-1',
                content: 'Valeu!',
                parentId: 'comment-1',
                createdAt: '2026-03-31T10:02:00.000Z',
                author: {
                  id: 'user-1',
                  username: 'clutchplayer',
                  profile: {
                    displayName: 'CLUTCH Player',
                    avatarUrl: null,
                  },
                },
                replies: [],
              },
            ],
          },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await fetchPostComments('post-1');

    expect(response).toHaveLength(1);
    expect(response[0]?.replies).toHaveLength(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/posts/comments/post-1', {
      method: 'GET',
    });
  });

  it('creates a comment with optional parentId', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'comment-2',
          postId: 'post-1',
          userId: 'user-1',
          parentId: 'comment-1',
          content: 'Concordo',
          createdAt: '2026-03-31T10:03:00.000Z',
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await createPostComment({
      postId: 'post-1',
      content: 'Concordo',
      parentId: 'comment-1',
    });

    expect(response.parentId).toBe('comment-1');
    expect(mockedApiRequest).toHaveBeenCalledWith('/posts/comments', {
      method: 'POST',
      body: {
        postId: 'post-1',
        content: 'Concordo',
        parentId: 'comment-1',
      },
    });
  });

  it('deletes a post with the real backend contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Post removido.' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await deletePost('post-1');

    expect(mockedApiRequest).toHaveBeenCalledWith('/posts/post-1', {
      method: 'DELETE',
    });
  });

  it('throws when post creation fails', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Post precisa ter texto ou midia.' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(
      createPost({
        contentText: 'Post invalido',
        mediaUrl: '',
        type: 'TEXT',
      }),
    ).rejects.toMatchObject({
      name: 'FeedRequestError',
      status: 400,
      message: 'Post precisa ter texto ou midia.',
    });
  });
});
