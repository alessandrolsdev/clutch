'use client';

import { useQuery } from '@tanstack/react-query';
import { PostCard } from '@/components/feed/post-card';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { fetchFeed } from '@/services/feed';

function FeedLoadingState() {
  return (
    <div className="space-y-4" data-testid="feed-loading">
      <Card>
        <div className="h-8 w-48 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-6 w-full animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-2 h-6 w-2/3 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
      <Card>
        <div className="h-8 w-40 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-6 w-full animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    </div>
  );
}

function FeedEmptyState() {
  return (
    <Card data-testid="feed-empty">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Feed</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Nenhum post no feed ainda
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Assim que voce e seus amigos publicarem, os posts aparecem aqui.
        </p>
      </div>
    </Card>
  );
}

function FeedErrorState() {
  return (
    <Card data-testid="feed-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Feed</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Nao foi possivel carregar o feed
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Tente novamente em alguns instantes.
        </p>
      </div>
    </Card>
  );
}

export function FeedPageContent() {
  const { status, user } = useAuth();
  const userId = user?.id;

  const feedQuery = useQuery({
    queryKey: ['feed', userId],
    enabled: typeof userId === 'string' && userId.length > 0,
    queryFn: () =>
      fetchFeed({
        userId: userId as string,
      }),
  });

  if (status === 'loading' || feedQuery.isPending) {
    return <FeedLoadingState />;
  }

  if (!userId || status !== 'authenticated') {
    return <FeedErrorState />;
  }

  if (feedQuery.isError) {
    return <FeedErrorState />;
  }

  if (feedQuery.data.posts.length === 0) {
    return <FeedEmptyState />;
  }

  return (
    <section className="space-y-section" data-testid="feed-success">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Feed</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Social feed
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Linha do tempo read-only com base no contrato real do backend.
        </p>
      </header>

      <div className="space-y-4">
        {feedQuery.data.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
