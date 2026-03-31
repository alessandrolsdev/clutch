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
  type IgdbSearchResponse,
  type IgdbSearchValues,
} from '@/schemas/integrations';
import { IntegrationsRequestError, searchIgdbGame } from '@/services/integrations';

export function IgdbSearchCard() {
  const [result, setResult] = useState<IgdbSearchResponse | null>(null);
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
    },
    onError: (error) => {
      setResult(null);
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

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">IGDB</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Busca de jogos
        </h2>
        <p className="text-sm leading-6 text-secondary">
          O contrato atual retorna um jogo por consulta, com capa e plataformas quando disponiveis.
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

      {result ? (
        <Card className="space-y-4" tone="neutral">
          <div className="flex items-start gap-4">
            <Avatar
              src={result.coverUrl}
              alt={result.name}
              fallback={result.name.slice(0, 2).toUpperCase()}
              size="lg"
              className="rounded-control"
            />
            <div className="space-y-2">
              <h3 className="font-display text-xl font-semibold text-primary">
                {result.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.platforms.map((platform) => (
                  <Badge key={platform} tone="neutral">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 text-secondary">
            {result.summary || 'O backend nao retornou resumo para esta busca.'}
          </p>
        </Card>
      ) : null}
    </Card>
  );
}
