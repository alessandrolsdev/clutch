'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  igdbSearchRequestSchema,
  type IgdbSearchGame,
  type IgdbSearchResponse,
  type IgdbSearchValues,
} from '@/schemas/integrations';
import { IntegrationsRequestError, searchIgdbGame } from '@/services/integrations';

export function IgdbSearchCard() {
  const [result, setResult] = useState<IgdbSearchResponse | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IgdbSearchValues>({
    resolver: zodResolver(igdbSearchRequestSchema),
    defaultValues: {
      q: '',
    },
    mode: 'onChange',
  });

  const searchMutation = useMutation({
    mutationFn: (values: IgdbSearchValues) => searchIgdbGame(values.q),
    onSuccess: (response) => {
      setErrorMessage(null);
      setResult(response);
      setSelectedGameId(response.games.length === 1 ? response.games[0]?.id ?? null : null);
    },
    onError: (error) => {
      setResult(null);
      setSelectedGameId(null);
      setErrorMessage(
        error instanceof IntegrationsRequestError
          ? error.message
          : 'Nao foi possivel buscar no IGDB agora.',
      );
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await searchMutation.mutateAsync(values);
  });

  const games = result?.games ?? [];
  const selectedGame = selectedGameId === null
    ? null
    : games.find((game) => game.id === selectedGameId) ?? null;

  const renderGamePreview = (game: IgdbSearchGame) => (
    <Card className="space-y-4" tone="neutral">
      <div className="flex items-start gap-4">
        <Avatar
          src={game.coverUrl}
          alt={game.name}
          fallback={game.name.slice(0, 2).toUpperCase()}
          size="lg"
          className="rounded-control"
        />
        <div className="space-y-2">
          <h3 className="font-display text-xl font-semibold text-primary">
            {game.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            {game.platforms.map((platform) => (
              <Badge key={platform} tone="neutral">
                {platform}
              </Badge>
            ))}
            {game.platforms.length === 0 ? (
              <Badge tone="neutral">Plataforma indisponivel</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-sm leading-6 text-secondary">
        {game.summary || 'O backend nao retornou resumo para este candidato.'}
      </p>
    </Card>
  );

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">IGDB</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Busca de jogos
        </h2>
        <p className="text-sm leading-6 text-secondary">
          Quando a consulta for ambigua, o contrato atual devolve uma lista curta de candidatos para selecao.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <label className="space-y-2">
          <span className="text-sm font-medium text-primary">Nome do jogo</span>
          <input
            type="search"
            className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
            placeholder="Ex.: Counter-Strike 2"
            aria-invalid={Boolean(errors.q)}
            aria-describedby={errors.q ? 'igdb-search-error' : undefined}
            {...register('q')}
          />
          {errors.q ? (
            <span id="igdb-search-error" className="text-sm text-status-afk">
              {errors.q.message}
            </span>
          ) : null}
        </label>

        <Button type="submit" disabled={isSubmitting || searchMutation.isPending}>
          {isSubmitting || searchMutation.isPending ? 'Buscando...' : 'Buscar no IGDB'}
        </Button>
      </form>

      {errorMessage ? (
        <div className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
          {errorMessage}
        </div>
      ) : null}

      {result && games.length === 0 ? (
        <Card tone="neutral" data-testid="igdb-search-empty">
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">Nenhum candidato encontrado</p>
            <p className="text-sm leading-6 text-secondary">
              Tente refinar o nome do jogo para encontrar um resultado mais preciso.
            </p>
          </div>
        </Card>
      ) : null}

      {result && games.length > 1 ? (
        <Card tone="neutral" data-testid="igdb-search-results">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">Possiveis resultados</p>
              <p className="text-sm leading-6 text-secondary">
                Escolha o candidato que melhor corresponde ao jogo que voce procura.
              </p>
            </div>

            <div className="space-y-3">
              {games.map((game) => {
                const isSelected = selectedGameId === game.id;

                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`w-full rounded-control border px-control-x py-control-y text-left transition ${
                      isSelected
                        ? 'border-accent-cyan bg-accent-cyan/10'
                        : 'border-border bg-background-secondary hover:border-accent-cyan/60'
                    }`}
                    onClick={() => {
                      setSelectedGameId(game.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-primary">{game.name}</p>
                        <p className="text-xs text-secondary">
                          {game.platforms.length > 0
                            ? game.platforms.join(' • ')
                            : 'Plataforma indisponivel'}
                        </p>
                      </div>
                      <Badge tone={isSelected ? 'accent' : 'neutral'}>
                        {isSelected ? 'Selecionado' : 'Selecionar'}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      {selectedGame ? (
        <div data-testid="igdb-search-selected">
          <p className="mb-3 text-sm font-medium text-primary">
            Resultado selecionado
          </p>
          {renderGamePreview(selectedGame)}
        </div>
      ) : null}

      {result && games.length === 1 && selectedGame ? (
        <div className="rounded-control border border-status-online/25 bg-[rgba(16,185,129,0.08)] px-control-x py-control-y text-sm text-primary">
          Busca direta concluida com um candidato unico.
        </div>
      ) : null}
    </Card>
  );
}
