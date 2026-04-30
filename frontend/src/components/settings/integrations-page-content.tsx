'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ConnectionCenter } from '@/components/settings/connection-center';
import { DiscordIntegrationCard } from '@/components/settings/discord-integration-card';
import { EpicIntegrationCard } from '@/components/settings/epic-integration-card';
import { IgdbSearchCard } from '@/components/settings/igdb-search-card';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SteamIntegrationCard } from '@/components/settings/steam-integration-card';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import { fetchConnectedAccounts } from '@/services/integrations';
import { fetchProfileByUsername, ProfileRequestError } from '@/services/profile';

function IntegrationsLoadingState() {
  return (
    <div className="space-y-4" data-testid="settings-integrations-loading">
      <Card>
        <div className="h-8 w-56 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-20 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
      <Card>
        <div className="h-32 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    </div>
  );
}

function IntegrationsErrorState({ message }: { message: string }) {
  return (
    <Card data-testid="settings-integrations-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Integrations</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nao foi possivel carregar as integracoes
        </h2>
        <p className="text-sm leading-6 text-secondary">{message}</p>
      </div>
    </Card>
  );
}

export function IntegrationsPageContent() {
  const { user, status } = useAuth();
  const searchParams = useSearchParams();
  const username = user?.username ?? null;
  const connectionStatus = searchParams.get('connectionStatus');
  const connectionMessage = searchParams.get('connectionMessage');

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfileByUsername(username as string),
    enabled: status === 'authenticated' && typeof username === 'string',
  });
  const connectedAccountsQuery = useQuery({
    queryKey: ['connected-accounts'],
    queryFn: fetchConnectedAccounts,
    enabled: status === 'authenticated',
  });

  if (
    status === 'loading' ||
    profileQuery.isPending ||
    (status === 'authenticated' && connectedAccountsQuery.isPending)
  ) {
    return <IntegrationsLoadingState />;
  }

  if (
    status !== 'authenticated' ||
    !username ||
    profileQuery.isError ||
    connectedAccountsQuery.isError ||
    !profileQuery.data ||
    !connectedAccountsQuery.data
  ) {
    const errorMessage =
      profileQuery.error instanceof ProfileRequestError
        ? profileQuery.error.message
        : 'Tente novamente em alguns instantes.';

    return <IntegrationsErrorState message={errorMessage} />;
  }

  const steamGames = profileQuery.data.gameLibrary.filter((game) => game.platform === 'STEAM');
  const epicGames = profileQuery.data.gameLibrary.filter((game) => game.platform === 'EPIC');
  const connectedPlatforms = new Set(
    connectedAccountsQuery.data.accounts
      .filter((account) => account.connected)
      .map((account) => account.provider),
  );

  return (
    <div className="space-y-section" data-testid="settings-integrations-success">
      <SectionHeading
        eyebrow="Settings"
        title="Integracoes de plataformas"
        description="Cards conectados apenas aos contratos reais de Steam, Epic, Discord e busca IGDB."
        level="h1"
      />

      <SettingsNav />

      {connectionMessage ? (
        <div
          className={
            connectionStatus === 'success'
              ? 'rounded-control border border-status-online/40 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm text-primary'
              : 'rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary'
          }
        >
          {connectionMessage}
        </div>
      ) : null}

      <ConnectionCenter />

      <div className="grid gap-section xl:grid-cols-2">
        <SteamIntegrationCard
          isConnected={connectedPlatforms.has('STEAM')}
          importedPreviewCount={steamGames.length}
          onRefreshStatus={async () => {
            await Promise.all([
              profileQuery.refetch(),
              connectedAccountsQuery.refetch(),
            ]);
          }}
        />

        <EpicIntegrationCard
          isConnected={connectedPlatforms.has('EPIC')}
          importedPreviewCount={epicGames.length}
          onRefreshStatus={async () => {
            await Promise.all([
              profileQuery.refetch(),
              connectedAccountsQuery.refetch(),
            ]);
          }}
        />

        <DiscordIntegrationCard
          isConnected={connectedPlatforms.has('DISCORD')}
          linkedAccountLabel={null}
        />
      </div>

      <IgdbSearchCard />
    </div>
  );
}
