'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import {
  CommunitiesRequestError,
  fetchCommunityBySlug,
  joinCommunity,
  leaveCommunity,
} from '@/services/communities';

type CommunityPageContentProps = {
  slug: string;
};

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunitiesRequestError) {
    return error.message;
  }

  return fallback;
}

export function CommunityPageContent({ slug }: CommunityPageContentProps) {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const communityQuery = useQuery({
    queryKey: ['communities', slug],
    queryFn: () => fetchCommunityBySlug(slug),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinCommunity(slug),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities'] }),
        queryClient.invalidateQueries({ queryKey: ['communities', slug] }),
      ]);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveCommunity(slug),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities'] }),
        queryClient.invalidateQueries({ queryKey: ['communities', slug] }),
      ]);
    },
  });

  if (communityQuery.isLoading) {
    return (
      <Card>
        <p className="text-sm text-secondary">Carregando comunidade pública...</p>
      </Card>
    );
  }

  if (communityQuery.isError || !communityQuery.data) {
    return (
      <Card>
        <p className="text-sm text-secondary" role="alert">
          Não foi possível carregar esta comunidade pública.
        </p>
        <Link
          href="/communities"
          className="mt-4 inline-flex text-sm font-medium text-accent-cyan transition hover:text-primary"
        >
          Voltar para comunidades
        </Link>
      </Card>
    );
  }

  const community = communityQuery.data;
  const isAuthenticated = status === 'authenticated';
  const ownerLabel = community.owner.displayName ?? community.owner.username;
  const isOwner = community.viewerMembershipRole === 'OWNER';
  const isMember = community.viewerMembershipRole === 'MEMBER';
  const actionIsPending = joinMutation.isPending || leaveMutation.isPending;
  const mutationError = joinMutation.error ?? leaveMutation.error;

  return (
    <div className="flex flex-col gap-section">
      <SectionHeading
        eyebrow="Comunidade pública"
        title={community.name}
        description={
          community.description ??
          'Espaço público para reunir jogadores em torno de um interesse compartilhado.'
        }
        actions={
          <Link
            href="/communities"
            className="text-sm font-medium text-accent-cyan transition hover:text-primary"
          >
            Ver todas
          </Link>
        }
      />

      <Card tone="accent" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{community.memberCount} membros</Badge>
              <Badge tone="neutral">Pública</Badge>
              {community.viewerMembershipRole ? (
                <Badge tone="accent">{community.viewerMembershipRole}</Badge>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-secondary">
              Owner: <span className="text-primary">{ownerLabel}</span>
            </p>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Este slice valida leitura pública e membership simples. Eventos, chat e
              governança avançada ainda não fazem parte desta comunidade.
            </p>
          </div>

          <div className="flex min-w-48 flex-col gap-2">
            {!isAuthenticated ? (
              <p className="text-sm leading-6 text-secondary">
                Entre na sessão para participar desta comunidade.
              </p>
            ) : isOwner ? (
              <Button type="button" variant="secondary" disabled>
                Você é owner
              </Button>
            ) : isMember ? (
              <Button
                type="button"
                variant="secondary"
                disabled={actionIsPending}
                onClick={() => leaveMutation.mutate()}
              >
                Sair da comunidade
              </Button>
            ) : (
              <Button
                type="button"
                disabled={actionIsPending}
                onClick={() => joinMutation.mutate()}
              >
                Participar
              </Button>
            )}
          </div>
        </div>

        {mutationError ? (
          <p className="text-sm text-status-afk" role="alert">
            {resolveErrorMessage(mutationError, 'Não foi possível atualizar o membership.')}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
