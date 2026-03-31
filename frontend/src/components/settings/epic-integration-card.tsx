'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  epicConnectRequestSchema,
  type EpicConnectValues,
} from '@/schemas/integrations';
import { connectEpic, IntegrationsRequestError } from '@/services/integrations';

type EpicIntegrationCardProps = {
  isConnected: boolean;
  importedPreviewCount: number;
  onRefreshStatus: () => Promise<void>;
};

export function EpicIntegrationCard({
  isConnected,
  importedPreviewCount,
  onRefreshStatus,
}: EpicIntegrationCardProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EpicConnectValues>({
    resolver: zodResolver(epicConnectRequestSchema),
    defaultValues: {
      authToken: '',
    },
    mode: 'onChange',
  });

  const epicMutation = useMutation({
    mutationFn: connectEpic,
    onSuccess: async (response) => {
      setErrorMessage(null);
      setFeedback(response.message);
      await onRefreshStatus();
    },
    onError: (error) => {
      setFeedback(null);
      setErrorMessage(
        error instanceof IntegrationsRequestError
          ? error.message
          : 'Nao foi possivel conectar a Epic agora.',
      );
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await epicMutation.mutateAsync(values);
  });

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Epic</p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Biblioteca Epic Games
          </h2>
          <p className="text-sm leading-6 text-secondary">
            Conecta pelo token de autenticacao real e importa a biblioteca disponivel.
          </p>
        </div>
        <Badge tone={isConnected ? 'success' : 'neutral'}>
          {isConnected ? 'Conectada' : 'Nao conectada'}
        </Badge>
      </div>

      <p className="text-sm text-secondary">
        {isConnected
          ? `A profile API mostra ${importedPreviewCount} jogo(s) recentes dessa integracao.`
          : 'Ainda nao ha integracao Epic ativa neste perfil.'}
      </p>

      {feedback ? (
        <div className="rounded-control border border-status-online/40 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm text-primary">
          {feedback}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <label className="space-y-2">
          <span className="text-sm font-medium text-primary">Token Epic</span>
          <input
            type="password"
            className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
            placeholder="Cole o token de autenticacao"
            aria-invalid={Boolean(errors.authToken)}
            aria-describedby={errors.authToken ? 'epic-token-error' : undefined}
            {...register('authToken')}
          />
          {errors.authToken ? (
            <span id="epic-token-error" className="text-sm text-status-afk">
              {errors.authToken.message}
            </span>
          ) : null}
        </label>

        <Button type="submit" disabled={isSubmitting || epicMutation.isPending}>
          {isSubmitting || epicMutation.isPending ? 'Conectando...' : 'Conectar Epic'}
        </Button>
      </form>

      <p className="text-xs leading-5 text-secondary">
        O contrato atual nao expoe sync dedicado nem endpoint de desconexao para a Epic.
      </p>
    </Card>
  );
}
