'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NotificationsRequestError,
} from '@/services/notifications';

function NotificationsLoadingState() {
  return (
    <div className="space-y-4" data-testid="notifications-loading">
      <Card>
        <div className="h-8 w-56 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-5 w-full animate-pulse rounded-control bg-background-tertiary" />
      </Card>
      <Card>
        <div className="h-6 w-44 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    </div>
  );
}

function NotificationsErrorState() {
  return (
    <Card data-testid="notifications-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Notifications</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nao foi possivel carregar as notificacoes
        </h2>
        <p className="text-sm leading-6 text-secondary">
          Tente novamente em alguns instantes.
        </p>
      </div>
    </Card>
  );
}

function NotificationsEmptyState() {
  return (
    <Card data-testid="notifications-empty">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Notifications</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Inbox limpo
        </h2>
        <p className="text-sm leading-6 text-secondary">
          Novas interacoes do CLUTCH aparecem aqui assim que chegarem.
        </p>
      </div>
    </Card>
  );
}

export function NotificationsPageContent() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { status, user } = useAuth();
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
    onSuccess: async () => {
      showToast({
        title: 'Notificacao atualizada',
        description: 'A notificacao foi marcada como lida.',
        tone: 'success',
      });
      await invalidateNotifications();
    },
    onError: (error) => {
      const description = error instanceof NotificationsRequestError
        ? error.message
        : 'Tente novamente em alguns instantes.';

      showToast({
        title: 'Nao foi possivel atualizar a notificacao',
        description,
        tone: 'error',
      });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: async () => {
      showToast({
        title: 'Inbox atualizado',
        description: 'Todas as notificacoes foram marcadas como lidas.',
        tone: 'success',
      });
      await invalidateNotifications();
    },
    onError: (error) => {
      const description = error instanceof NotificationsRequestError
        ? error.message
        : 'Tente novamente em alguns instantes.';

      showToast({
        title: 'Nao foi possivel limpar o inbox',
        description,
        tone: 'error',
      });
    },
  });

  if (status === 'loading') {
    return <NotificationsLoadingState />;
  }

  if (status !== 'authenticated' || !userId) {
    return <NotificationsErrorState />;
  }

  if (notificationsQuery.isPending) {
    return <NotificationsLoadingState />;
  }

  if (notificationsQuery.isError) {
    return <NotificationsErrorState />;
  }

  const data = notificationsQuery.data;

  return (
    <section className="space-y-section" data-testid="notifications-success">
      <SectionHeading
        eyebrow="Notifications"
        title="Seu inbox social"
        description="Acompanhe amizade, reactions e comentarios usando apenas o contrato real do backend."
        level="h1"
        actions={(
          <Button
            variant="secondary"
            size="sm"
            disabled={data.unreadCount === 0 || markAllMutation.isPending}
            onClick={() => {
              markAllMutation.mutate();
            }}
          >
            {markAllMutation.isPending ? 'Marcando...' : 'Marcar todas como lidas'}
          </Button>
        )}
      />

      {data.notifications.length === 0 ? <NotificationsEmptyState /> : null}

      {data.notifications.length > 0 ? (
        <div className="space-y-4">
          {data.notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={(notificationId) => {
                markOneMutation.mutate(notificationId);
              }}
              isMarkingRead={
                markOneMutation.isPending && markOneMutation.variables === notification.id
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
