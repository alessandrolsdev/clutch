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

export function PresenceBadge({
  status,
  currentGame,
  platform,
}: PresenceBadgeProps) {
  const detail =
    status === 'IN_GAME' && currentGame
      ? `Jogando ${currentGame}`
      : platform
        ? `Disponivel em ${platform}`
        : 'Sem atividade ativa';

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <span className="text-sm text-secondary">{detail}</span>
    </div>
  );
}
