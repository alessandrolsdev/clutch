'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GameCard, type LibraryGameRecord } from '@/components/library/game-card';
import {
  LibraryFilters,
  type LibrarySortOption,
} from '@/components/library/library-filters';
import { LibrarySearch } from '@/components/library/library-search';
import { LibraryStats } from '@/components/library/library-stats';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { fetchProfileByUsername, ProfileRequestError } from '@/services/profile';

type LibraryPageContentProps = {
  username: string;
};

function sortLibraryGames(
  games: LibraryGameRecord[],
  sortBy: LibrarySortOption,
): LibraryGameRecord[] {
  const sortedGames = [...games];

  const compareAlphabetically = (left: LibraryGameRecord, right: LibraryGameRecord): number => {
    return left.gameName.localeCompare(right.gameName, 'pt-BR');
  };

  const resolveTimestamp = (value: string | null): number => {
    if (!value) {
      return 0;
    }

    const parsedValue = new Date(value).getTime();

    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  };

  sortedGames.sort((left, right) => {
    if (sortBy === 'most-played') {
      const hoursDifference = (right.hoursPlayed ?? -1) - (left.hoursPlayed ?? -1);

      if (hoursDifference !== 0) {
        return hoursDifference;
      }

      const recentDifference = resolveTimestamp(right.lastPlayedAt) - resolveTimestamp(left.lastPlayedAt);

      if (recentDifference !== 0) {
        return recentDifference;
      }

      return compareAlphabetically(left, right);
    }

    if (sortBy === 'recent') {
      const recentDifference = resolveTimestamp(right.lastPlayedAt) - resolveTimestamp(left.lastPlayedAt);

      if (recentDifference !== 0) {
        return recentDifference;
      }

      const hoursDifference = (right.hoursPlayed ?? -1) - (left.hoursPlayed ?? -1);

      if (hoursDifference !== 0) {
        return hoursDifference;
      }

      return compareAlphabetically(left, right);
    }

    return compareAlphabetically(left, right);
  });

  return sortedGames;
}

function LibraryLoadingState() {
  return (
    <div className="space-y-section" data-testid="library-loading">
      <Card>
        <div className="h-8 w-64 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-5 w-80 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="p-0">
            <div className="h-40 animate-pulse bg-background-tertiary" />
            <div className="space-y-3 p-card">
              <div className="h-5 w-40 animate-pulse rounded-control bg-background-tertiary" />
              <div className="h-4 w-24 animate-pulse rounded-control bg-background-tertiary" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LibraryErrorState({ message }: { message: string }) {
  return (
    <Card data-testid="library-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Biblioteca</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Nao foi possivel carregar a biblioteca
        </h1>
        <p className="text-sm leading-6 text-secondary">{message}</p>
      </div>
    </Card>
  );
}

function LibraryEmptyState({
  hasGames,
  hasActiveRefinements,
  onReset,
}: {
  hasGames: boolean;
  hasActiveRefinements: boolean;
  onReset: () => void;
}) {
  return (
    <Card data-testid="library-empty">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Biblioteca</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          {hasGames ? 'Nenhum jogo corresponde aos filtros atuais' : 'Biblioteca vazia'}
        </h2>
        <p className="text-sm leading-6 text-secondary">
          {hasGames
            ? 'Ajuste a busca, a plataforma ou a ordenacao para ver outros jogos.'
            : 'Este perfil ainda nao possui jogos importados pelas integracoes atuais.'}
        </p>
        {hasActiveRefinements ? (
          <div>
            <Button variant="secondary" size="sm" onClick={onReset}>
              Limpar refinamentos
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function LibraryPageContent({ username }: LibraryPageContentProps) {
  const [selectedPlatform, setSelectedPlatform] = useState('ALL');
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('most-played');

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfileByUsername(username),
  });

  const allGames = useMemo(() => {
    return profileQuery.data?.gameLibrary ?? [];
  }, [profileQuery.data?.gameLibrary]);

  const platforms = useMemo(() => {
    const counts = allGames.reduce<Record<string, number>>((accumulator, game) => {
      accumulator[game.platform] = (accumulator[game.platform] ?? 0) + 1;

      return accumulator;
    }, {});

    return [
      { value: 'ALL', count: allGames.length },
      ...Object.entries(counts)
        .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
        .map(([value, count]) => ({ value, count })),
    ];
  }, [allGames]);

  const filteredGames = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLocaleLowerCase('pt-BR');

    const visibleGames = allGames.filter((game) => {
      const matchesPlatform =
        selectedPlatform === 'ALL' || game.platform === selectedPlatform;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        game.gameName.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

      return matchesPlatform && matchesSearch;
    });

    return sortLibraryGames(visibleGames, sortBy);
  }, [allGames, searchValue, selectedPlatform, sortBy]);

  const hasActiveRefinements =
    searchValue.trim().length > 0 || selectedPlatform !== 'ALL' || sortBy !== 'most-played';

  const activeRefinements = [
    searchValue.trim().length > 0 ? `Busca: ${searchValue.trim()}` : null,
    selectedPlatform !== 'ALL' ? `Plataforma: ${selectedPlatform}` : null,
    sortBy !== 'most-played'
      ? `Ordenação: ${
          sortBy === 'recent' ? 'Mais recentes' : 'Alfabética'
        }`
      : null,
  ].filter((value): value is string => value !== null);

  const resetRefinements = () => {
    setSearchValue('');
    setSelectedPlatform('ALL');
    setSortBy('most-played');
  };

  if (profileQuery.isPending) {
    return <LibraryLoadingState />;
  }

  if (profileQuery.isError) {
    const message =
      profileQuery.error instanceof ProfileRequestError
        ? profileQuery.error.message
        : 'Tente novamente em alguns instantes.';

    return <LibraryErrorState message={message} />;
  }

  return (
    <div className="space-y-section" data-testid="library-success">
      <SectionHeading
        eyebrow="Biblioteca"
        title={`Biblioteca de @${profileQuery.data.username}`}
        description="Explore a biblioteca carregada pelo profile atual com busca, filtros e ordenação locais, sem alterar os dados importados."
        level="h1"
        actions={
          hasActiveRefinements ? (
            <Button variant="secondary" size="sm" onClick={resetRefinements}>
              Limpar refinamentos
            </Button>
          ) : undefined
        }
      />

      <LibraryStats games={allGames} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <LibrarySearch
            value={searchValue}
            onChange={setSearchValue}
            onClear={() => {
              setSearchValue('');
            }}
          />

          <Card data-testid="library-summary">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                  Visão atual
                </p>
                <p className="font-display text-2xl font-semibold text-primary">
                  Exibindo {filteredGames.length} de {allGames.length} jogos
                </p>
                <p className="text-sm leading-6 text-secondary">
                  {hasActiveRefinements
                    ? 'Os resultados abaixo refletem os refinamentos ativos nesta tela.'
                    : 'A lista abaixo mostra a biblioteca completa disponível no profile atual.'}
                </p>
              </div>
              {activeRefinements.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeRefinements.map((refinement) => (
                    <span
                      key={refinement}
                      className="rounded-pill border border-border bg-background-secondary px-3 py-1 text-xs font-medium text-secondary"
                    >
                      {refinement}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          {filteredGames.length === 0 ? (
            <LibraryEmptyState
              hasGames={allGames.length > 0}
              hasActiveRefinements={hasActiveRefinements}
              onReset={resetRefinements}
            />
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              data-testid="library-grid"
            >
              {filteredGames.map((game) => (
                <GameCard
                  key={`${game.platform}-${game.gameName}-${game.lastPlayedAt ?? 'never'}`}
                  game={game}
                />
              ))}
            </div>
          )}
        </div>

        <LibraryFilters
          platforms={platforms}
          selectedPlatform={selectedPlatform}
          selectedSort={sortBy}
          onPlatformChange={setSelectedPlatform}
          onSortChange={setSortBy}
          onReset={resetRefinements}
          hasActiveRefinements={hasActiveRefinements}
        />
      </div>
    </div>
  );
}
