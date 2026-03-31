'use client';

import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { PresenceBadge } from '@/components/profile/presence-badge';
import { type FriendSummary, type FriendPresenceStatus } from '@/schemas/friends';
import { fetchFriends } from '@/services/friends';
import { usePresenceStore, type PresenceEntry } from '@/store/presence-store';

type FriendsListProps = {
  userId: string;
  title?: string;
};

const presenceOrder: Record<FriendPresenceStatus, number> = {
  IN_GAME: 0,
  ONLINE: 1,
  AFK: 2,
  OFFLINE: 3,
};

export function sortFriendsByPresence(friends: FriendSummary[]): FriendSummary[] {
  return [...friends].sort((left, right) => {
    const leftStatus = left.presence?.status ?? 'OFFLINE';
    const rightStatus = right.presence?.status ?? 'OFFLINE';

    return presenceOrder[leftStatus] - presenceOrder[rightStatus];
  });
}

function resolvePresence(
  friend: FriendSummary,
  realtimePresence: PresenceEntry | undefined,
) {
  return {
    status: realtimePresence?.status ?? friend.presence?.status ?? 'OFFLINE',
    currentGame: realtimePresence?.currentGame ?? friend.presence?.currentGame ?? null,
    platform: realtimePresence?.platform ?? friend.presence?.platform ?? null,
  } as const;
}

export function sortFriendsByEffectivePresence(
  friends: FriendSummary[],
  entries: Record<string, PresenceEntry>,
): FriendSummary[] {
  return [...friends].sort((left, right) => {
    const leftStatus = resolvePresence(left, entries[left.id]).status;
    const rightStatus = resolvePresence(right, entries[right.id]).status;

    return presenceOrder[leftStatus] - presenceOrder[rightStatus];
  });
}

function FriendsListLoadingState() {
  return (
    <Card data-testid="friends-list-loading">
      <div className="space-y-4">
        <div className="h-6 w-44 animate-pulse rounded-control bg-background-tertiary" />
        <div className="h-16 animate-pulse rounded-control bg-background-tertiary" />
        <div className="h-16 animate-pulse rounded-control bg-background-tertiary" />
      </div>
    </Card>
  );
}

export function FriendsList({
  userId,
  title = 'Amigos',
}: FriendsListProps) {
  const presenceEntries = usePresenceStore((state) => state.entries);
  const friendsQuery = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => fetchFriends(userId),
  });

  if (friendsQuery.isPending) {
    return <FriendsListLoadingState />;
  }

  if (friendsQuery.isError) {
    return (
      <Card data-testid="friends-list-error">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Amizades
          </p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Nao foi possivel carregar a lista de amigos
          </h2>
        </div>
      </Card>
    );
  }

  const friends = sortFriendsByEffectivePresence(friendsQuery.data, presenceEntries);

  if (friends.length === 0) {
    return (
      <Card data-testid="friends-list-empty">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Amizades
          </p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Nenhum amigo encontrado
          </h2>
        </div>
      </Card>
    );
  }

  return (
    <Card data-testid="friends-list-success">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Amizades
          </p>
          <h2 className="font-display text-2xl font-semibold text-primary">{title}</h2>
        </div>

        <div className="space-y-3">
          {friends.map((friend) => {
            const displayName =
              friend.profile?.displayName && friend.profile.displayName.length > 0
                ? friend.profile.displayName
                : friend.username;
            const avatarFallback = friend.username.slice(0, 2).toUpperCase();
            const effectivePresence = resolvePresence(friend, presenceEntries[friend.id]);

            return (
              <div
                key={friend.id}
                data-testid="friend-list-item"
                className="flex items-center justify-between gap-4 rounded-control border border-border bg-background-secondary/60 px-control-x py-control-y"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={friend.profile?.avatarUrl}
                    alt={friend.username}
                    fallback={avatarFallback}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-secondary">@{friend.username}</p>
                  </div>
                </div>

                <PresenceBadge
                  status={effectivePresence.status}
                  currentGame={effectivePresence.currentGame}
                  platform={effectivePresence.platform}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
