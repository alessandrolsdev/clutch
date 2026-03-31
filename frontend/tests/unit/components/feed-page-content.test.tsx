import React, { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPageContent } from '@/components/feed/feed-page-content';
import { fetchFeed } from '@/services/feed';
import { useAuth } from '@/hooks/use-auth';

vi.mock('@/services/feed', () => ({
  fetchFeed: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/feed/create-post-form', () => ({
  CreatePostForm: ({ userId }: { userId: string }) => (
    <div data-testid="create-post-form">create-post:{userId}</div>
  ),
}));

vi.mock('@/components/feed/post-card', () => ({
  PostCard: ({ post }: { post: { id: string; contentText: string | null } }) => (
    <article data-testid="feed-post-card">{post.contentText ?? post.id}</article>
  ),
}));

vi.mock('@/components/feed/infinite-scroll', () => ({
  InfiniteScroll: ({
    hasNextPage,
    onLoadMore,
  }: {
    hasNextPage: boolean;
    onLoadMore: () => void;
  }) => (
    <button
      type="button"
      data-testid="feed-infinite-scroll"
      disabled={!hasNextPage}
      onClick={() => {
        onLoadMore();
      }}
    >
      load-more
    </button>
  ),
}));

const mockedFetchFeed = vi.mocked(fetchFeed);
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

function buildPost(id: string, contentText: string) {
  return {
    id,
    contentText,
    mediaUrl: null,
    type: 'TEXT' as const,
    gameContext: null,
    createdAt: '2026-03-31T10:00:00.000Z',
    author: {
      id: `author-${id}`,
      username: `user-${id}`,
      profile: {
        displayName: `User ${id}`,
        avatarUrl: null,
        accentColor: '#06B6D4',
      },
    },
    _count: {
      interactions: 0,
      comments: 0,
    },
  };
}

describe('FeedPageContent', () => {
  beforeEach(() => {
    mockedFetchFeed.mockReset();
    mockedUseAuth.mockReset();
  });

  it('renders loading state while auth is loading', () => {
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
      posts: [buildPost('post-1', 'Primeiro post')],
      nextCursor: null,
    });

    renderWithQuery(<FeedPageContent />);

    expect(screen.getByTestId('create-post-form')).toHaveTextContent(
      'create-post:user-1',
    );
    expect(await screen.findByText(/primeiro post/i)).toBeInTheDocument();
  });

  it('renders empty state after loading with no posts', async () => {
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

    expect(await screen.findByTestId('feed-empty')).toBeInTheDocument();
    expect(screen.getByTestId('create-post-form')).toBeInTheDocument();
  });

  it('renders generic error state when initial feed request fails', async () => {
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

    expect(await screen.findByTestId('feed-error')).toBeInTheDocument();
  });

  it('loads the next feed page when pagination asks for more data', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-1',
        username: 'clutchplayer',
        email: 'clutchplayer@clutch.gg',
      },
      logout: vi.fn(),
    });
    mockedFetchFeed
      .mockResolvedValueOnce({
        posts: [buildPost('post-1', 'Primeiro post')],
        nextCursor: 'post-1',
      })
      .mockResolvedValueOnce({
        posts: [buildPost('post-2', 'Segundo post')],
        nextCursor: null,
      });

    renderWithQuery(<FeedPageContent />);

    expect(await screen.findByText(/primeiro post/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('feed-infinite-scroll'));

    await waitFor(() => {
      expect(screen.getByText(/segundo post/i)).toBeInTheDocument();
    });

    expect(mockedFetchFeed).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      cursor: undefined,
    });
    expect(mockedFetchFeed).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      cursor: 'post-1',
    });
  });
});
