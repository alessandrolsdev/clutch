import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { type ProfileResponse } from '@/schemas/profile';

type GameLibraryPreviewProps = {
  username: string;
  games: ProfileResponse['gameLibrary'];
};

export function GameLibraryPreview({ games, username }: GameLibraryPreviewProps) {
  const visibleGames = games.slice(0, 6);

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-secondary">
              Biblioteca
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-primary">
              Jogos recentes
            </h3>
          </div>
          <Link
            href={`/${username}/library`}
            className="text-sm font-medium text-accent-cyan transition hover:text-primary"
          >
            Ver biblioteca completa
          </Link>
        </div>

        {visibleGames.length === 0 ? (
          <p className="rounded-control border border-border bg-background-tertiary/65 px-4 py-3 text-sm text-secondary">
            Este perfil ainda nao possui jogos cadastrados na biblioteca.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGames.map((game, index) => (
              <li
                key={`${game.platform}-${game.gameName}`}
                className="overflow-hidden rounded-control border border-border bg-background-tertiary/70"
              >
                <div className="relative h-28 w-full">
                  {game.coverUrl ? (
                    <Image
                      src={game.coverUrl}
                      alt={game.gameName}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      priority={index === 0}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-background-primary text-xs uppercase tracking-[0.25em] text-secondary">
                      Sem capa
                    </div>
                  )}
                </div>
                <div className="space-y-1 px-3 py-3">
                  <p className="truncate text-sm font-semibold text-primary">
                    {game.gameName}
                  </p>
                  <p className="text-xs uppercase tracking-[0.24em] text-secondary">
                    {game.platform}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
