'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import type { CommunityEventRsvpStatus, CommunityRole } from '@/schemas/communities';
import {
  cancelCommunityEvent,
  CommunitiesRequestError,
  createCommunityEvent,
  fetchCommunityEvents,
  setCommunityEventRsvp,
} from '@/services/communities';

type CommunityEventsPanelProps = {
  slug: string;
  isArchived: boolean;
  isAuthenticated: boolean;
  viewerMembershipRole: CommunityRole | null;
};

const rsvpOptions: Array<{ status: CommunityEventRsvpStatus; label: string }> = [
  { status: 'GOING', label: 'Vou' },
  { status: 'INTERESTED', label: 'Tenho interesse' },
  { status: 'NOT_GOING', label: 'Não vou' },
];

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunitiesRequestError) {
    return error.message;
  }

  return fallback;
}

function formatUtcDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function CommunityEventsPanel({
  slug,
  isArchived,
  isAuthenticated,
  viewerMembershipRole,
}: CommunityEventsPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const isOwner = viewerMembershipRole === 'OWNER';
  const isMember = viewerMembershipRole === 'OWNER' || viewerMembershipRole === 'MEMBER';

  const eventsQuery = useQuery({
    queryKey: ['communities', slug, 'events'],
    queryFn: () => fetchCommunityEvents(slug),
  });

  const invalidateEvents = async () => {
    await queryClient.invalidateQueries({ queryKey: ['communities', slug, 'events'] });
  };

  const createEventMutation = useMutation({
    mutationFn: () =>
      createCommunityEvent(slug, {
        title,
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
      }),
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setStartsAt('');
      setFormMessage(null);
      await invalidateEvents();
    },
    onError: (error) => {
      setFormMessage(resolveErrorMessage(error, 'Não foi possível criar o evento.'));
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: ({
      eventId,
      status,
    }: {
      eventId: string;
      status: CommunityEventRsvpStatus;
    }) => setCommunityEventRsvp(slug, eventId, status),
    onSuccess: invalidateEvents,
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) => cancelCommunityEvent(slug, eventId),
    onSuccess: invalidateEvents,
  });

  const canCreate =
    !isArchived &&
    isOwner &&
    title.trim().length >= 3 &&
    startsAt.length > 0 &&
    !createEventMutation.isPending;
  const actionError = rsvpMutation.error ?? cancelMutation.error;

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      return;
    }

    createEventMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        eyebrow="Eventos"
        title="Agenda comunitária mínima"
        description={
          isArchived
            ? 'Esta comunidade está arquivada. Eventos existentes continuam visíveis, mas criação e RSVP estão bloqueados.'
            : 'Eventos ficam dentro da comunidade, com RSVP simples. Sem calendário, recorrência, chat ou reminders neste slice.'
        }
        level="h2"
      />

      {isOwner && !isArchived ? (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={handleCreateEvent}>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                Criar evento
              </p>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Owner cria eventos publicados diretamente. A moderação avançada fica fora.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="flex flex-col gap-2 text-sm font-medium text-primary">
                Título
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={3}
                  maxLength={100}
                  placeholder="Noite de ranked"
                  className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
                  disabled={createEventMutation.isPending}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-primary">
                Início
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
                  disabled={createEventMutation.isPending}
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-primary">
              Descrição curta
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={280}
                placeholder="Fila fechada para subir elo."
                className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
                disabled={createEventMutation.isPending}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-secondary" role={formMessage ? 'alert' : undefined}>
                {formMessage ?? 'O horário é enviado como instante UTC para o backend.'}
              </p>
              <Button type="submit" disabled={!canCreate}>
                Criar evento
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {isArchived ? (
        <Card>
          <p className="text-sm leading-6 text-secondary">
            Comunidade arquivada. Eventos seguem em modo leitura, sem criação, RSVP ou
            cancelamento pela interface.
          </p>
        </Card>
      ) : null}

      {eventsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-secondary">Carregando eventos da comunidade...</p>
        </Card>
      ) : null}

      {eventsQuery.isError ? (
        <Card>
          <p className="text-sm text-secondary" role="alert">
            Não foi possível carregar os eventos desta comunidade.
          </p>
        </Card>
      ) : null}

      {eventsQuery.data?.length === 0 ? (
        <Card>
          <p className="text-sm leading-6 text-secondary">
            Ainda não há eventos publicados nesta comunidade. Quando o owner criar o
            primeiro, ele aparecerá aqui.
          </p>
        </Card>
      ) : null}

      {eventsQuery.data && eventsQuery.data.length > 0 ? (
        <div className="grid gap-4">
          {eventsQuery.data.map((event) => {
            const isCancelled = event.status === 'CANCELLED';

            return (
              <Card key={event.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={isCancelled ? 'warning' : 'success'}>
                        {isCancelled ? 'Cancelado' : 'Publicado'}
                      </Badge>
                      {event.viewerRsvp ? <Badge tone="accent">{event.viewerRsvp}</Badge> : null}
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-semibold text-primary">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                      {event.description ?? 'Evento sem descrição adicional.'}
                    </p>
                  </div>

                  <div className="text-right text-sm text-secondary">
                    <p className="font-medium text-primary">{formatUtcDateTime(event.startsAt)}</p>
                    <p className="mt-1">UTC</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-secondary">
                  <span>{event.rsvpCounts.going} vou</span>
                  <span>{event.rsvpCounts.interested} interesse</span>
                  <span>{event.rsvpCounts.notGoing} não vou</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-secondary">
                    Criado por {event.createdBy.displayName ?? event.createdBy.username}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {isAuthenticated && isMember && !isArchived && !isCancelled
                      ? rsvpOptions.map((option) => (
                          <Button
                            key={option.status}
                            type="button"
                            size="sm"
                            variant={event.viewerRsvp === option.status ? 'primary' : 'secondary'}
                            disabled={rsvpMutation.isPending}
                            onClick={() =>
                              rsvpMutation.mutate({ eventId: event.id, status: option.status })
                            }
                          >
                            {option.label}
                          </Button>
                        ))
                      : null}

                    {isOwner && !isArchived && !isCancelled ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(event.id)}
                      >
                        Cancelar evento
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-status-afk" role="alert">
          {resolveErrorMessage(actionError, 'Não foi possível atualizar o evento.')}
        </p>
      ) : null}

      {!isAuthenticated && !isArchived ? (
        <p className="text-sm text-secondary">
          Entre na sessão para responder RSVP nos eventos da comunidade.
        </p>
      ) : null}
    </div>
  );
}
