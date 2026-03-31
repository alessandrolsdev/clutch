import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentSection } from '@/components/feed/comment-section';
import {
  createPostComment,
  fetchPostComments,
} from '@/services/feed';

vi.mock('@/services/feed', () => ({
  fetchPostComments: vi.fn(),
  createPostComment: vi.fn(),
}));

const mockedFetchPostComments = vi.mocked(fetchPostComments);
const mockedCreatePostComment = vi.mocked(createPostComment);

function renderCommentSection(initialCommentCount = 1) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CommentSection
        postId="post-1"
        initialCommentCount={initialCommentCount}
      />
    </QueryClientProvider>,
  );
}

describe('CommentSection', () => {
  beforeEach(() => {
    mockedFetchPostComments.mockReset();
    mockedCreatePostComment.mockReset();
  });

  it('loads and renders comments when opened', async () => {
    mockedFetchPostComments.mockResolvedValue([
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
        replies: [],
      },
    ]);

    renderCommentSection(1);

    fireEvent.click(screen.getByRole('button', { name: /abrir comentarios/i }));
    expect(await screen.findByText(/boa run!/i)).toBeInTheDocument();
    expect(mockedFetchPostComments).toHaveBeenCalledWith('post-1');
  });

  it('creates a top-level comment', async () => {
    mockedFetchPostComments.mockResolvedValue([]);
    mockedCreatePostComment.mockResolvedValue({
      id: 'comment-2',
      postId: 'post-1',
      userId: 'user-1',
      parentId: null,
      content: 'Novo comentario',
      createdAt: '2026-03-31T10:05:00.000Z',
    });

    renderCommentSection(0);

    fireEvent.click(screen.getByRole('button', { name: /abrir comentarios/i }));
    await screen.findByText(/ainda nao existem comentarios/i);

    fireEvent.change(screen.getByPlaceholderText(/escreva um comentario/i), {
      target: { value: 'Novo comentario' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^comentar$/i }));

    await waitFor(() => {
      expect(mockedCreatePostComment).toHaveBeenCalled();
    });
    expect(mockedCreatePostComment.mock.calls[0]?.[0]).toEqual({
      postId: 'post-1',
      content: 'Novo comentario',
      parentId: undefined,
    });
  });

  it('creates a reply for a top-level comment', async () => {
    mockedFetchPostComments.mockResolvedValue([
      {
        id: 'comment-1',
        content: 'Comentario pai',
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
        replies: [],
      },
    ]);
    mockedCreatePostComment.mockResolvedValue({
      id: 'reply-1',
      postId: 'post-1',
      userId: 'user-1',
      parentId: 'comment-1',
      content: 'Reply de teste',
      createdAt: '2026-03-31T10:07:00.000Z',
    });

    renderCommentSection(1);

    fireEvent.click(screen.getByRole('button', { name: /abrir comentarios/i }));
    await screen.findByText(/comentario pai/i);

    fireEvent.click(screen.getByRole('button', { name: /responder/i }));
    fireEvent.change(screen.getByPlaceholderText(/responder pixel samurai/i), {
      target: { value: 'Reply de teste' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar reply/i }));

    await waitFor(() => {
      expect(mockedCreatePostComment).toHaveBeenCalled();
    });
    expect(mockedCreatePostComment.mock.calls[0]?.[0]).toEqual({
      postId: 'post-1',
      content: 'Reply de teste',
      parentId: 'comment-1',
    });
  });
});
