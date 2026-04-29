'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  ConnectedAccount,
  ConnectedAccountProviderDefinition,
  ConnectedAccountProvider,
} from '@/schemas/integrations';
import {
  fetchConnectedAccounts,
  IntegrationsRequestError,
  startAccountLink,
  startAccountReauth,
  unlinkConnectedAccount,
} from '@/services/integrations';

type ProviderDefinition = {
  provider: ConnectedAccountProvider;
  name: string;
  description: string;
  connectionTypeLabel: string;
  status: ConnectedAccountProviderDefinition['status'];
  dataSource: ConnectedAccountProviderDefinition['dataSource'];
  capabilities: string[];
};

const PROVIDER_COPY: Partial<Record<ConnectedAccountProvider, {
  description: string;
  connectionTypeLabel: string;
}>> = {
  GOOGLE: {
    description: 'Login social e identidade externa verificada pelo provider.',
    connectionTypeLabel: 'Login social',
  },
  DISCORD: {
    description: 'Login social, conta conectada e ponte de presenca quando disponivel.',
    connectionTypeLabel: 'Login social ou conta conectada',
  },
  STEAM: {
    description: 'Biblioteca de jogos e sincronizacao pela SteamID publica.',
    connectionTypeLabel: 'Conta conectada',
  },
  EPIC: {
    description: 'Biblioteca importada pelo fluxo experimental atual.',
    connectionTypeLabel: 'Conta conectada experimental',
  },
};

function getStatusLabel(account: ConnectedAccount | null): string {
  if (!account) {
    return 'Nao conectada';
  }

  if (account.needsReauth || account.status === 'NEEDS_REAUTH') {
    return 'Precisa reconectar';
  }

  if (account.connected || account.status === 'CONNECTED') {
    return 'Ativa';
  }

  if (account.status === 'DISCONNECTED') {
    return 'Desconectada';
  }

  if (account.experimental || account.status === 'EXPERIMENTAL') {
    return 'Experimental';
  }

  return 'Indisponivel';
}

function getStatusTone(account: ConnectedAccount | null): 'success' | 'warning' | 'neutral' {
  if (!account) {
    return 'neutral';
  }

  if (account.needsReauth || account.status === 'NEEDS_REAUTH') {
    return 'warning';
  }

  if (account.connected || account.status === 'CONNECTED') {
    return 'success';
  }

  return 'neutral';
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Sem registro';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  return error instanceof IntegrationsRequestError ? error.message : fallback;
}

function buildProviderIndex(accounts: ConnectedAccount[]): Map<ConnectedAccountProvider, ConnectedAccount> {
  return new Map(accounts.map((account) => [account.provider, account]));
}

function toProviderDefinitions(input: {
  accounts: ConnectedAccount[];
  providers: ConnectedAccountProviderDefinition[];
}): ProviderDefinition[] {
  const accountProviders = new Map(input.accounts.map((account) => [account.provider, account]));
  const providerDefinitions = new Map(input.providers.map((provider) => [provider.provider, provider]));

  for (const account of input.accounts) {
    if (!providerDefinitions.has(account.provider)) {
      providerDefinitions.set(account.provider, {
        provider: account.provider,
        displayName: account.displayName,
        status: account.status,
        dataSource: account.dataSource,
        capabilities: account.capabilities,
      });
    }
  }

  return Array.from(providerDefinitions.values()).map((provider) => {
    const account = accountProviders.get(provider.provider);
    const copy = PROVIDER_COPY[provider.provider];

    return {
      provider: provider.provider,
      name: provider.displayName,
      description: copy?.description ?? 'Provider registrado para conta conectada.',
      connectionTypeLabel: copy?.connectionTypeLabel ??
        (provider.capabilities.includes('SOCIAL_LOGIN') ? 'Login social' : 'Conta conectada'),
      status: provider.status,
      dataSource: account?.dataSource ?? provider.dataSource,
      capabilities: account?.capabilities ?? provider.capabilities,
    };
  });
}

type ConnectionProviderRowProps = {
  definition: ProviderDefinition;
  account: ConnectedAccount | null;
  busyProvider: ConnectedAccountProvider | null;
  onConnect(provider: ConnectedAccountProvider): void;
  onReauth(provider: ConnectedAccountProvider): void;
  onUnlink(provider: ConnectedAccountProvider): void;
};

function ConnectionProviderRow({
  definition,
  account,
  busyProvider,
  onConnect,
  onReauth,
  onUnlink,
}: ConnectionProviderRowProps) {
  const isBusy = busyProvider === definition.provider;
  const canOAuthConnect = definition.capabilities.includes('OAUTH_CONNECT') && definition.status === 'CONNECTED';
  const canLegacyConnect = definition.capabilities.includes('TOKEN_CONNECT') ||
    (definition.capabilities.includes('LIBRARY_IMPORT') && !definition.capabilities.includes('OAUTH_CONNECT'));
  const canReauth = Boolean(account?.needsReauth) && canOAuthConnect;
  const canUnlink = Boolean(account?.canUnlink);

  return (
    <Card className="space-y-5" data-testid={`connection-provider-${definition.provider.toLowerCase()}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            {definition.name}
          </p>
          <h3 className="font-display text-xl font-semibold text-primary">
            {definition.connectionTypeLabel}
          </h3>
          <p className="max-w-xl text-sm leading-6 text-secondary">
            {definition.description}
          </p>
        </div>
        <Badge tone={getStatusTone(account)}>{getStatusLabel(account)}</Badge>
      </div>

      <dl className="grid gap-3 text-sm text-secondary sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-tertiary">Tipo</dt>
          <dd className="mt-1 text-primary">
            {account?.connectionType === 'SOCIAL_LOGIN'
              ? 'Login social'
              : account?.connectionType === 'CONNECTED_ACCOUNT'
                ? 'Conta conectada'
                : definition.connectionTypeLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-tertiary">Ultima atualizacao</dt>
          <dd className="mt-1 text-primary">{formatDate(account?.lastSyncAt ?? account?.updatedAt ?? null)}</dd>
        </div>
      </dl>

      {account?.needsReauth ? (
        <p className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary">
          Esta conta precisa ser reconectada antes de voltar ao estado ativo.
        </p>
      ) : null}

      {!account && canLegacyConnect ? (
        <p className="text-sm text-secondary">
          Use o formulario especifico desta pagina para conectar este provider.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!account && canOAuthConnect ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => {
              onConnect(definition.provider);
            }}
          >
            {isBusy ? 'Abrindo...' : `Conectar ${definition.name}`}
          </Button>
        ) : null}

        {canReauth ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => {
              onReauth(definition.provider);
            }}
          >
            {isBusy ? 'Abrindo...' : `Reconectar ${definition.name}`}
          </Button>
        ) : null}

        {account ? (
          <Button
            type="button"
            variant="secondary"
            disabled={!canUnlink || isBusy}
            onClick={() => {
              onUnlink(definition.provider);
            }}
          >
            {isBusy ? 'Desconectando...' : `Desconectar ${definition.name}`}
          </Button>
        ) : null}
      </div>

      {!account && !canOAuthConnect && !canLegacyConnect ? (
        <p className="text-sm text-secondary">
          Provider registrado, mas indisponivel para conexao nesta versao.
        </p>
      ) : null}

      {account && !account.canUnlink ? (
        <p className="text-xs leading-5 text-secondary">
          Desconexao bloqueada para preservar pelo menos um metodo de login viavel.
        </p>
      ) : null}
    </Card>
  );
}

type ConnectionCenterProps = {
  onRedirect?: (authorizationUrl: string) => void;
};

export function ConnectionCenter({ onRedirect }: ConnectionCenterProps = {}) {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<ConnectedAccountProvider | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['connected-accounts'],
    queryFn: fetchConnectedAccounts,
  });

  const providerIndex = useMemo(
    () => buildProviderIndex(accountsQuery.data?.accounts ?? []),
    [accountsQuery.data?.accounts],
  );
  const providerDefinitions = useMemo(
    () => toProviderDefinitions({
      accounts: accountsQuery.data?.accounts ?? [],
      providers: accountsQuery.data?.providers ?? [],
    }),
    [accountsQuery.data?.accounts, accountsQuery.data?.providers],
  );

  const connectMutation = useMutation({
    mutationFn: startAccountLink,
    onMutate: (provider) => {
      setBusyProvider(provider);
      setErrorMessage(null);
      setFeedbackMessage(null);
    },
    onSuccess: (response) => {
      if (onRedirect) {
        onRedirect(response.authorizationUrl);
        return;
      }

      window.location.assign(response.authorizationUrl);
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error, 'Nao foi possivel iniciar a conexao agora.'));
    },
    onSettled: () => {
      setBusyProvider(null);
    },
  });

  const reauthMutation = useMutation({
    mutationFn: startAccountReauth,
    onMutate: (provider) => {
      setBusyProvider(provider);
      setErrorMessage(null);
      setFeedbackMessage(null);
    },
    onSuccess: (response) => {
      if (onRedirect) {
        onRedirect(response.authorizationUrl);
        return;
      }

      window.location.assign(response.authorizationUrl);
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error, 'Nao foi possivel iniciar a reconexao agora.'));
    },
    onSettled: () => {
      setBusyProvider(null);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkConnectedAccount,
    onMutate: (provider) => {
      setBusyProvider(provider);
      setErrorMessage(null);
      setFeedbackMessage(null);
    },
    onSuccess: async (response) => {
      setFeedbackMessage(response.message);
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error, 'Nao foi possivel desconectar esta conta agora.'));
    },
    onSettled: () => {
      setBusyProvider(null);
    },
  });

  if (accountsQuery.isPending) {
    return (
      <Card className="space-y-4" data-testid="connection-center-loading">
        <div className="h-7 w-52 animate-pulse rounded-control bg-background-tertiary" />
        <div className="h-20 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    );
  }

  if (accountsQuery.isError) {
    return (
      <Card className="space-y-3" data-testid="connection-center-error">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Contas conectadas</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nao foi possivel carregar suas conexoes
        </h2>
        <p className="text-sm leading-6 text-secondary">
          {resolveErrorMessage(accountsQuery.error, 'Tente novamente em alguns instantes.')}
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-5" data-testid="connection-center">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Contas conectadas</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Central de conexoes
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-secondary">
          Gerencie contas usadas para login social, integracoes e importacao. Tokens e payloads sensiveis ficam no backend.
        </p>
      </div>

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

      {accountsQuery.data.accounts.length === 0 ? (
        <Card className="space-y-2" data-testid="connection-center-empty">
          <h3 className="font-display text-xl font-semibold text-primary">
            Nenhuma conta conectada
          </h3>
          <p className="text-sm leading-6 text-secondary">
            Conecte Google ou Discord por OAuth, ou use os formularios de Steam e Epic nesta pagina.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-section xl:grid-cols-2">
        {providerDefinitions.map((definition) => (
          <ConnectionProviderRow
            key={definition.provider}
            definition={definition}
            account={providerIndex.get(definition.provider) ?? null}
            busyProvider={busyProvider}
            onConnect={(provider) => {
              connectMutation.mutate(provider);
            }}
            onReauth={(provider) => {
              reauthMutation.mutate(provider);
            }}
            onUnlink={(provider) => {
              unlinkMutation.mutate(provider);
            }}
          />
        ))}
      </div>
    </section>
  );
}
