import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { FeedResponse } from '@/schemas/feed';
import type { FriendSummary, PendingFriendRequest } from '@/schemas/friends';
import type { NotificationsResponse } from '@/schemas/notifications';
import type { ProfileResponse } from '@/schemas/profile';

type QuerySnapshot = {
  queryKey: QueryKey;
  data: unknown;
};

type FeedInfiniteData = InfiniteData<FeedResponse, string | undefined>;

function mapFeedPages(
  data: FeedInfiniteData | undefined,
  transform: (post: FeedResponse['posts'][number]) => FeedResponse['posts'][number],
): FeedInfiniteData | undefined {
  if (!data) {
    return data;
  }

  let changed = false;

  const pages = data.pages.map((page) => {
    const posts = page.posts.map((post) => {
      const nextPost = transform(post);

      if (nextPost !== post) {
        changed = true;
      }

      return nextPost;
    });

    return changed ? { ...page, posts } : page;
  });

  return changed ? { ...data, pages } : data;
}

function buildFriendSummaryFromRequest(request: PendingFriendRequest): FriendSummary {
  return {
    id: request.sender.id,
    username: request.sender.username,
    profile: request.sender.profile
      ? {
          displayName: request.sender.profile.displayName,
          avatarUrl: request.sender.profile.avatarUrl,
          accentColor: null,
        }
      : null,
    presence: null,
  };
}

function buildFriendSummaryFromProfile(profile: ProfileResponse): FriendSummary {
  return {
    id: profile.id,
    username: profile.username,
    profile: {
      displayName: profile.profile.displayName,
      avatarUrl: profile.profile.avatarUrl,
      accentColor: profile.profile.accentColor,
    },
    presence: null,
  };
}

function findCachedProfile(
  queryClient: QueryClient,
  userId: string,
): ProfileResponse | null {
  const match = queryClient
    .getQueriesData<ProfileResponse>({ queryKey: ['profile'] })
    .find(([, data]) => data?.id === userId);

  return match?.[1] ?? null;
}

export function buildOptimisticFriendSummary(
  queryClient: QueryClient,
  user: {
    id: string;
    username: string;
  },
): FriendSummary {
  const cachedProfile = findCachedProfile(queryClient, user.id);

  if (cachedProfile) {
    return buildFriendSummaryFromProfile(cachedProfile);
  }

  return {
    id: user.id,
    username: user.username,
    profile: null,
    presence: null,
  };
}

export function snapshotQueryGroups(
  queryClient: QueryClient,
  queryKeys: QueryKey[],
): QuerySnapshot[] {
  return queryKeys.flatMap((queryKey) =>
    queryClient.getQueriesData({ queryKey }).map(([matchedKey, data]) => ({
      queryKey: matchedKey,
      data,
    })),
  );
}

export function restoreQuerySnapshots(
  queryClient: QueryClient,
  snapshots: QuerySnapshot[],
): void {
  snapshots.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
}

export function applyFeedReactionDelta(
  queryClient: QueryClient,
  postId: string,
  delta: number,
): void {
  queryClient.setQueriesData<FeedInfiniteData>({ queryKey: ['feed'] }, (data) =>
    mapFeedPages(data, (post) => {
      if (post.id !== postId) {
        return post;
      }

      return {
        ...post,
        _count: {
          ...post._count,
          interactions: Math.max(0, post._count.interactions + delta),
        },
      };
    }),
  );
}

export function applyNotificationRead(
  queryClient: QueryClient,
  userId: string,
  notificationId: string,
): void {
  queryClient
    .getQueriesData<NotificationsResponse>({ queryKey: ['notifications', userId] })
    .forEach(([queryKey, data]) => {
      if (!data) {
        return;
      }

      const target = data.notifications.find(
        (notification) => notification.id === notificationId,
      );

      if (!target || target.isRead) {
        return;
      }

      const scope = queryKey[2];
      const unreadCount = Math.max(0, data.unreadCount - 1);
      const notifications =
        scope === 'unread'
          ? data.notifications.filter((notification) => notification.id !== notificationId)
          : data.notifications.map((notification) =>
              notification.id === notificationId
                ? { ...notification, isRead: true }
                : notification,
            );

      queryClient.setQueryData<NotificationsResponse>(queryKey, {
        ...data,
        notifications,
        unreadCount,
      });
    });
}

export function applyAllNotificationsRead(
  queryClient: QueryClient,
  userId: string,
): void {
  queryClient
    .getQueriesData<NotificationsResponse>({ queryKey: ['notifications', userId] })
    .forEach(([queryKey, data]) => {
      if (!data || data.unreadCount === 0) {
        return;
      }

      const scope = queryKey[2];

      queryClient.setQueryData<NotificationsResponse>(queryKey, {
        ...data,
        notifications:
          scope === 'unread'
            ? []
            : data.notifications.map((notification) => ({
                ...notification,
                isRead: true,
              })),
        unreadCount: 0,
      });
    });
}

export function applyAcceptedFriendRequest(
  queryClient: QueryClient,
  receiverUserId: string,
  request: PendingFriendRequest,
  receiverSummary?: FriendSummary,
): void {
  queryClient.setQueriesData<PendingFriendRequest[]>(
    { queryKey: ['friend-requests', receiverUserId] },
    (data) => data?.filter((entry) => entry.id !== request.id) ?? data,
  );

  queryClient.setQueriesData<FriendSummary[]>(
    { queryKey: ['friends', receiverUserId] },
    (data) => {
      if (!data) {
        return data;
      }

      if (data.some((friend) => friend.id === request.sender.id)) {
        return data;
      }

      return [...data, buildFriendSummaryFromRequest(request)];
    },
  );

  if (receiverSummary) {
    queryClient.setQueriesData<FriendSummary[]>(
      { queryKey: ['friends', request.sender.id] },
      (data) => {
        if (!data) {
          return data;
        }

        if (data.some((friend) => friend.id === receiverSummary.id)) {
          return data;
        }

        return [...data, receiverSummary];
      },
    );
  }
}

export function applyRemovedFriend(
  queryClient: QueryClient,
  currentUserId: string,
  targetUserId: string,
): void {
  queryClient.setQueriesData<FriendSummary[]>(
    { queryKey: ['friends', currentUserId] },
    (data) => data?.filter((friend) => friend.id !== targetUserId) ?? data,
  );

  queryClient.setQueriesData<FriendSummary[]>(
    { queryKey: ['friends', targetUserId] },
    (data) => data?.filter((friend) => friend.id !== currentUserId) ?? data,
  );
}

export function applyProfileFriendCountDelta(
  queryClient: QueryClient,
  userIds: string[],
  delta: number,
): void {
  const targetIds = new Set(userIds);

  queryClient.setQueriesData<ProfileResponse>(
    { queryKey: ['profile'] },
    (data) => {
      if (!data || !targetIds.has(data.id)) {
        return data;
      }

      return {
        ...data,
        stats: {
          ...data.stats,
          friendCount: Math.max(0, data.stats.friendCount + delta),
        },
      };
    },
  );
}
