import type { Metadata } from 'next';
import { ProfilePageContent } from '@/components/profile/profile-page-content';
import {
  buildPublicProfileMetadata,
  fetchPublicProfileForShare,
} from '@/lib/profile/public-profile-share';

type ProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchPublicProfileForShare(username);

  return buildPublicProfileMetadata(username, profile);
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return <ProfilePageContent username={username} />;
}
