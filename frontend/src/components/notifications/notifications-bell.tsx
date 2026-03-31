'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
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

  const invalidateNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'all'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread'] }),
    ]);
  };

  const markOneMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onMutate: (notificationId) => {
      setActiveNotificationId(notificationId);
    },
    onSuccess: async () => {
      await invalidateNotifications();
    },
    onSettled: () => {
      setActiveNotificationId(null);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: async () => {
      await invalidateNotifications();
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
