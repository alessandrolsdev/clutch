'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PresenceBadge } from '@/components/profile/presence-badge';
import { PlatformBadges } from '@/components/profile/platform-badges';
import { isPresenceRealtimeActive } from '@/lib/presence/connection-state';
import { type ProfileResponse } from '@/schemas/profile';
import { usePresenceStore } from '@/store/presence-store';

type GamerCardProps = {
  profile: ProfileResponse;
  actions?: ReactNode;
};

function normalizeBadges(badges: string[]): string[] {
  return badges
    .map((badge) => badge.trim())
    .filter((badge, index, list) => badge.length > 0 && list.indexOf(badge) === index);
}

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
  const badgeList = normalizeBadges(profile.profile.badges);
  const featuredTitle = badgeList[0] ?? null;
  const specialBadges = badgeList.slice(1, 4);
  const initials = profile.username.slice(0, 2).toUpperCase();
  const accentColor = profile.profile.accentColor ?? '#7C3AED';
  const memberSinceLabel = formatMemberSince(profile.createdAt);
  const connectionStatus = usePresenceStore((state) => state.connectionStatus);
  const realtimePresence = usePresenceStore((state) =>
    isPresenceRealtimeActive(state.connectionStatus) ? state.entries[profile.id] : undefined,
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
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-3xl font-semibold text-primary sm:text-4xl">
                    {displayName}
                  </h1>
                  {featuredTitle ? (
                    <span
                      data-testid="profile-featured-title"
                      className="inline-flex items-center rounded-pill border border-[rgba(124,58,237,0.24)] bg-[rgba(124,58,237,0.14)] px-3 py-1 text-xs font-semibold text-accent-purple"
                    >
                      {featuredTitle}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium text-secondary">
                  @{profile.username}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Nivel {profile.stats.level}</Badge>
                <Badge tone="success">
                  Reputacao {profile.stats.reputation.toLocaleString('pt-BR')}
                </Badge>
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
          connectionStatus={connectionStatus}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.65fr)_minmax(260px,0.8fr)]">
          <div className="space-y-4 rounded-control border border-border bg-background-tertiary/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">
              Identidade
            </p>
            <p className="text-sm leading-6 text-secondary">
              {profile.profile.bio || 'Esse jogador ainda nao adicionou uma bio.'}
            </p>

            {specialBadges.length > 0 ? (
              <div className="space-y-2" data-testid="profile-special-badges">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                  Badges especiais
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {specialBadges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center rounded-pill border border-border bg-background-secondary/70 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-control border border-border bg-background-tertiary/40 px-4 py-4">
            <PlatformBadges integrations={profile.platformIntegrations} />
          </div>

          <div
            data-testid="profile-social-progress"
            className="space-y-4 rounded-control border border-border bg-background-tertiary/40 px-4 py-4"
          >
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                Progresso social visivel
              </p>
              <p className="text-sm leading-6 text-secondary">
                Este primeiro slice usa apenas stats reais do perfil. Continuidade
                com amigos, streaks e ofensivas ficam para a etapa funcional posterior.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-control border border-border bg-background-secondary/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                  Reputacao
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-primary">
                  {profile.stats.reputation.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="rounded-control border border-border bg-background-secondary/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                  Amigos
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-primary">
                  {profile.stats.friendCount.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="rounded-control border border-border bg-background-secondary/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                  Posts
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-primary">
                  {profile.stats.postCount.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
