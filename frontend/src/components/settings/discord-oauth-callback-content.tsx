'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import {
  completeDiscordOAuth,
  IntegrationsRequestError,
} from '@/services/integrations';

type DiscordOAuthCallbackSearchParams = {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

type CallbackState =
  | { status: 'loading' }
  | { status: 'success'; message: string; username: string; globalName: string | null }
  | { status: 'error'; message: string };

type DiscordOAuthCallbackContentProps = {
  searchParams: DiscordOAuthCallbackSearchParams;
};

function hasValidCallbackParams(searchParams: DiscordOAuthCallbackSearchParams): boolean {
  return Boolean(searchParams.error) || (Boolean(searchParams.code) && Boolean(searchParams.state));
}

export function DiscordOAuthCallbackContent({
  searchParams,
}: DiscordOAuthCallbackContentProps) {
  const queryClient = useQueryClient();
  const [callbackState, setCallbackState] = useState<CallbackState>({ status: 'loading' });
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    if (!hasValidCallbackParams(searchParams)) {
      setCallbackState({
        status: 'error',
        message: 'Callback Discord inválido.',
      });
      return;
    }

    void completeDiscordOAuth(searchParams)
      .then((response) => {
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
        setCallbackState({
          status: 'success',
          message: response.message,
          username: response.username,
          globalName: response.globalName,
        });
      })
      .catch((error) => {
        setCallbackState({
          status: 'error',
          message:
            error instanceof IntegrationsRequestError
              ? error.message
              : 'Nao foi possivel concluir a conexao com o Discord agora.',
        });
      });
  }, [queryClient, searchParams]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">Discord</p>
            <h1 className="font-display text-3xl font-semibold text-primary">
              Callback de vinculacao
            </h1>
            <p className="text-sm leading-6 text-secondary">
              Esta tela conclui o fluxo OAuth do Discord usando apenas as rotas reais expostas pelo backend.
            </p>
          </div>
          <Badge
            tone={
              callbackState.status === 'success'
                ? 'success'
                : callbackState.status === 'error'
                  ? 'warning'
                  : 'accent'
            }
          >
            {callbackState.status === 'success'
              ? 'Concluido'
              : callbackState.status === 'error'
                ? 'Falhou'
                : 'Processando'}
          </Badge>
        </div>

        {callbackState.status === 'loading' ? (
          <div className="space-y-3" data-testid="discord-callback-loading">
            <div className="h-4 w-48 animate-pulse rounded-control bg-background-tertiary" />
            <div className="h-12 animate-pulse rounded-control bg-background-tertiary" />
          </div>
        ) : null}

        {callbackState.status === 'success' ? (
          <div className="space-y-4" data-testid="discord-callback-success">
            <div className="rounded-control border border-status-online/40 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm text-primary">
              {callbackState.message}
            </div>
            <p className="text-sm text-secondary">
              Conta vinculada: {callbackState.globalName ?? callbackState.username}
            </p>
          </div>
        ) : null}

        {callbackState.status === 'error' ? (
          <div className="space-y-4" data-testid="discord-callback-error">
            <div className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
              {callbackState.message}
            </div>
            <p className="text-sm text-secondary">
              Revise a configuracao do Discord ou tente iniciar a vinculacao novamente em Integracoes.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/settings/integrations"
            className={cn(
              'inline-flex h-11 items-center justify-center gap-2 rounded-control border border-transparent bg-accent-purple px-control-x text-sm font-medium text-white transition hover:brightness-110',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary',
            )}
          >
            Voltar para integracoes
          </Link>
        </div>
      </Card>
    </div>
  );
}
