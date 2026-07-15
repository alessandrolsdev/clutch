import { CommunityMemberRole, CommunityStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  communityRepository,
  type CommunityDetail,
  type CommunitySummary,
} from '../repositories/community.repository';

export type CommunityServiceErrorCode =
  | 'COMMUNITY_NOT_FOUND'
  | 'COMMUNITY_SLUG_CONFLICT'
  | 'COMMUNITY_ARCHIVED'
  | 'COMMUNITY_ALREADY_JOINED'
  | 'COMMUNITY_OWNER_CANNOT_LEAVE'
  | 'COMMUNITY_FORBIDDEN'
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
    .slice(0, 64)
    .replace(/-+$/g, '');

  return normalized.length > 0 ? normalized : 'community';
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
}

function buildSlugCandidate(baseSlug: string, offset: number): string {
  if (offset === 0) {
    return baseSlug;
  }

  const suffix = `-${offset + 1}`;
  return `${baseSlug.slice(0, 64 - suffix.length).replace(/-+$/g, '')}${suffix}`;
}

async function resolveAvailableSlug(baseSlug: string): Promise<string> {
  for (let offset = 0; offset < 20; offset += 1) {
    const candidate = buildSlugCandidate(baseSlug, offset);
    const exists = await communityRepository.slugExists(candidate);

    if (!exists) {
      return candidate;
    }
  }

  throw new CommunityServiceError(
    'COMMUNITY_SLUG_CONFLICT',
    'Não foi possível gerar um slug único para esta comunidade.',
  );
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
    const community = await communityRepository.findBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    return withViewerRole(community, viewerUserId);
  },

  async createPublicCommunity(input: CreateCommunityServiceInput): Promise<CommunityDetail> {
    const baseSlug = normalizeSlug(input.name);
    const description = input.description?.trim();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = await resolveAvailableSlug(baseSlug);

      try {
        const community = await communityRepository.create({
          ownerUserId: input.ownerUserId,
          slug,
          name: input.name,
          description: description && description.length > 0 ? description : null,
        });

        return {
          ...community,
          viewerMembershipRole: CommunityMemberRole.OWNER,
        };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new CommunityServiceError(
      'COMMUNITY_SLUG_CONFLICT',
      'Não foi possível gerar um slug único para esta comunidade.',
    );
  },

  async joinCommunity(slug: string, userId: string): Promise<CommunityDetail> {
    const community = await communityRepository.findBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    if (community.status === CommunityStatus.ARCHIVED) {
      throw new CommunityServiceError(
        'COMMUNITY_ARCHIVED',
        'Comunidade arquivada não aceita novos membros.',
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
    const updatedCommunity = await communityRepository.findBySlug(slug);

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
    const community = await communityRepository.findBySlug(slug);

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

    const updatedCommunity = await communityRepository.findBySlug(slug);

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

  async archiveCommunity(slug: string, userId: string): Promise<CommunityDetail> {
    const community = await communityRepository.findBySlug(slug);

    if (!community) {
      throw new CommunityServiceError(
        'COMMUNITY_NOT_FOUND',
        'Comunidade pública não encontrada.',
      );
    }

    const existingRole = await communityRepository.findMembershipRole(community.id, userId);

    if (existingRole !== CommunityMemberRole.OWNER) {
      throw new CommunityServiceError(
        'COMMUNITY_FORBIDDEN',
        'Apenas o owner pode arquivar esta comunidade.',
      );
    }

    if (community.status === CommunityStatus.ARCHIVED) {
      return {
        ...community,
        viewerMembershipRole: CommunityMemberRole.OWNER,
      };
    }

    const archivedCommunity = await communityRepository.archive(community.id);

    return {
      ...archivedCommunity,
      viewerMembershipRole: CommunityMemberRole.OWNER,
    };
  },
};
