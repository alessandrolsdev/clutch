'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import {
  applyAllNotificationsRead,
  applyNotificationRead,
  restoreQuerySnapshots,
  snapshotQueryGroups,
} from '@/lib/query/social-cache';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications';

export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const userId = user?.id;

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId, 'all'],
    queryFn: () => fetchNotifications({ userId: userId as string }),
    enabled: status === 'authenticated' && typeof userId === 'string',
    refetchInterval: 30_000,
  });

  const markOneMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onMutate: async (notificationId) => {
      setActiveNotificationId(notificationId);

      await queryClient.cancelQueries({
        queryKey: ['notifications', userId],
      });

      const snapshots = snapshotQueryGroups(queryClient, [['notifications', userId]]);
      applyNotificationRead(queryClient, userId as string, notificationId);

      return { snapshots };
    },
    onError: (_error, _notificationId, context) => {
      if (context) {
        restoreQuerySnapshots(queryClient, context.snapshots);
      }
    },
    onSettled: async () => {
      setActiveNotificationId(null);

      await queryClient.invalidateQueries({
        queryKey: ['notifications', userId],
        refetchType: 'inactive',
      });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ['notifications', userId],
      });

      const snapshots = snapshotQueryGroups(queryClient, [['notifications', userId]]);
      applyAllNotificationsRead(queryClient, userId as string);

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        restoreQuerySnapshots(queryClient, context.snapshots);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['notifications', userId],
        refetchType: 'inactive',
      });
    },
  });

  if (status !== 'authenticated' || !userId) {
    return null;
  }

  const data = notificationsQuery.data;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Open notifications preview"
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        Notifications
        <Badge tone={data?.unreadCount ? 'accent' : 'neutral'}>
          {notificationsQuery.isPending ? '...' : String(data?.unreadCount ?? 0)}
        </Badge>
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[24rem] max-w-[calc(100vw-2rem)]">
          <NotificationDropdown
            notifications={data?.notifications ?? []}
            unreadCount={data?.unreadCount ?? 0}
            isLoading={notificationsQuery.isPending}
            isError={notificationsQuery.isError}
            activeNotificationId={activeNotificationId}
            isMarkingAllRead={markAllMutation.isPending}
            onMarkAsRead={(notificationId) => {
              markOneMutation.mutate(notificationId);
            }}
            onMarkAllAsRead={() => {
              markAllMutation.mutate();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
