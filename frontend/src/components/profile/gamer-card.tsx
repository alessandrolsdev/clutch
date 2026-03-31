import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PresenceBadge } from '@/components/profile/presence-badge';
import { PlatformBadges } from '@/components/profile/platform-badges';
import { type ProfileResponse } from '@/schemas/profile';

type GamerCardProps = {
  profile: ProfileResponse;
};

export function GamerCard({ profile }: GamerCardProps) {
  const displayName = profile.profile.displayName || profile.username;
  const badgeList = profile.profile.badges.slice(0, 4);
  const initials = profile.username.slice(0, 2).toUpperCase();

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
                status={profile.presence.status}
                currentGame={profile.presence.currentGame}
                platform={profile.presence.platform}
              />
            </div>
          </div>

          <Badge tone="accent">Nv. {profile.stats.level}</Badge>
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
