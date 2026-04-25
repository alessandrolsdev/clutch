import { CommunityMemberRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  communityRepository,
  type CommunityDetail,
  type CommunitySummary,
} from '../repositories/community.repository';

export type CommunityServiceErrorCode =
  | 'COMMUNITY_NOT_FOUND'
  | 'COMMUNITY_SLUG_CONFLICT'
  | 'COMMUNITY_ALREADY_JOINED'
  | 'COMMUNITY_OWNER_CANNOT_LEAVE'
  | 'COMMUNITY_MEMBERSHIP_NOT_FOUND';

export class CommunityServiceError extends Error {
  readonly code: CommunityServiceErrorCode;

  constructor(code: CommunityServiceErrorCode, message: string) {
    super(message);
    this.name = 'CommunityServiceError';
    this.code = code;
  }
}

export type CreateCommunityServiceInput = {
  ownerUserId: string;
  name: string;
  description?: string | null;
};

function normalizeSlug(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return normalized.length > 0 ? normalized : 'community';
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
}

async function withViewerRole(
  community: CommunitySummary,
  viewerUserId?: string | null,
): Promise<CommunityDetail> {
  if (!viewerUserId) {
    return {
      ...community,
      viewerMembershipRole: null,
    };
  }

  const viewerMembershipRole = await communityRepository.findMembershipRole(
    community.id,
    viewerUserId,
  );

  return {
    ...community,
    viewerMembershipRole,
  };
}

export const communityService = {
  normalizeSlug,

  async listPublicCommunities(): Promise<CommunitySummary[]> {
    return communityRepository.findPublicActive();
  },

  async getPublicCommunity(
    slug: string,
    viewerUserId?: string | null,
  ): Promise<CommunityDetail> {
    const community = await communityRepository.findPublicActiveBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    return withViewerRole(community, viewerUserId);
  },

  async createPublicCommunity(input: CreateCommunityServiceInput): Promise<CommunityDetail> {
    const slug = normalizeSlug(input.name);
    const description = input.description?.trim();
    const existingCommunity = await communityRepository.findBySlug(slug);

    if (existingCommunity) {
      throw new CommunityServiceError(
        'COMMUNITY_SLUG_CONFLICT',
        'Já existe uma comunidade com esse nome.',
      );
    }

    let community: CommunitySummary;

    try {
      community = await communityRepository.create({
        ownerUserId: input.ownerUserId,
        slug,
        name: input.name,
        description: description && description.length > 0 ? description : null,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CommunityServiceError(
          'COMMUNITY_SLUG_CONFLICT',
          'Já existe uma comunidade com esse nome.',
        );
      }

      throw error;
    }

    return {
      ...community,
      viewerMembershipRole: CommunityMemberRole.OWNER,
    };
  },

  async joinCommunity(slug: string, userId: string): Promise<CommunityDetail> {
    const community = await communityRepository.findPublicActiveBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    const existingRole = await communityRepository.findMembershipRole(community.id, userId);

    if (existingRole) {
      throw new CommunityServiceError(
        'COMMUNITY_ALREADY_JOINED',
        'Usuário já participa desta comunidade.',
      );
    }

    try {
      await communityRepository.addMember(community.id, userId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CommunityServiceError(
          'COMMUNITY_ALREADY_JOINED',
          'Usuário já participa desta comunidade.',
        );
      }

      throw error;
    }
    const updatedCommunity = await communityRepository.findPublicActiveBySlug(slug);

    if (!updatedCommunity) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    return {
      ...updatedCommunity,
      viewerMembershipRole: CommunityMemberRole.MEMBER,
    };
  },

  async leaveCommunity(slug: string, userId: string): Promise<CommunityDetail> {
    const community = await communityRepository.findPublicActiveBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    const existingRole = await communityRepository.findMembershipRole(community.id, userId);

    if (existingRole === CommunityMemberRole.OWNER) {
      throw new CommunityServiceError(
        'COMMUNITY_OWNER_CANNOT_LEAVE',
        'O dono da comunidade não pode sair pelo fluxo simples de membership.',
      );
    }

    if (!existingRole) {
      throw new CommunityServiceError(
        'COMMUNITY_MEMBERSHIP_NOT_FOUND',
        'Membership não encontrado para esta comunidade.',
      );
    }

    const removedCount = await communityRepository.removeMember(community.id, userId);

    if (removedCount === 0) {
      throw new CommunityServiceError(
        'COMMUNITY_MEMBERSHIP_NOT_FOUND',
        'Membership não encontrado para esta comunidade.',
      );
    }

    const updatedCommunity = await communityRepository.findPublicActiveBySlug(slug);

    if (!updatedCommunity) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    return {
      ...updatedCommunity,
      viewerMembershipRole: null,
    };
  },
};
