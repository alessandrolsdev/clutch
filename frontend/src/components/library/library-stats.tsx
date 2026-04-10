import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { type LibraryGameRecord } from '@/components/library/game-card';

type LibraryStatsProps = {
  games: LibraryGameRecord[];
};

function formatHours(games: LibraryGameRecord[]): string {
  const totalHours = games.reduce((sum, game) => {
    if (typeof game.hoursPlayed !== 'number' || !Number.isFinite(game.hoursPlayed)) {
      return sum;
    }

    return sum + game.hoursPlayed;
  }, 0);

  return `${Math.round(totalHours)}h`;
}

export function LibraryStats({ games }: LibraryStatsProps) {
  const connectedPlatforms = new Set(games.map((game) => game.platform));

  return (
    <Card>
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Resumo da biblioteca</p>
          <p className="text-sm leading-6 text-secondary">
            Visão rápida dos jogos já carregados no payload atual do perfil.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[8rem] space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">Jogos</p>
            <p className="font-display text-3xl font-semibold text-primary">{games.length}</p>
          </div>

          <div className="min-w-[8rem] space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">Horas</p>
            <p className="font-display text-3xl font-semibold text-primary">{formatHours(games)}</p>
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">Plataformas</p>
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.size > 0 ? (
                Array.from(connectedPlatforms).sort().map((platform) => (
                  <Badge key={platform} tone="neutral">
                    {platform}
                  </Badge>
                ))
              ) : (
                <Badge tone="neutral">Sem plataformas</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
