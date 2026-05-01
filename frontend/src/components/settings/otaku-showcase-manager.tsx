'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import type { OtakuLibraryEntry } from '@/schemas/otaku';
import {
  fetchOtakuLibrary,
  OtakuRequestError,
  updateOtakuShowcaseEntry,
} from '@/services/otaku';

const statusLabel: Record<OtakuLibraryEntry['status'], string> = {
  PLANNING: 'Planejado',
  CONSUMING: 'Em consumo',
  COMPLETED: 'Concluido',
  PAUSED: 'Pausado',
  DROPPED: 'Abandonado',
};

function resolveErrorMessage(error: unknown): string {
  return error instanceof OtakuRequestError
    ? error.message
    : 'Nao foi possivel atualizar o showcase otaku agora.';
}

function resolveNextShowcaseRank(entries: OtakuLibraryEntry[], maxShowcaseItems: number): number | null {
  const usedRanks = new Set(
    entries
      .map((entry) => entry.showcaseRank)
      .filter((rank): rank is number => rank !== null),
  );

  for (let rank = 1; rank <= maxShowcaseItems; rank += 1) {
    if (!usedRanks.has(rank)) {
      return rank;
    }
  }

  return null;
}

type OtakuLibraryRowProps = {
  entry: OtakuLibraryEntry;
  isBusy: boolean;
  limitReached: boolean;
  onFeature(entry: OtakuLibraryEntry): void;
  onRemove(entry: OtakuLibraryEntry): void;
};

function OtakuLibraryRow({
  entry,
  isBusy,
  limitReached,
  onFeature,
  onRemove,
}: OtakuLibraryRowProps) {
  const isFeatured = entry.showcaseRank !== null;

  return (
    <li
      className="grid gap-4 rounded-control border border-border bg-background-secondary/70 p-4 sm:grid-cols-[72px_1fr_auto]"
      data-testid="otaku-library-entry"
    >
      <div className="relative h-24 w-[72px] overflow-hidden rounded-control border border-border bg-background-tertiary">
        {entry.coverUrl ? (
          <Image
            src={entry.coverUrl}
            alt={entry.title}
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-secondary">
            Sem capa
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{entry.kind}</Badge>
          <Badge tone={entry.status === 'CONSUMING' ? 'success' : 'neutral'}>
            {statusLabel[entry.status]}
          </Badge>
          {isFeatured ? <Badge tone="accent">Destaque #{entry.showcaseRank}</Badge> : null}
        </div>

        <p className="truncate text-sm font-semibold text-primary">{entry.title}</p>
        <p className="text-xs leading-5 text-secondary">
          {typeof entry.progress === 'number' ? `Progresso ${entry.progress}` : 'Progresso nao informado'}
          {typeof entry.score === 'number' ? ` · Nota ${entry.score}` : ''}
        </p>
      </div>

      <div className="flex items-center justify-start sm:justify-end">
        {isFeatured ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              onRemove(entry);
            }}
          >
            Remover destaque
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy || limitReached}
            onClick={() => {
              onFeature(entry);
            }}
          >
            Destacar
          </Button>
        )}
      </div>
    </li>
  );
}

export function OtakuShowcaseManager() {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const libraryQuery = useQuery({
    queryKey: ['otaku-library'],
    queryFn: fetchOtakuLibrary,
  });

  const showcaseMutation = useMutation({
    mutationFn: (input: { entryId: string; showcaseRank: number | null }) =>
      updateOtakuShowcaseEntry(input.entryId, { showcaseRank: input.showcaseRank }),
    onMutate: ({ entryId }) => {
      setBusyEntryId(entryId);
      setFeedbackMessage(null);
      setErrorMessage(null);
    },
    onSuccess: async (response) => {
      setFeedbackMessage(
        response.entry.showcaseRank === null
          ? `${response.entry.title} saiu do showcase publico.`
          : `${response.entry.title} agora aparece no showcase publico.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['otaku-library'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error));
    },
    onSettled: () => {
      setBusyEntryId(null);
    },
  });

  const entries = useMemo(() => libraryQuery.data?.entries ?? [], [libraryQuery.data?.entries]);
  const maxShowcaseItems = libraryQuery.data?.maxShowcaseItems ?? 3;
  const featuredCount = entries.filter((entry) => entry.showcaseRank !== null).length;
  const nextShowcaseRank = useMemo(
    () => resolveNextShowcaseRank(entries, maxShowcaseItems),
    [entries, maxShowcaseItems],
  );
  const limitReached = featuredCount >= maxShowcaseItems;

  return (
    <Card data-testid="otaku-showcase-manager">
      <div className="space-y-5">
        <SectionHeading
          eyebrow="Anime e manga"
          title="Showcase otaku"
          description="Escolha ate tres obras importadas para aparecer no perfil publico. A biblioteca completa continua privada."
        />

        {feedbackMessage ? (
          <div className="rounded-control border border-status-online/40 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm text-primary">
            {feedbackMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
            {errorMessage}
          </div>
        ) : null}

        {libraryQuery.isPending ? (
          <div className="rounded-control border border-border bg-background-tertiary/60 px-4 py-4 text-sm text-secondary">
            Carregando obras importadas...
          </div>
        ) : null}

        {libraryQuery.isError ? (
          <div className="rounded-control border border-border bg-background-tertiary/60 px-4 py-4 text-sm text-secondary">
            Nao foi possivel carregar os itens otaku agora.
          </div>
        ) : null}

        {libraryQuery.isSuccess && entries.length === 0 ? (
          <div data-testid="otaku-library-empty" className="rounded-control border border-border bg-background-tertiary/60 px-4 py-4 text-sm text-secondary">
            Importe listas do MyAnimeList para selecionar destaques aqui.
          </div>
        ) : null}

        {libraryQuery.isSuccess && entries.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-background-tertiary/50 px-4 py-3">
              <p className="text-sm text-secondary">
                {featuredCount} de {maxShowcaseItems} destaques selecionados. Nada e publicado no feed.
              </p>
              {limitReached ? <Badge tone="warning">Limite atingido</Badge> : null}
            </div>

            <ul className="space-y-3">
              {entries.map((entry) => (
                <OtakuLibraryRow
                  key={entry.id}
                  entry={entry}
                  isBusy={busyEntryId === entry.id}
                  limitReached={limitReached}
                  onFeature={(selectedEntry) => {
                    if (nextShowcaseRank !== null) {
                      showcaseMutation.mutate({
                        entryId: selectedEntry.id,
                        showcaseRank: nextShowcaseRank,
                      });
                    }
                  }}
                  onRemove={(selectedEntry) => {
                    showcaseMutation.mutate({
                      entryId: selectedEntry.id,
                      showcaseRank: null,
                    });
                  }}
                />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Card>
  );
}
