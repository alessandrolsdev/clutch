import { Badge } from '@/components/ui/badge';
import { type FeedGameContext } from '@/schemas/feed';

type GameContextBadgeProps = {
  gameContext: FeedGameContext;
};

export function GameContextBadge({ gameContext }: GameContextBadgeProps) {
  const gameName = gameContext.gameName ?? 'jogo nao identificado';
  const platformLabel = gameContext.platform
    ? ` • ${gameContext.platform}`
    : '';

  return (
    <Badge
      tone="accent"
      className="normal-case tracking-[0.02em] text-accent-cyan"
    >
      Jogando {gameName}
      {platformLabel}
    </Badge>
  );
}
