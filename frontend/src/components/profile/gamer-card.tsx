'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PresenceBadge } from '@/components/profile/presence-badge';
import { PlatformBadges } from '@/components/profile/platform-badges';
import { type ProfileResponse } from '@/schemas/profile';
import { usePresenceStore } from '@/store/presence-store';

type GamerCardProps = {
  profile: ProfileResponse;
  actions?: ReactNode;
};

export function GamerCard({ profile, actions }: GamerCardProps) {
  const displayName = profile.profile.displayName || profile.username;
  const badgeList = profile.profile.badges.slice(0, 4);
  const initials = profile.username.slice(0, 2).toUpperCase();
  const realtimePresence = usePresenceStore((state) =>
    state.connectionStatus === 'connected' ? state.entries[profile.id] : undefined,
  );
  const effectivePresence = {
    status: realtimePresence?.status ?? profile.presence.status,
    currentGame: realtimePresence?.currentGame ?? profile.presence.currentGame,
    platform: realtimePresence?.platform ?? profile.presence.platform,
  };

  return (
    <Card className="overflow-hidden p-0">
      <div
        className="relative h-40 w-full border-b border-border bg-gradient-to-r from-[rgba(124,58,237,0.34)] via-[rgba(6,182,212,0.22)] to-[rgba(10,10,15,0.92)]"
        style={
          profile.profile.bannerUrl
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(124,58,237,0.42), rgba(6,182,212,0.28)), url(${profile.profile.bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />

      <div className="space-y-5 p-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar
              src={profile.profile.avatarUrl}
              alt={profile.username}
              fallback={initials}
              size="lg"
              className="h-16 w-16 text-lg"
            />
            <div className="min-w-0 space-y-1">
              <h1 className="truncate font-display text-3xl font-semibold text-primary">
                {displayName}
              </h1>
              <p className="truncate text-sm text-secondary">@{profile.username}</p>
              <PresenceBadge
                status={effectivePresence.status}
                currentGame={effectivePresence.currentGame}
                platform={effectivePresence.platform}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <Badge tone="accent">Nv. {profile.stats.level}</Badge>
            {actions}
          </div>
        </div>

        <p className="text-sm leading-6 text-secondary">
          {profile.profile.bio || 'Sem bio configurada por enquanto.'}
        </p>

        <PlatformBadges integrations={profile.platformIntegrations} />

        {badgeList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {badgeList.map((badge) => (
              <Badge key={badge} tone="neutral">
                {badge}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
