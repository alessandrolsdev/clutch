import { LibraryPageContent } from '@/components/library/library-page-content';

type LibraryPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function LibraryPage({ params }: LibraryPageProps) {
  const { username } = await params;

  return <LibraryPageContent username={username} />;
}
