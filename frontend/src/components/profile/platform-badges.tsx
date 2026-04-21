import { Badge } from '@/components/ui/badge';
import { type ProfileResponse } from '@/schemas/profile';

type PlatformBadgesProps = {
  integrations: ProfileResponse['platformIntegrations'];
};

const platformLabelByCode: Record<
  ProfileResponse['platformIntegrations'][number]['platform'],
  string
> = {
  STEAM: 'Steam',
  EPIC: 'Epic Games',
  DISCORD: 'Discord',
  XBOX: 'Xbox',
  PSN: 'PlayStation Network',
  RIOT: 'Riot',
  ANILIST: 'AniList',
  MYANIMELIST: 'MyAnimeList',
};

export function PlatformBadges({ integrations }: PlatformBadgesProps) {
  const platformCodes = Array.from(
    new Set(integrations.map((integration) => integration.platform)),
  );
  const platformCountLabel =
    platformCodes.length === 1
      ? '1 plataforma conectada'
      : `${platformCodes.length} plataformas conectadas`;

  return (
    <div className="space-y-3" data-testid="profile-platform-badges">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary">
          Plataformas conectadas
        </p>
        <span className="text-xs text-secondary">{platformCountLabel}</span>
      </div>

      {platformCodes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {platformCodes.map((platformCode) => (
            <Badge key={platformCode} tone="accent">
              {platformLabelByCode[platformCode]}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-secondary">
          Sem plataformas conectadas visiveis neste perfil.
        </p>
      )}
    </div>
  );
}
