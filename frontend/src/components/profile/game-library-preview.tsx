import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { type ProfileResponse } from '@/schemas/profile';

type GameLibraryPreviewProps = {
  username: string;
  games: ProfileResponse['gameLibrary'];
};

function resolveTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsedValue = new Date(value).getTime();

  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function sortRecentGames(games: ProfileResponse['gameLibrary']): ProfileResponse['gameLibrary'] {
  return [...games].sort((left, right) => {
    const recentDifference = resolveTimestamp(right.lastPlayedAt) - resolveTimestamp(left.lastPlayedAt);

    if (recentDifference !== 0) {
      return recentDifference;
    }

    const hoursDifference = (right.hoursPlayed ?? -1) - (left.hoursPlayed ?? -1);

    if (hoursDifference !== 0) {
      return hoursDifference;
    }

    return left.gameName.localeCompare(right.gameName, 'pt-BR');
  });
}

function formatHoursPlayed(hoursPlayed: number | null): string {
  if (typeof hoursPlayed !== 'number' || !Number.isFinite(hoursPlayed)) {
    return 'Horas indisponiveis';
  }

  return `${Math.round(hoursPlayed).toLocaleString('pt-BR')}h jogadas`;
}

function formatLastPlayedAt(lastPlayedAt: string | null): string {
  const timestamp = resolveTimestamp(lastPlayedAt);

  if (timestamp === 0) {
    return 'Sem atividade recente';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function GameLibraryPreview({ games, username }: GameLibraryPreviewProps) {
  const visibleGames = sortRecentGames(games).slice(0, 4);
  const platformCount = new Set(games.map((game) => game.platform)).size;
  const trackedHours = games.reduce((sum, game) => {
    if (typeof game.hoursPlayed !== 'number' || !Number.isFinite(game.hoursPlayed)) {
      return sum;
    }

    return sum + game.hoursPlayed;
  }, 0);
  const hasTrackedHours = games.some((game) => {
    return typeof game.hoursPlayed === 'number' && Number.isFinite(game.hoursPlayed);
  });

  return (
    <Card data-testid="game-library-preview">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Biblioteca
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-primary">
              Biblioteca recente
            </h3>
            <p className="text-sm leading-6 text-secondary">
              Recorte rapido da biblioteca publicada neste perfil com os dados ja presentes no
              payload atual.
            </p>
          </div>
          <Link
            href={`/${username}/library`}
            className="text-sm font-medium text-accent-cyan transition hover:text-primary"
          >
            Ver biblioteca completa
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">
            {`${games.length.toLocaleString('pt-BR')} ${games.length === 1 ? 'jogo' : 'jogos'} no payload atual`}
          </Badge>
          <Badge tone="neutral">
            {`${platformCount.toLocaleString('pt-BR')} ${platformCount === 1 ? 'plataforma' : 'plataformas'}`}
          </Badge>
          <Badge tone="neutral">
            {hasTrackedHours
              ? `${Math.round(trackedHours).toLocaleString('pt-BR')}h registradas`
              : 'Horas ainda indisponiveis'}
          </Badge>
        </div>

        {visibleGames.length === 0 ? (
          <div className="rounded-control border border-border bg-background-tertiary/65 px-4 py-4 text-sm text-secondary">
            <p className="font-medium text-primary">Ainda nao ha jogos visiveis nesta biblioteca.</p>
            <p className="mt-2 leading-6">
              Quando as integracoes atuais enviarem jogos para o profile, o resumo recente aparece
              aqui sem exigir contrato adicional.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visibleGames.map((game, index) => (
              <li
                key={`${game.platform}-${game.gameName}`}
                data-testid="profile-library-game"
                className="overflow-hidden rounded-control border border-border bg-background-tertiary/70"
              >
                <div className="relative h-32 w-full">
                  {game.coverUrl ? (
                    <Image
                      src={game.coverUrl}
                      alt={game.gameName}
                      fill
                      sizes="(min-width: 1280px) 27vw, (min-width: 640px) 50vw, 100vw"
                      priority={index === 0}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-background-primary text-xs uppercase tracking-[0.25em] text-secondary">
                      Sem capa
                    </div>
                  )}
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-6 text-primary">
                      {game.gameName}
                    </p>
                    <Badge tone="neutral" className="shrink-0">
                      {game.platform}
                    </Badge>
                  </div>

                  <div className="grid gap-3 text-sm text-secondary sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-secondary">
                        Horas
                      </p>
                      <p className="font-medium text-primary">
                        {formatHoursPlayed(game.hoursPlayed)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-secondary">
                        Ultima atividade
                      </p>
                      <p className="font-medium text-primary">
                        {formatLastPlayedAt(game.lastPlayedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
