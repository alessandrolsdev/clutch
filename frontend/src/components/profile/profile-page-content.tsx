'use client';

import { useQuery } from '@tanstack/react-query';
import { FriendButton } from '@/components/friends/friend-button';
import { FriendsList } from '@/components/friends/friends-list';
import { Card } from '@/components/ui/card';
import { GamerCard } from '@/components/profile/gamer-card';
import { GameLibraryPreview } from '@/components/profile/game-library-preview';
import { ProfileSkeleton } from '@/components/profile/profile-skeleton';
import { ProfileStats } from '@/components/profile/profile-stats';
import {
  fetchProfileByUsername,
  ProfileRequestError,
} from '@/services/profile';

type ProfilePageContentProps = {
  username: string;
};

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
    return <ProfileSkeleton />;
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
      <GamerCard
        profile={profileQuery.data}
        actions={<FriendButton targetUserId={profileQuery.data.id} />}
      />
      <ProfileStats stats={profileQuery.data.stats} />
      <FriendsList
        userId={profileQuery.data.id}
        title={`Amigos de @${profileQuery.data.username}`}
      />
      <GameLibraryPreview
        username={profileQuery.data.username}
        games={profileQuery.data.gameLibrary}
      />
    </div>
  );
}
