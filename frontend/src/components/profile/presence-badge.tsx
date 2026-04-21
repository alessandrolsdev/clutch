'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { type ProfilePresenceStatus } from '@/schemas/profile';

type PresenceBadgeProps = {
  status: ProfilePresenceStatus;
  currentGame: string | null;
  platform: string | null;
};

const toneByStatus: Record<
  ProfilePresenceStatus,
  'success' | 'accent' | 'warning' | 'neutral'
> = {
  ONLINE: 'success',
  IN_GAME: 'accent',
  AFK: 'warning',
  OFFLINE: 'neutral',
};

const labelByStatus: Record<ProfilePresenceStatus, string> = {
  ONLINE: 'Online',
  IN_GAME: 'In game',
  AFK: 'AFK',
  OFFLINE: 'Offline',
};

function resolvePrimaryDetail(
  status: ProfilePresenceStatus,
  currentGame: string | null,
): string {
  if (status === 'IN_GAME' && currentGame) {
    return `Jogando ${currentGame}`;
  }

  if (status === 'ONLINE') {
    return 'Disponivel para jogar';
  }

  if (status === 'AFK') {
    return 'Ausente no momento';
  }

  return 'Sem atividade ativa';
}

function resolveSecondaryDetail(
  status: ProfilePresenceStatus,
  platform: string | null,
): string {
  if (platform) {
    return `Plataforma atual: ${platform}`;
  }

  if (status === 'OFFLINE') {
    return 'Nenhuma sessao publica no momento';
  }

  return 'Sem plataforma informada';
}

export function PresenceBadge({
  status,
  currentGame,
  platform,
}: PresenceBadgeProps) {
  const primaryDetail = resolvePrimaryDetail(status, currentGame);
  const secondaryDetail = resolveSecondaryDetail(status, platform);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-background-tertiary/70 px-3 py-3">
      <Badge tone={toneByStatus[status]}>
        <motion.span
          initial={{ opacity: 0.55 }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY }}
          className="mr-1 inline-block h-2 w-2 rounded-full bg-current"
          aria-hidden="true"
        />
        {labelByStatus[status]}
      </Badge>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-primary">
          {primaryDetail}
        </p>
        <p className="truncate text-xs uppercase tracking-[0.28em] text-secondary">
          {secondaryDetail}
        </p>
      </div>
    </div>
  );
}
