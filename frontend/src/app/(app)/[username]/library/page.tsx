import type { Metadata } from 'next';
import { LibraryPageContent } from '@/components/library/library-page-content';
import {
  buildPublicLibraryMetadata,
  fetchPublicLibraryForShare,
} from '@/lib/profile/public-library-share';

type LibraryPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({
  params,
}: LibraryPageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchPublicLibraryForShare(username);

  return buildPublicLibraryMetadata(username, profile);
}

export default async function LibraryPage({ params }: LibraryPageProps) {
  const { username } = await params;

  return <LibraryPageContent username={username} />;
}
