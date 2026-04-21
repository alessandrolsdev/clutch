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

function formatMemberSince(createdAt: string): string {
  const joinedAt = new Date(createdAt);

  if (Number.isNaN(joinedAt.getTime())) {
    return 'Chegou recentemente ao CLUTCH';
  }

  const formattedMonthYear = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(joinedAt);

  return `No CLUTCH desde ${formattedMonthYear}`;
}

export function GamerCard({ profile, actions }: GamerCardProps) {
  const displayName = profile.profile.displayName || profile.username;
  const badgeList = profile.profile.badges.slice(0, 4);
  const initials = profile.username.slice(0, 2).toUpperCase();
  const accentColor = profile.profile.accentColor ?? '#7C3AED';
  const memberSinceLabel = formatMemberSince(profile.createdAt);
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
        style={{
          ...(profile.profile.bannerUrl
            ? {
                backgroundImage: `linear-gradient(135deg, ${accentColor}, rgba(6,182,212,0.28)), url(${profile.profile.bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {
                backgroundImage: `linear-gradient(135deg, ${accentColor}, rgba(6,182,212,0.28), rgba(10,10,15,0.92))`,
              }),
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_32%)]" />
      </div>

      <div className="space-y-5 px-card pb-card">
        <div className="-mt-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-end gap-4">
            <Avatar
              src={profile.profile.avatarUrl}
              alt={profile.username}
              fallback={initials}
              size="lg"
              className="h-20 w-20 shrink-0 border-4 border-background text-xl shadow-[0_18px_40px_rgba(10,10,15,0.34)]"
            />
            <div className="min-w-0 space-y-3 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.35em] text-secondary">
                  Perfil gamer
                </span>
                <span className="text-xs text-secondary">{memberSinceLabel}</span>
              </div>

              <div className="space-y-1">
                <h1 className="truncate font-display text-3xl font-semibold text-primary sm:text-4xl">
                  {displayName}
                </h1>
                <p className="truncate text-sm font-medium text-secondary">
                  @{profile.username}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Nivel {profile.stats.level}</Badge>
                {badgeList.map((badge) => (
                  <Badge key={badge} tone="neutral">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {actions ? (
            <div className="flex flex-col items-stretch gap-3 pt-10 sm:items-end">
              {actions}
            </div>
          ) : null}
        </div>

        <PresenceBadge
          status={effectivePresence.status}
          currentGame={effectivePresence.currentGame}
          platform={effectivePresence.platform}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div className="space-y-2 rounded-control border border-border bg-background-tertiary/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">
              Identidade
            </p>
            <p className="text-sm leading-6 text-secondary">
              {profile.profile.bio || 'Esse jogador ainda nao adicionou uma bio.'}
            </p>
          </div>

          <div className="rounded-control border border-border bg-background-tertiary/40 px-4 py-4">
            <PlatformBadges integrations={profile.platformIntegrations} />
          </div>
        </div>
      </div>
    </Card>
  );
}
