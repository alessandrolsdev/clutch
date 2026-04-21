import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCard } from '@/components/feed/post-card';
import { useAuth } from '@/hooks/use-auth';
import { type FeedPost } from '@/schemas/feed';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/feed', () => ({
  deletePost: vi.fn(),
  FeedRequestError: class FeedRequestError extends Error {},
}));

vi.mock('@/components/feed/reaction-bar', () => ({
  ReactionBar: ({ postId }: { postId: string }) => (
    <div data-testid={`reaction-bar-${postId}`}>reactions</div>
  ),
}));

vi.mock('@/components/feed/comment-section', () => ({
  CommentSection: ({ postId }: { postId: string }) => (
    <div data-testid={`comment-section-${postId}`}>comments</div>
  ),
}));

vi.mock('@/components/ui/hydration-safe-time', () => ({
  HydrationSafeTime: ({ fallback }: { fallback: string }) => (
    <time>{fallback}</time>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);

function buildPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'post-1',
    contentText: 'Resumo do registro',
    mediaUrl: null,
    type: 'TEXT',
    gameContext: null,
    createdAt: '2026-04-21T12:00:00.000Z',
    author: {
      id: 'author-1',
      username: 'clutchplayer',
      profile: {
        displayName: 'Clutch Player',
        avatarUrl: null,
        accentColor: '#06B6D4',
      },
    },
    _count: {
      interactions: 2,
      comments: 1,
    },
    ...overrides,
  };
}

function renderPostCard(post: FeedPost) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PostCard post={post} />
    </QueryClientProvider>,
  );
}

describe('PostCard', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'viewer-1',
        username: 'viewer',
        email: 'viewer@clutch.gg',
      },
      logout: vi.fn(),
    });
  });

  it('destaca posts de sessao com contexto de jogo quando disponivel', () => {
    renderPostCard(
      buildPost({
        type: 'GAME_SESSION',
        gameContext: {
          gameName: 'Hades II',
          platform: 'Steam',
          capturedAt: '2026-04-21T12:00:00.000Z',
        },
      }),
    );

    expect(screen.getByText(/^sessao$/i)).toBeInTheDocument();
    expect(screen.getByText(/registro de sessao/i)).toBeInTheDocument();
    expect(screen.getByText(/sessao em hades ii/i)).toBeInTheDocument();
    expect(screen.getByText(/via steam/i)).toBeInTheDocument();
    expect(screen.getByText(/hades ii • steam/i)).toBeInTheDocument();
  });

  it('destaca posts de conquista sem depender de copy tecnica do tipo', () => {
    renderPostCard(
      buildPost({
        type: 'ACHIEVEMENT',
        gameContext: {
          gameName: 'Celeste',
          platform: null,
          capturedAt: '2026-04-21T12:00:00.000Z',
        },
      }),
    );

    expect(screen.getByText(/^conquista$/i)).toBeInTheDocument();
    expect(screen.getByText(/registro de conquista/i)).toBeInTheDocument();
    expect(screen.getByText(/conquista em celeste/i)).toBeInTheDocument();
    expect(screen.queryByText(/^ACHIEVEMENT$/)).not.toBeInTheDocument();
  });

  it('mantem posts genericos sem bloco extra de sessao ou conquista', () => {
    renderPostCard(buildPost());

    expect(screen.getByText(/^texto$/i)).toBeInTheDocument();
    expect(screen.queryByText(/registro de sessao/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/registro de conquista/i)).not.toBeInTheDocument();
  });

  it('degrada com honestidade quando a sessao nao informa jogo ou plataforma', () => {
    renderPostCard(
      buildPost({
        type: 'GAME_SESSION',
        gameContext: {
          gameName: null,
          platform: null,
          capturedAt: '2026-04-21T12:00:00.000Z',
        },
      }),
    );

    expect(screen.getByText(/sessao de jogo registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/^contexto de jogo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/via /i)).not.toBeInTheDocument();
  });
});
