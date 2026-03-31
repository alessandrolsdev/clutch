import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPageContent } from '@/components/feed/feed-page-content';
import { createPost, fetchFeed } from '@/services/feed';
import { useAuth } from '@/hooks/use-auth';

vi.mock('@/services/feed', () => ({
  fetchFeed: vi.fn(),
  createPost: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

const mockedFetchFeed = vi.mocked(fetchFeed);
const mockedCreatePost = vi.mocked(createPost);
const mockedUseAuth = vi.mocked(useAuth);

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('FeedPageContent', () => {
  beforeEach(() => {
    mockedFetchFeed.mockReset();
    mockedCreatePost.mockReset();
    mockedUseAuth.mockReset();
  });

  it('renders loading state', () => {
    mockedUseAuth.mockReturnValue({
      status: 'loading',
      user: null,
      logout: vi.fn(),
    });

    renderWithQuery(<FeedPageContent />);

    expect(screen.getByTestId('feed-loading')).toBeInTheDocument();
  });

  it('renders feed posts on success', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchFeed.mockResolvedValue({
      posts: [
        {
          id: 'post-1',
          contentText: 'Primeiro post',
          mediaUrl: null,
          type: 'TEXT',
          gameContext: null,
          createdAt: '2026-03-31T10:00:00.000Z',
          author: {
            id: 'user-2',
            username: 'pixelsamurai',
            profile: {
              displayName: 'Pixel Samurai',
              avatarUrl: null,
              accentColor: '#06B6D4',
            },
          },
          _count: {
            interactions: 3,
            comments: 2,
          },
        },
      ],
      nextCursor: null,
    });
    mockedCreatePost.mockResolvedValue({
      id: 'post-created',
      userId: 'user-1',
      contentText: 'Novo post',
      mediaUrl: null,
      type: 'TEXT',
      gameContext: null,
      createdAt: '2026-03-31T12:00:00.000Z',
    });

    renderWithQuery(<FeedPageContent />);

    await waitFor(() => {
      expect(screen.getByTestId('feed-success')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { name: /compartilhe algo com sua timeline/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/primeiro post/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('feed-post-card')).toHaveLength(1);
  });

  it('renders empty state', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchFeed.mockResolvedValue({
      posts: [],
      nextCursor: null,
    });

    renderWithQuery(<FeedPageContent />);

    await waitFor(() => {
      expect(screen.getByTestId('feed-empty')).toBeInTheDocument();
    });
  });

  it('renders generic error state', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchFeed.mockRejectedValue(new Error('network'));

    renderWithQuery(<FeedPageContent />);

    await waitFor(() => {
      expect(screen.getByTestId('feed-error')).toBeInTheDocument();
    });
  });
});
