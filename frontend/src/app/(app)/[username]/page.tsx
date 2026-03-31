import { ProfilePageContent } from '@/components/profile/profile-page-content';

type ProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return <ProfilePageContent username={username} />;
}
