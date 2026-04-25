import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityMemberRole, CommunityStatus, CommunityVisibility } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { communityService } from '@/core/services/community.service';
import { communityRepository, type CommunitySummary } from '@/core/repositories/community.repository';

vi.mock('@/core/repositories/community.repository', () => ({
  communityRepository: {
    create: vi.fn(),
    findPublicActive: vi.fn(),
    findPublicActiveBySlug: vi.fn(),
    findBySlug: vi.fn(),
    findMembershipRole: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
}));

const baseCommunity: CommunitySummary = {
  id: 'community-id-1',
  slug: 'guilda-dos-speedrunners',
  name: 'Guilda dos Speedrunners',
  description: 'Runs, PBs e desafios semanais.',
  visibility: CommunityVisibility.PUBLIC,
  status: CommunityStatus.ACTIVE,
  owner: {
    id: 'owner-id-1',
    username: 'owner',
    displayName: 'Owner',
    avatarUrl: null,
  },
  memberCount: 1,
  createdAt: new Date('2026-04-25T10:00:00.000Z'),
  updatedAt: new Date('2026-04-25T10:00:00.000Z'),
};

function createUniqueConstraintError(target: string[]): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target },
  });
}

describe('communityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza slug a partir do nome da comunidade', () => {
    expect(communityService.normalizeSlug('Guilda dos Speedrunners!')).toBe(
      'guilda-dos-speedrunners',
    );
  });

  it('cria comunidade pública com membership OWNER para o criador', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(communityRepository.create).mockResolvedValue(baseCommunity);

    const result = await communityService.createPublicCommunity({
      ownerUserId: 'owner-id-1',
      name: 'Guilda dos Speedrunners',
      description: 'Runs, PBs e desafios semanais.',
    });

    expect(communityRepository.create).toHaveBeenCalledWith({
      ownerUserId: 'owner-id-1',
      slug: 'guilda-dos-speedrunners',
      name: 'Guilda dos Speedrunners',
      description: 'Runs, PBs e desafios semanais.',
    });
    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.OWNER);
  });

  it('bloqueia criação com slug já existente', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);

    await expect(
      communityService.createPublicCommunity({
        ownerUserId: 'owner-id-1',
        name: 'Guilda dos Speedrunners',
      }),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_SLUG_CONFLICT',
    });
  });

  it('traduz corrida de slug único na criação para conflito de domínio', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(communityRepository.create).mockRejectedValue(
      createUniqueConstraintError(['slug']),
    );

    await expect(
      communityService.createPublicCommunity({
        ownerUserId: 'owner-id-1',
        name: 'Guilda dos Speedrunners',
      }),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_SLUG_CONFLICT',
    });
  });

  it('retorna papel do viewer ao buscar comunidade pública autenticada', async () => {
    vi.mocked(communityRepository.findPublicActiveBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);

    const result = await communityService.getPublicCommunity(
      'guilda-dos-speedrunners',
      'member-id-1',
    );

    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.MEMBER);
  });

  it('permite entrar em comunidade pública quando usuário ainda não é membro', async () => {
    vi.mocked(communityRepository.findPublicActiveBySlug)
      .mockResolvedValueOnce(baseCommunity)
      .mockResolvedValueOnce({ ...baseCommunity, memberCount: 2 });
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(null);
    vi.mocked(communityRepository.addMember).mockResolvedValue(CommunityMemberRole.MEMBER);

    const result = await communityService.joinCommunity(
      'guilda-dos-speedrunners',
      'member-id-1',
    );

    expect(communityRepository.addMember).toHaveBeenCalledWith(
      'community-id-1',
      'member-id-1',
    );
    expect(result.memberCount).toBe(2);
    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.MEMBER);
  });

  it('traduz corrida de membership único ao entrar para conflito de domínio', async () => {
    vi.mocked(communityRepository.findPublicActiveBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(null);
    vi.mocked(communityRepository.addMember).mockRejectedValue(
      createUniqueConstraintError(['communityId', 'userId']),
    );

    await expect(
      communityService.joinCommunity('guilda-dos-speedrunners', 'member-id-1'),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_ALREADY_JOINED',
    });
  });

  it('impede owner de sair pelo fluxo simples de membership', async () => {
    vi.mocked(communityRepository.findPublicActiveBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);

    await expect(
      communityService.leaveCommunity('guilda-dos-speedrunners', 'owner-id-1'),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_OWNER_CANNOT_LEAVE',
    });
  });
});
