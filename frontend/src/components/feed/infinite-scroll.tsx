'use client';

import { useEffect, useRef } from 'react';

type InfiniteScrollProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export function InfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const latestStateRef = useRef({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });

  useEffect(() => {
    latestStateRef.current = {
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
    };
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const state = latestStateRef.current;

      if (!entry?.isIntersecting || state.isFetchingNextPage || !state.hasNextPage) {
        return;
      }

      state.onLoadMore();
    }, {
      rootMargin: '160px 0px',
      threshold: 0.1,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!hasNextPage && !isFetchingNextPage) {
    return (
      <div className="py-4 text-center text-xs uppercase tracking-[0.28em] text-muted">
        Voce chegou ao fim do feed
      </div>
    );
  }

  return (
    <div
      ref={sentinelRef}
      data-testid="feed-infinite-scroll"
      className="py-4 text-center text-xs uppercase tracking-[0.28em] text-secondary"
    >
      {isFetchingNextPage ? 'Carregando mais posts...' : 'Role para carregar mais'}
    </div>
  );
}
