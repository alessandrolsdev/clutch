'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import {
  CommunitiesRequestError,
  createCommunity,
  fetchCommunities,
} from '@/services/communities';
import { CommunityCard } from './community-card';

function resolveMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunitiesRequestError) {
    return error.message;
  }

  return fallback;
}

export function CommunitiesPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const communitiesQuery = useQuery({
    queryKey: ['communities'],
    queryFn: fetchCommunities,
  });

  const createCommunityMutation = useMutation({
    mutationFn: createCommunity,
    onSuccess: async (community) => {
      setName('');
      setDescription('');
      setFormMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['communities'] });
      router.push(`/communities/${community.slug}`);
    },
    onError: (error) => {
      setFormMessage(
        resolveMutationErrorMessage(error, 'Nao foi possivel criar a comunidade agora.'),
      );
    },
  });

  const isAuthenticated = status === 'authenticated';
  const canSubmit = isAuthenticated && name.trim().length >= 3 && !createCommunityMutation.isPending;
  const visibleCommunities = communitiesQuery.data?.filter(
    (community) => community.status === 'ACTIVE',
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    createCommunityMutation.mutate({
      name,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-section">
      <SectionHeading
        eyebrow="Comunidades"
        title="Guildas públicas para pertencer sem virar chat"
        level="h1"
        description="O primeiro slice mantém descoberta simples, identidade básica e membership mínimo. Eventos, chat e governança pesada ficam fora deste recorte."
      />

      <Card tone="accent">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Criar comunidade pública
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-primary">
              Valide pertencimento com um grupo pequeno
            </h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Comunidades nascem públicas, com owner e membros. Sem eventos, chat ou roles
              avançadas neste slice.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <label className="flex flex-col gap-2 text-sm font-medium text-primary">
              Nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={3}
                maxLength={80}
                placeholder="Guilda dos Speedrunners"
                className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
                disabled={!isAuthenticated || createCommunityMutation.isPending}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-primary">
              Descrição curta
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={240}
                placeholder="Runs, PBs e desafios semanais."
                className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
                disabled={!isAuthenticated || createCommunityMutation.isPending}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary" role={formMessage ? 'alert' : undefined}>
              {formMessage ??
                (isAuthenticated
                  ? 'O slug é derivado do nome e recebe sufixo automático quando necessário.'
                  : 'Entre na sessão para criar uma comunidade pública.')}
            </p>
            <Button type="submit" disabled={!canSubmit}>
              Criar comunidade
            </Button>
          </div>
        </form>
      </Card>

      {communitiesQuery.isLoading ? (
        <Card>
          <p className="text-sm text-secondary">Carregando comunidades públicas...</p>
        </Card>
      ) : null}

      {communitiesQuery.isError ? (
        <Card>
          <p className="text-sm text-secondary" role="alert">
            Não foi possível carregar comunidades públicas agora.
          </p>
        </Card>
      ) : null}

      {visibleCommunities?.length === 0 ? (
        <Card>
          <p className="text-sm leading-6 text-secondary">
            Ainda não há comunidades públicas. Crie a primeira para validar o fluxo básico
            de pertencimento.
          </p>
        </Card>
      ) : null}

      {visibleCommunities && visibleCommunities.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {visibleCommunities.map((community) => (
            <CommunityCard key={community.id} community={community} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
