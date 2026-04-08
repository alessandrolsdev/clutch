'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { CreatePostForm } from '@/components/feed/create-post-form';
import { FeedSkeleton } from '@/components/feed/feed-skeleton';
import { InfiniteScroll } from '@/components/feed/infinite-scroll';
import { PostCard } from '@/components/feed/post-card';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { fetchFeed } from '@/services/feed';

function FeedEmptyState() {
  return (
    <Card data-testid="feed-empty">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Feed</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nenhum post no feed ainda
        </h2>
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
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nao foi possivel carregar o feed
        </h2>
        <p className="text-sm leading-6 text-secondary">
          Tente novamente em alguns instantes.
        </p>
      </div>
    </Card>
  );
}

function FeedLoadMoreError() {
  return (
    <Card data-testid="feed-load-more-error">
      <p className="text-sm leading-6 text-status-afk">
        Nao foi possivel carregar mais posts agora. Role novamente para tentar de novo.
      </p>
    </Card>
  );
}

export function FeedPageContent() {
  const { status, user } = useAuth();
  const userId = user?.id;

  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', userId],
    enabled: typeof userId === 'string' && userId.length > 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchFeed({
        userId: userId as string,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (status === 'loading') {
    return <FeedSkeleton />;
  }

  if (!userId || status !== 'authenticated') {
    return <FeedErrorState />;
  }

  const posts = feedQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const showInitialLoading = feedQuery.isPending && posts.length === 0;
  const showInitialError = feedQuery.isError && posts.length === 0;

  return (
    <section className="space-y-section" data-testid="feed-success">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Feed</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Social feed
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Timeline do CLUTCH com publicacao, reactions e comentarios ligados ao
          contrato real do backend.
        </p>
      </header>

      <CreatePostForm userId={userId} />

      {showInitialLoading ? <FeedSkeleton /> : null}
      {showInitialError ? <FeedErrorState /> : null}
      {!showInitialLoading && !showInitialError && posts.length === 0 ? (
        <FeedEmptyState />
      ) : null}

      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}

      {feedQuery.isError && posts.length > 0 ? <FeedLoadMoreError /> : null}

      {posts.length > 0 ? (
        <InfiniteScroll
          hasNextPage={Boolean(feedQuery.hasNextPage)}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          onLoadMore={() => {
            void feedQuery.fetchNextPage();
          }}
        />
      ) : null}
    </section>
  );
}
