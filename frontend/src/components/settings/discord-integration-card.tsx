'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  IntegrationsRequestError,
  startDiscordOAuth,
} from '@/services/integrations';

type DiscordIntegrationCardProps = {
  isConnected: boolean;
  linkedAccountLabel: string | null;
  onRedirect?: (authorizationUrl: string) => void;
};

export function DiscordIntegrationCard({
  isConnected,
  linkedAccountLabel,
  onRedirect,
}: DiscordIntegrationCardProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const discordMutation = useMutation({
    mutationFn: startDiscordOAuth,
    onSuccess: (response) => {
      setErrorMessage(null);
      if (onRedirect) {
        onRedirect(response.authorizationUrl);
        return;
      }

      window.location.assign(response.authorizationUrl);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof IntegrationsRequestError
          ? error.message
          : 'Nao foi possivel iniciar a conexao com o Discord agora.',
      );
    },
  });

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Discord</p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Vinculo Discord e presence bridge
          </h2>
          <p className="text-sm leading-6 text-secondary">
            Vincula a conta Discord pelo backend e habilita a ingestao de presenca normalizada quando o bridge estiver ativo.
          </p>
        </div>
        <Badge tone={isConnected ? 'success' : 'neutral'}>
          {isConnected ? 'Conectado' : 'Nao conectado'}
        </Badge>
      </div>

      <p className="text-sm text-secondary">
        {isConnected
          ? `Conta vinculada: ${linkedAccountLabel ?? 'Discord conectado.'} O estado de presenca passa a poder ser refletido no CLUTCH sem acoplamento direto no frontend.`
          : 'Ainda nao ha integracao Discord ativa neste perfil.'}
      </p>

      {errorMessage ? (
        <div className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={discordMutation.isPending}
          onClick={() => {
            discordMutation.mutate();
          }}
        >
          {discordMutation.isPending
            ? 'Abrindo Discord...'
            : isConnected
              ? 'Reconectar Discord'
              : 'Conectar Discord'}
        </Button>
      </div>

      <p className="text-xs leading-5 text-secondary">
        O frontend conclui o callback em rota dedicada do App Router. A presenca continua chegando pela API do CLUTCH; o browser nao fala diretamente com o Discord.
      </p>
    </Card>
  );
}
