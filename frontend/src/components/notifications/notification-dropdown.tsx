'use client';

import Link from 'next/link';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { NotificationRecord } from '@/schemas/notifications';

type NotificationDropdownProps = {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  isMarkingAllRead?: boolean;
  activeNotificationId?: string | null;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
};

export function NotificationDropdown({
  notifications,
  unreadCount,
  isLoading,
  isError,
  isMarkingAllRead = false,
  activeNotificationId = null,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const previewItems = notifications.slice(0, 5);

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Notifications
            </p>
            <h2 className="font-display text-xl font-semibold text-primary">
              Activity inbox
            </h2>
            <p className="text-sm leading-6 text-secondary">
              {unreadCount > 0
                ? `${unreadCount} notificacao${unreadCount > 1 ? 'es' : ''} nao lida${unreadCount > 1 ? 's' : ''}.`
                : 'Nenhuma notificacao pendente agora.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="text-sm font-medium text-accent-cyan transition hover:text-primary"
            >
              Ver todas
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || isMarkingAllRead}
              onClick={onMarkAllAsRead}
            >
              {isMarkingAllRead ? 'Marcando...' : 'Marcar todas'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-secondary">Carregando notificacoes...</p>
        ) : null}

        {isError ? (
          <p className="text-sm text-status-afk">
            Nao foi possivel carregar as notificacoes agora.
          </p>
        ) : null}

        {!isLoading && !isError && previewItems.length === 0 ? (
          <p className="text-sm text-secondary">
            Seu inbox esta limpo no momento.
          </p>
        ) : null}

        {previewItems.length > 0 ? (
          <div className="space-y-3">
            {previewItems.map((notification) => (
              <NotificationItem
                key={notification.id}
                compact
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                isMarkingRead={activeNotificationId === notification.id}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
