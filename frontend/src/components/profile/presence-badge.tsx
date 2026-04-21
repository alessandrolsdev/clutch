'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { getPresenceConnectionView } from '@/lib/presence/connection-state';
import { type ProfilePresenceStatus } from '@/schemas/profile';
import { type PresenceConnectionStatus } from '@/store/presence-store';

type PresenceBadgeProps = {
  status: ProfilePresenceStatus;
  currentGame: string | null;
  platform: string | null;
  connectionStatus?: PresenceConnectionStatus;
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
  IN_GAME: 'Jogando',
  AFK: 'Ausente',
  OFFLINE: 'Offline',
};

function resolvePrimaryDetail(
  status: ProfilePresenceStatus,
  currentGame: string | null,
): string {
  if (status === 'IN_GAME' && currentGame) {
    return `Jogando ${currentGame}`;
  }

  if (status === 'IN_GAME') {
    return 'Em partida agora';
  }

  if (status === 'ONLINE') {
    return 'Disponivel para jogar agora';
  }

  if (status === 'AFK') {
    return 'Em pausa no momento';
  }

  return 'Sem sessao publica ativa';
}

function resolveSecondaryDetail(
  status: ProfilePresenceStatus,
  platform: string | null,
): string {
  if (platform && status !== 'OFFLINE') {
    return `Via ${platform}`;
  }

  if (status === 'OFFLINE') {
    return 'Nenhuma plataforma publica ativa';
  }

  return 'Sem plataforma publica informada';
}

export function PresenceBadge({
  status,
  currentGame,
  platform,
  connectionStatus = 'connected',
}: PresenceBadgeProps) {
  const primaryDetail = resolvePrimaryDetail(status, currentGame);
  const secondaryDetail = resolveSecondaryDetail(status, platform);
  const connectionView = getPresenceConnectionView(connectionStatus);

  return (
    <div
      data-testid="presence-badge"
      className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-background-tertiary/70 px-3 py-3"
    >
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
        <Badge
          tone={connectionView.tone}
          data-testid="presence-source-badge"
          title={connectionView.detail}
        >
          {connectionView.badgeLabel}
        </Badge>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-primary">
          {primaryDetail}
        </p>
        <p className="truncate text-xs uppercase tracking-[0.28em] text-secondary">
          {[secondaryDetail, connectionView.sourceLabel].join(' • ')}
        </p>
      </div>
    </div>
  );
}
