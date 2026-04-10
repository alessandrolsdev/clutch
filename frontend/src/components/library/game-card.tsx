import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';

export type LibraryGameRecord = {
  gameName: string;
  coverUrl: string | null;
  platform: string;
  hoursPlayed: number | null;
  lastPlayedAt: string | null;
};

type GameCardProps = {
  game: LibraryGameRecord;
};

function formatHoursPlayed(hoursPlayed: number | null): string {
  if (typeof hoursPlayed !== 'number' || !Number.isFinite(hoursPlayed)) {
    return 'Horas indisponiveis';
  }

  const roundedHours = Math.max(0, Math.round(hoursPlayed));

  return `${roundedHours}h jogadas`;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Card className="overflow-hidden p-0" data-testid="library-game-card">
      <div className="relative h-40 w-full border-b border-border bg-background-tertiary">
        {game.coverUrl ? (
          <Image
            src={game.coverUrl}
            alt={game.gameName}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-background-secondary text-xs uppercase tracking-[0.35em] text-secondary">
            Sem capa
          </div>
        )}
      </div>

      <div className="space-y-3 p-card">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-display text-xl font-semibold text-primary">
              {game.gameName}
            </h3>
            <Badge tone="neutral">{game.platform}</Badge>
          </div>
          <p className="text-sm text-secondary">{formatHoursPlayed(game.hoursPlayed)}</p>
        </div>

        <p className="text-xs uppercase tracking-[0.24em] text-secondary">
          Ultima atividade:{' '}
          {game.lastPlayedAt ? (
            <HydrationSafeTime
              value={game.lastPlayedAt}
              options={{ day: '2-digit', month: '2-digit', year: 'numeric' }}
              fallback="Sem atividade recente"
            />
          ) : (
            'Sem atividade recente'
          )}
        </p>
      </div>
    </Card>
  );
}
