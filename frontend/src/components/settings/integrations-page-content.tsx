'use client';

import { useQuery } from '@tanstack/react-query';
import { DiscordIntegrationCard } from '@/components/settings/discord-integration-card';
import { EpicIntegrationCard } from '@/components/settings/epic-integration-card';
import { IgdbSearchCard } from '@/components/settings/igdb-search-card';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SteamIntegrationCard } from '@/components/settings/steam-integration-card';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import { fetchProfileByUsername, ProfileRequestError } from '@/services/profile';

function resolveDiscordLinkedAccountLabel(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) {
    return null;
  }

  const globalName =
    typeof metadata.globalName === 'string' && metadata.globalName.length > 0
      ? metadata.globalName
      : null;
  const username =
    typeof metadata.username === 'string' && metadata.username.length > 0
      ? metadata.username
      : null;

  return globalName ?? username;
}

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
  const username = user?.username ?? null;

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfileByUsername(username as string),
    enabled: status === 'authenticated' && typeof username === 'string',
  });

  if (status === 'loading' || profileQuery.isPending) {
    return <IntegrationsLoadingState />;
  }

  if (status !== 'authenticated' || !username || profileQuery.isError || !profileQuery.data) {
    const errorMessage =
      profileQuery.error instanceof ProfileRequestError
        ? profileQuery.error.message
        : 'Tente novamente em alguns instantes.';

    return <IntegrationsErrorState message={errorMessage} />;
  }

  const steamGames = profileQuery.data.gameLibrary.filter((game) => game.platform === 'STEAM');
  const epicGames = profileQuery.data.gameLibrary.filter((game) => game.platform === 'EPIC');
  const connectedPlatforms = new Set(
    profileQuery.data.platformIntegrations.map((integration) => integration.platform),
  );
  const discordIntegration =
    profileQuery.data.platformIntegrations.find((integration) => integration.platform === 'DISCORD') ??
    null;
  const discordLinkedAccountLabel = resolveDiscordLinkedAccountLabel(
    discordIntegration?.metadata ?? null,
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

      <div className="grid gap-section xl:grid-cols-2">
        <SteamIntegrationCard
          isConnected={connectedPlatforms.has('STEAM')}
          importedPreviewCount={steamGames.length}
          onRefreshStatus={async () => {
            await profileQuery.refetch();
          }}
        />

        <EpicIntegrationCard
          isConnected={connectedPlatforms.has('EPIC')}
          importedPreviewCount={epicGames.length}
          onRefreshStatus={async () => {
            await profileQuery.refetch();
          }}
        />

        <DiscordIntegrationCard
          isConnected={connectedPlatforms.has('DISCORD')}
          linkedAccountLabel={discordLinkedAccountLabel}
        />
      </div>

      <IgdbSearchCard />
    </div>
  );
}
