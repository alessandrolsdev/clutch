import {
  CommunityMemberRole,
  CommunityStatus,
  CommunityVisibility,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../infra/database/client';

const communitySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  visibility: true,
  status: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  },
  _count: {
    select: {
      members: true,
    },
  },
} satisfies Prisma.CommunitySelect;

type CommunityRecord = Prisma.CommunityGetPayload<{ select: typeof communitySelect }>;

export type CommunityOwnerSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CommunitySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  status: CommunityStatus;
  owner: CommunityOwnerSummary;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CommunityDetail = CommunitySummary & {
  viewerMembershipRole: CommunityMemberRole | null;
};

export type CreateCommunityInput = {
  ownerUserId: string;
  slug: string;
  name: string;
  description?: string | null;
};

function toSummary(record: CommunityRecord): CommunitySummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    visibility: record.visibility,
    status: record.status,
    owner: {
      id: record.owner.id,
      username: record.owner.username,
      displayName: record.owner.profile?.displayName ?? null,
      avatarUrl: record.owner.profile?.avatarUrl ?? null,
    },
    memberCount: record._count.members,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const communityRepository = {
  async create(input: CreateCommunityInput): Promise<CommunitySummary> {
    const community = await prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          visibility: CommunityVisibility.PUBLIC,
          status: CommunityStatus.ACTIVE,
          ownerUserId: input.ownerUserId,
        },
        select: {
          id: true,
        },
      });

      await tx.communityMember.create({
        data: {
          communityId: created.id,
          userId: input.ownerUserId,
          role: CommunityMemberRole.OWNER,
        },
      });

      return tx.community.findUniqueOrThrow({
        where: { id: created.id },
        select: communitySelect,
      });
    });

    return toSummary(community);
  },

  async findPublicActive(limit = 50): Promise<CommunitySummary[]> {
    const communities = await prisma.community.findMany({
      where: {
        visibility: CommunityVisibility.PUBLIC,
        status: CommunityStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: communitySelect,
    });

    return communities.map(toSummary);
  },

  async findPublicActiveBySlug(slug: string): Promise<CommunitySummary | null> {
    const community = await prisma.community.findFirst({
      where: {
        slug,
        visibility: CommunityVisibility.PUBLIC,
        status: CommunityStatus.ACTIVE,
      },
      select: communitySelect,
    });

    return community ? toSummary(community) : null;
  },

  async findBySlug(slug: string): Promise<CommunitySummary | null> {
    const community = await prisma.community.findUnique({
      where: { slug },
      select: communitySelect,
    });

    return community ? toSummary(community) : null;
  },

  async findMembershipRole(
    communityId: string,
    userId: string,
  ): Promise<CommunityMemberRole | null> {
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    return membership?.role ?? null;
  },

  async addMember(communityId: string, userId: string): Promise<CommunityMemberRole> {
    const membership = await prisma.communityMember.create({
      data: {
        communityId,
        userId,
        role: CommunityMemberRole.MEMBER,
      },
      select: {
        role: true,
      },
    });

    return membership.role;
  },

  async removeMember(communityId: string, userId: string): Promise<number> {
    const result = await prisma.communityMember.deleteMany({
      where: {
        communityId,
        userId,
        role: CommunityMemberRole.MEMBER,
      },
    });

    return result.count;
  },
};
