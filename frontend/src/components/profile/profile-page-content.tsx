'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { GamerCard } from '@/components/profile/gamer-card';
import { GameLibraryPreview } from '@/components/profile/game-library-preview';
import { ProfileStats } from '@/components/profile/profile-stats';
import {
  fetchProfileByUsername,
  ProfileRequestError,
} from '@/services/profile';

type ProfilePageContentProps = {
  username: string;
};

function ProfileLoadingState() {
  return (
    <div className="space-y-section" data-testid="profile-loading">
      <Card className="p-0">
        <div className="h-40 w-full animate-pulse bg-background-tertiary" />
        <div className="space-y-4 p-card">
          <div className="h-8 w-56 animate-pulse rounded-control bg-background-tertiary" />
          <div className="h-5 w-72 animate-pulse rounded-control bg-background-tertiary" />
          <div className="h-5 w-44 animate-pulse rounded-control bg-background-tertiary" />
        </div>
      </Card>
      <Card>
        <div className="h-28 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    </div>
  );
}

function ProfileNotFoundState() {
  return (
    <Card data-testid="profile-not-found">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">
          Perfil
        </p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Perfil nao encontrado
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Verifique o username e tente novamente.
        </p>
      </div>
    </Card>
  );
}

function ProfileErrorState() {
  return (
    <Card data-testid="profile-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">
          Perfil
        </p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          Nao foi possivel carregar o perfil
        </h1>
        <p className="text-sm leading-6 text-secondary">
          Tente novamente em instantes.
        </p>
      </div>
    </Card>
  );
}

export function ProfilePageContent({ username }: ProfilePageContentProps) {
  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfileByUsername(username),
  });

  if (profileQuery.isPending) {
    return <ProfileLoadingState />;
  }

  if (profileQuery.isError) {
    if (
      profileQuery.error instanceof ProfileRequestError &&
      profileQuery.error.status === 404
    ) {
      return <ProfileNotFoundState />;
    }

    return <ProfileErrorState />;
  }

  return (
    <div className="space-y-section" data-testid="profile-success">
      <GamerCard profile={profileQuery.data} />
      <ProfileStats stats={profileQuery.data.stats} />
      <GameLibraryPreview games={profileQuery.data.gameLibrary} />
    </div>
  );
}
