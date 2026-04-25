import { CommunityPageContent } from '@/components/communities/community-page-content';

type CommunityPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { slug } = await params;

  return <CommunityPageContent slug={slug} />;
}
