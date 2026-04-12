'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { fetchFeed } from '@/services/feed';
import { fetchFriends } from '@/services/friends';
import { fetchNotifications } from '@/services/notifications';
import { fetchProfileByUsername } from '@/services/profile';

export function AppShellRouteWarmup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const warmedSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      warmedSessionKeyRef.current = null;
      return;
    }

    const sessionKey = `${user.id}:${user.username}`;

    if (warmedSessionKeyRef.current === sessionKey) {
      return;
    }

    warmedSessionKeyRef.current = sessionKey;

    const hotRoutes = [
      '/feed',
      '/notifications',
      '/settings',
      `/${user.username}`,
    ];

    hotRoutes.forEach((route) => {
      router.prefetch(route);
    });

    void Promise.all([
      queryClient.prefetchInfiniteQuery({
        queryKey: ['feed', user.id],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) =>
          fetchFeed({
            userId: user.id,
            cursor: pageParam,
          }),
        getNextPageParam: (lastPage: Awaited<ReturnType<typeof fetchFeed>>) =>
          lastPage.nextCursor ?? undefined,
      }),
      queryClient.prefetchQuery({
        queryKey: ['notifications', user.id, 'all'],
        queryFn: () => fetchNotifications({ userId: user.id }),
      }),
      queryClient.prefetchQuery({
        queryKey: ['profile', user.username],
        queryFn: () => fetchProfileByUsername(user.username),
      }),
      queryClient.prefetchQuery({
        queryKey: ['friends', user.id],
        queryFn: () => fetchFriends(user.id),
      }),
    ]).catch(() => undefined);
  }, [queryClient, router, status, user]);

  return null;
}
