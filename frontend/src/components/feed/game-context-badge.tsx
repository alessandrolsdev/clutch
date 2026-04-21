import { Badge } from '@/components/ui/badge';
import { type FeedGameContext } from '@/schemas/feed';

type GameContextBadgeProps = {
  gameContext: FeedGameContext;
};

export function GameContextBadge({ gameContext }: GameContextBadgeProps) {
  const gameName = gameContext.gameName?.trim() || null;
  const platform = gameContext.platform?.trim() || null;
  const contextLabel = [gameName, platform].filter(Boolean).join(' • ') || 'Contexto de jogo';

  return (
    <Badge
      tone="accent"
      className="normal-case tracking-[0.02em] text-accent-cyan"
    >
      {contextLabel}
    </Badge>
  );
}
