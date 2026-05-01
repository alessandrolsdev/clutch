'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import {
  ArenaRequestError,
  fetchArenaChallenges,
  fetchArenaLeaderboard,
  joinArenaChallenge,
  submitArenaProof,
} from '@/services/arena';
import type { ArenaChallenge, ArenaLeaderboardEntry } from '@/schemas/arena';

function resolveArenaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ArenaRequestError) {
    return error.message;
  }

  return fallback;
}

function proofLabel(ruleType: ArenaChallenge['ruleType']): string {
  if (ruleType === 'GAME_SESSION') {
    return 'GAME_SESSION';
  }

  if (ruleType === 'ACHIEVEMENT') {
    return 'ACHIEVEMENT';
  }

  return 'Evento comunitário';
}

function ChallengeCard({
  challenge,
  selected,
  onSelect,
}: {
  challenge: ArenaChallenge;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left"
      aria-pressed={selected}
    >
      <Card tone={selected ? 'accent' : 'neutral'} className="h-full transition hover:border-accent-cyan">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={selected ? 'accent' : 'neutral'}>Ranking local</Badge>
          <Badge tone="neutral">{proofLabel(challenge.ruleType)}</Badge>
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold text-primary">
          {challenge.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-secondary">{challenge.description}</p>
        <div className="mt-5 grid gap-3 text-sm text-secondary sm:grid-cols-2">
          <span>{challenge.scoreValue} pts por prova</span>
          <span>Cap {challenge.maxSubmissionsPerUser} provas</span>
          <span>{challenge.participantCount} participantes</span>
          <span>{challenge.submissionCount} submissões</span>
        </div>
      </Card>
    </button>
  );
}

function Leaderboard({ entries }: { entries: ArenaLeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm leading-6 text-secondary">
          O ranking local ainda está vazio. Entre no desafio e envie a primeira prova elegível.
        </p>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-surface border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-primary text-left text-xs uppercase tracking-[0.24em] text-secondary">
          <tr>
            <th className="px-4 py-3">Posição</th>
            <th className="px-4 py-3">Jogador</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Provas</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.userId} className="border-t border-border bg-[rgba(26,26,39,0.55)]">
              <td className="px-4 py-4 font-semibold text-primary">#{entry.position}</td>
              <td className="px-4 py-4">
                <span className="block font-medium text-primary">
                  {entry.displayName ?? entry.username}
                </span>
                <span className="text-xs text-secondary">@{entry.username}</span>
              </td>
              <td className="px-4 py-4 text-primary">{entry.score}</td>
              <td className="px-4 py-4 text-secondary">{entry.submissionsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallengeDetail({ challenge }: { challenge: ArenaChallenge }) {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [proofId, setProofId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const leaderboardQuery = useQuery({
    queryKey: ['arena', 'leaderboard', challenge.id],
    queryFn: () => fetchArenaLeaderboard(challenge.id),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinArenaChallenge(challenge.id),
    onSuccess: async () => {
      setMessage('Você entrou no desafio. Agora envie uma prova elegível.');
      await queryClient.invalidateQueries({ queryKey: ['arena', 'challenges'] });
    },
    onError: (error) => {
      setMessage(resolveArenaErrorMessage(error, 'Não foi possível entrar no desafio.'));
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitArenaProof(challenge.id, {
      proofType: challenge.ruleType === 'ACHIEVEMENT' ? 'ACHIEVEMENT' : 'GAME_SESSION',
      proofId,
    }),
    onSuccess: async () => {
      setProofId('');
      setMessage('Prova enviada. O ranking local foi atualizado.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['arena', 'challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['arena', 'leaderboard', challenge.id] }),
      ]);
    },
    onError: (error) => {
      setMessage(resolveArenaErrorMessage(error, 'Não foi possível submeter esta prova.'));
    },
  });

  const isAuthenticated = status === 'authenticated';
  const proofInputIsDisabled =
    !challenge.viewerHasJoined ||
    submitMutation.isPending ||
    challenge.ruleType === 'COMMUNITY_EVENT_RSVP';
  const canSubmitProof =
    isAuthenticated &&
    challenge.viewerHasJoined &&
    proofId.trim().length > 0 &&
    !submitMutation.isPending &&
    challenge.ruleType !== 'COMMUNITY_EVENT_RSVP';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitProof) {
      return;
    }

    submitMutation.mutate();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
      <Card tone="accent" className="flex flex-col gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">MVP Arena</Badge>
            <Badge tone="neutral">{proofLabel(challenge.ruleType)}</Badge>
            {challenge.viewerHasJoined ? <Badge tone="success">Participando</Badge> : null}
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold text-primary">
            {challenge.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-secondary">{challenge.description}</p>
        </div>

        <div className="grid gap-4 text-sm text-secondary sm:grid-cols-2">
          <div>
            <span className="block text-xs uppercase tracking-[0.24em] text-secondary">
              Início
            </span>
            <HydrationSafeTime
              value={challenge.startsAt}
              options={{ dateStyle: 'short', timeStyle: 'short' }}
              className="mt-1 block text-primary"
            />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-[0.24em] text-secondary">
              Encerramento
            </span>
            <HydrationSafeTime
              value={challenge.endsAt}
              options={{ dateStyle: 'short', timeStyle: 'short' }}
              className="mt-1 block text-primary"
            />
          </div>
          <div>{challenge.scoreValue} pontos por prova aceita</div>
          <div>Limite de {challenge.maxSubmissionsPerUser} provas por jogador</div>
        </div>

        {!isAuthenticated ? (
          <p className="text-sm leading-6 text-secondary">
            Entre na sessão para participar do desafio Arena.
          </p>
        ) : challenge.viewerHasJoined ? (
          <p className="text-sm leading-6 text-secondary">
            Use o ID de um post {proofLabel(challenge.ruleType)} seu, criado dentro da janela
            do desafio. Presence passiva, reactions e comments não pontuam.
          </p>
        ) : (
          <Button
            type="button"
            disabled={joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
          >
            Entrar no desafio
          </Button>
        )}

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-primary">
            ID do post de prova
            <input
              value={proofId}
              onChange={(event) => setProofId(event.target.value)}
              placeholder="post-id"
              disabled={proofInputIsDisabled}
              className="h-11 rounded-control border border-border bg-surface-primary px-control-x text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary" role={message ? 'alert' : undefined}>
              {message ?? 'Ranking local, sem season formal ou reward engine neste MVP.'}
            </p>
            <Button type="submit" disabled={!canSubmitProof}>
              Submeter prova
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Ranking local
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-primary">
            Placares deste desafio
          </h2>
        </div>
        {leaderboardQuery.isLoading ? (
          <Card>
            <p className="text-sm text-secondary">Carregando ranking local...</p>
          </Card>
        ) : null}
        {leaderboardQuery.isError ? (
          <Card>
            <p className="text-sm text-secondary" role="alert">
              Não foi possível carregar o ranking local.
            </p>
          </Card>
        ) : null}
        {leaderboardQuery.data ? <Leaderboard entries={leaderboardQuery.data} /> : null}
      </div>
    </div>
  );
}

export function ArenaPageContent() {
  const challengesQuery = useQuery({
    queryKey: ['arena', 'challenges'],
    queryFn: fetchArenaChallenges,
  });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedChallenge = useMemo(() => {
    const challenges = challengesQuery.data ?? [];
    return challenges.find((challenge) => challenge.slug === selectedSlug) ?? challenges[0] ?? null;
  }, [challengesQuery.data, selectedSlug]);

  return (
    <div className="flex flex-col gap-section">
      <SectionHeading
        eyebrow="Modo Arena"
        title="Desafios semanais assíncronos"
        level="h1"
        description="O MVP valida competição voluntária com provas leves, score simples e ranking local. Sem ranking global, temporada formal, guild wars ou reward engine."
      />

      {challengesQuery.isLoading ? (
        <Card>
          <p className="text-sm text-secondary">Carregando desafios Arena ativos...</p>
        </Card>
      ) : null}

      {challengesQuery.isError ? (
        <Card>
          <p className="text-sm text-secondary" role="alert">
            Não foi possível carregar os desafios Arena agora.
          </p>
        </Card>
      ) : null}

      {challengesQuery.data?.length === 0 ? (
        <Card>
          <p className="text-sm leading-6 text-secondary">
            Ainda não há desafios Arena ativos. O slice está pronto para exibir desafios
            semanais quando forem criados pelo backend.
          </p>
        </Card>
      ) : null}

      {challengesQuery.data && challengesQuery.data.length > 0 ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {challengesQuery.data.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                selected={selectedChallenge?.id === challenge.id}
                onSelect={() => setSelectedSlug(challenge.slug)}
              />
            ))}
          </div>

          {selectedChallenge ? <ChallengeDetail challenge={selectedChallenge} /> : null}
        </>
      ) : null}
    </div>
  );
}
