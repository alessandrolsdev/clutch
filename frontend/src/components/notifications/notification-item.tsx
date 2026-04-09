'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';
import {
  friendAcceptedNotificationPayloadSchema,
  friendRequestNotificationPayloadSchema,
  postCommentNotificationPayloadSchema,
  postLikeNotificationPayloadSchema,
  type NotificationRecord,
} from '@/schemas/notifications';
import { cn } from '@/lib/utils/cn';

type NotificationItemProps = {
  notification: NotificationRecord;
  onMarkAsRead?: (notificationId: string) => void;
  isMarkingRead?: boolean;
  compact?: boolean;
};

type NotificationPresentation = {
  label: string;
  title: string;
  description: string;
  badgeTone: 'accent' | 'neutral' | 'success' | 'warning';
  ctaHref?: string;
  ctaLabel?: string;
};

function getNotificationPresentation(
  notification: NotificationRecord,
): NotificationPresentation {
  switch (notification.type) {
    case 'FRIEND_REQUEST': {
      const payload = friendRequestNotificationPayloadSchema.safeParse(notification.payload);

      return {
        label: 'Friends',
        title: 'Pedido de amizade recebido',
        description: payload.success
          ? 'Um jogador enviou um novo pedido de amizade para voce.'
          : 'Existe um novo pedido de amizade aguardando resposta.',
        badgeTone: notification.isRead ? 'neutral' : 'accent',
      };
    }
    case 'FRIEND_ACCEPTED': {
      const payload = friendAcceptedNotificationPayloadSchema.safeParse(notification.payload);

      return {
        label: 'Friends',
        title: 'Pedido de amizade aceito',
        description: payload.success
          ? 'Seu pedido de amizade foi aceito.'
          : 'Uma amizade foi confirmada recentemente.',
        badgeTone: notification.isRead ? 'neutral' : 'success',
      };
    }
    case 'POST_LIKE': {
      const payload = postLikeNotificationPayloadSchema.safeParse(notification.payload);

      return {
        label: 'Feed',
        title: 'Nova reaction no seu post',
        description: payload.success
          ? `Um jogador reagiu ao seu post com ${payload.data.interactionType}.`
          : 'Seu post recebeu uma nova reaction.',
        badgeTone: notification.isRead ? 'neutral' : 'accent',
        ctaHref: '/feed',
        ctaLabel: 'Ver feed',
      };
    }
    case 'POST_COMMENT': {
      const payload = postCommentNotificationPayloadSchema.safeParse(notification.payload);
      const isReply = payload.success && payload.data.parentId !== null;

      return {
        label: 'Feed',
        title: isReply ? 'Nova resposta no feed' : 'Novo comentario no seu post',
        description: isReply
          ? 'Um jogador respondeu a um comentario ligado ao seu post.'
          : 'Seu post recebeu um novo comentario.',
        badgeTone: notification.isRead ? 'neutral' : 'accent',
        ctaHref: '/feed',
        ctaLabel: 'Ver feed',
      };
    }
    case 'GAME_INVITE':
      return {
        label: 'Social',
        title: 'Convite de jogo',
        description: 'Existe um convite de jogo aguardando sua atencao.',
        badgeTone: notification.isRead ? 'neutral' : 'warning',
      };
    case 'FRIEND_NOW_PLAYING':
      return {
        label: 'Presence',
        title: 'Amigo jogando agora',
        description: 'Um amigo acabou de iniciar uma nova sessao de jogo.',
        badgeTone: notification.isRead ? 'neutral' : 'success',
      };
    case 'SYSTEM':
    default:
      return {
        label: 'System',
        title: 'Atualizacao do CLUTCH',
        description: 'Existe uma nova atualizacao operacional para voce revisar.',
        badgeTone: notification.isRead ? 'neutral' : 'warning',
      };
  }
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  isMarkingRead = false,
  compact = false,
}: NotificationItemProps) {
  const presentation = getNotificationPresentation(notification);
  const showMarkAsRead = !notification.isRead && typeof onMarkAsRead === 'function';

  return (
    <Card
      data-testid="notification-item"
      className={cn(
        'space-y-4',
        !notification.isRead && 'border-accent-cyan/50 bg-[rgba(6,182,212,0.06)]',
        compact && 'p-4',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge tone={presentation.badgeTone}>{presentation.label}</Badge>
          <div className="space-y-1">
            <h3 className="font-medium text-primary">{presentation.title}</h3>
            <p className="text-sm leading-6 text-secondary">{presentation.description}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <HydrationSafeTime
            value={notification.createdAt}
            options={{ dateStyle: 'short', timeStyle: 'short' }}
            fallback={notification.createdAt}
            className="text-xs uppercase tracking-[0.24em] text-secondary"
          />
          <Badge tone={notification.isRead ? 'neutral' : 'accent'}>
            {notification.isRead ? 'Lida' : 'Nao lida'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {presentation.ctaHref && presentation.ctaLabel ? (
          <Link
            href={presentation.ctaHref}
            className="text-sm font-medium text-accent-cyan transition hover:text-primary"
          >
            {presentation.ctaLabel}
          </Link>
        ) : null}

        {showMarkAsRead ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isMarkingRead}
            onClick={() => {
              onMarkAsRead(notification.id);
            }}
          >
            {isMarkingRead ? 'Marcando...' : 'Marcar como lida'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
