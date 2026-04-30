'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  steamConnectRequestSchema,
  type SteamConnectValues,
} from '@/schemas/integrations';
import {
  connectSteam,
  IntegrationsRequestError,
  syncSteamLibrary,
} from '@/services/integrations';

type SteamIntegrationCardProps = {
  isConnected: boolean;
  importedPreviewCount: number;
  onRefreshStatus: () => Promise<void>;
};

export function SteamIntegrationCard({
  isConnected,
  importedPreviewCount,
  onRefreshStatus,
}: SteamIntegrationCardProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SteamConnectValues>({
    resolver: zodResolver(steamConnectRequestSchema),
    defaultValues: {
      steamId: '',
    },
    mode: 'onChange',
  });

  const connectMutation = useMutation({
    mutationFn: connectSteam,
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
          : 'Nao foi possivel conectar a Steam agora.',
      );
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncSteamLibrary,
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
          : 'Nao foi possivel sincronizar a Steam agora.',
      );
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await connectMutation.mutateAsync(values);
  });
  const statusCopy = isConnected
    ? importedPreviewCount > 0
      ? `A profile API mostra ${importedPreviewCount} jogo(s) recentes dessa integracao.`
      : 'Steam conectada, mas nenhum jogo apareceu na previa. Isso pode indicar biblioteca vazia, biblioteca privada ou sincronizacao ainda sem jogos importados.'
    : 'Ainda nao ha integracao Steam ativa neste perfil.';

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Steam</p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Biblioteca Steam
          </h2>
          <p className="text-sm leading-6 text-secondary">
            Conecta sua conta pela SteamID publica e permite sincronizar a biblioteca real.
          </p>
        </div>
        <Badge tone={isConnected ? 'success' : 'neutral'}>
          {isConnected ? 'Conectada' : 'Nao conectada'}
        </Badge>
      </div>

      <p className="text-sm text-secondary">
        {statusCopy}
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
          <span className="text-sm font-medium text-primary">SteamID</span>
          <input
            type="text"
            className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
            placeholder="76561198000000000"
            aria-invalid={Boolean(errors.steamId)}
            aria-describedby={errors.steamId ? 'steam-id-error' : undefined}
            {...register('steamId')}
          />
          {errors.steamId ? (
            <span id="steam-id-error" className="text-sm text-status-afk">
              {errors.steamId.message}
            </span>
          ) : null}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || connectMutation.isPending}>
            {isSubmitting || connectMutation.isPending ? 'Conectando...' : 'Conectar Steam'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!isConnected || syncMutation.isPending}
            onClick={() => {
              syncMutation.mutate();
            }}
          >
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar biblioteca'}
          </Button>
        </div>
      </form>

      <p className="text-xs leading-5 text-secondary">
        O contrato atual nao expoe progresso assincrono nem endpoint de desconexao.
      </p>
    </Card>
  );
}
