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
    slugExists: vi.fn(),
    findBySlug: vi.fn(),
    findMembershipRole: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    archive: vi.fn(),
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

  it('usa fallback seguro quando nome não gera slug válido', () => {
    expect(communityService.normalizeSlug('!!!')).toBe('community');
  });

  it('remove hífen final após truncar slug longo', () => {
    expect(communityService.normalizeSlug(`${'a'.repeat(63)} Guilda`)).toBe('a'.repeat(63));
  });

  it('lista apenas comunidades públicas ativas pelo repository dedicado', async () => {
    vi.mocked(communityRepository.findPublicActive).mockResolvedValue([baseCommunity]);

    const result = await communityService.listPublicCommunities();

    expect(communityRepository.findPublicActive).toHaveBeenCalledTimes(1);
    expect(result).toEqual([baseCommunity]);
  });

  it('cria comunidade pública com membership OWNER para o criador', async () => {
    vi.mocked(communityRepository.slugExists).mockResolvedValue(false);
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

  it('gera slug unico previsivel quando nomes equivalentes colidem', async () => {
    vi.mocked(communityRepository.slugExists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(communityRepository.create).mockResolvedValue({
      ...baseCommunity,
      slug: 'guilda-dos-speedrunners-2',
    });

    const result = await communityService.createPublicCommunity({
      ownerUserId: 'owner-id-1',
      name: 'Guilda dos Speedrunners',
    });

    expect(communityRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'guilda-dos-speedrunners-2',
    }));
    expect(result.slug).toBe('guilda-dos-speedrunners-2');
  });

  it('retenta criacao quando corrida concorrente ocupa slug candidato', async () => {
    vi.mocked(communityRepository.slugExists)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(communityRepository.create)
      .mockRejectedValueOnce(createUniqueConstraintError(['slug']))
      .mockResolvedValueOnce({
        ...baseCommunity,
        slug: 'guilda-dos-speedrunners-2',
      });

    const result = await communityService.createPublicCommunity({
      ownerUserId: 'owner-id-1',
      name: 'Guilda dos Speedrunners',
    });

    expect(communityRepository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      slug: 'guilda-dos-speedrunners-2',
    }));
    expect(result.slug).toBe('guilda-dos-speedrunners-2');
  });

  it('retorna papel do viewer ao buscar comunidade pública autenticada', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);

    const result = await communityService.getPublicCommunity(
      'guilda-dos-speedrunners',
      'member-id-1',
    );

    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.MEMBER);
  });

  it('permite entrar em comunidade pública quando usuário ainda não é membro', async () => {
    vi.mocked(communityRepository.findBySlug)
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
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);
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
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);

    await expect(
      communityService.leaveCommunity('guilda-dos-speedrunners', 'owner-id-1'),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_OWNER_CANNOT_LEAVE',
    });
  });

  it('bloqueia entrada em comunidade arquivada', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue({
      ...baseCommunity,
      status: CommunityStatus.ARCHIVED,
    });

    await expect(
      communityService.joinCommunity('guilda-dos-speedrunners', 'member-id-1'),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_ARCHIVED',
    });
    expect(communityRepository.addMember).not.toHaveBeenCalled();
  });

  it('permite membro sair de comunidade arquivada sem reabrir a comunidade', async () => {
    vi.mocked(communityRepository.findBySlug)
      .mockResolvedValueOnce({
        ...baseCommunity,
        status: CommunityStatus.ARCHIVED,
      })
      .mockResolvedValueOnce({
        ...baseCommunity,
        status: CommunityStatus.ARCHIVED,
        memberCount: 1,
      });
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);
    vi.mocked(communityRepository.removeMember).mockResolvedValue(1);

    const result = await communityService.leaveCommunity(
      'guilda-dos-speedrunners',
      'member-id-1',
    );

    expect(result.status).toBe(CommunityStatus.ARCHIVED);
    expect(result.viewerMembershipRole).toBeNull();
  });

  it('permite owner arquivar comunidade ativa', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);
    vi.mocked(communityRepository.archive).mockResolvedValue({
      ...baseCommunity,
      status: CommunityStatus.ARCHIVED,
    });

    const result = await communityService.archiveCommunity(
      'guilda-dos-speedrunners',
      'owner-id-1',
    );

    expect(communityRepository.archive).toHaveBeenCalledWith('community-id-1');
    expect(result.status).toBe(CommunityStatus.ARCHIVED);
    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.OWNER);
  });

  it('bloqueia arquivamento por membro comum', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue(baseCommunity);
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);

    await expect(
      communityService.archiveCommunity('guilda-dos-speedrunners', 'member-id-1'),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_FORBIDDEN',
    });
    expect(communityRepository.archive).not.toHaveBeenCalled();
  });

  it('mantém arquivamento idempotente quando comunidade já está arquivada', async () => {
    vi.mocked(communityRepository.findBySlug).mockResolvedValue({
      ...baseCommunity,
      status: CommunityStatus.ARCHIVED,
    });
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);

    const result = await communityService.archiveCommunity(
      'guilda-dos-speedrunners',
      'owner-id-1',
    );

    expect(communityRepository.archive).not.toHaveBeenCalled();
    expect(result.status).toBe(CommunityStatus.ARCHIVED);
    expect(result.viewerMembershipRole).toBe(CommunityMemberRole.OWNER);
  });
});
