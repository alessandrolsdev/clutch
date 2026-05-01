import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityMemberRole, CommunityStatus, CommunityVisibility } from '@prisma/client';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  communityService,
  CommunityServiceError,
} from '@/core/services/community.service';

vi.mock('@/core/services/community.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/services/community.service')>();

  return {
    ...actual,
    communityService: {
      listPublicCommunities: vi.fn(),
      getPublicCommunity: vi.fn(),
      createPublicCommunity: vi.fn(),
      joinCommunity: vi.fn(),
      leaveCommunity: vi.fn(),
      archiveCommunity: vi.fn(),
    },
  };
});

vi.mock('@/infra/integrations/steam/steam.service', () => ({ steamService: {} }));
vi.mock('@/infra/integrations/igdb/igdb.service', () => ({ igdbService: {} }));
vi.mock('@/infra/integrations/epic/epic.service', () => ({ epicService: {} }));

const mockCommunity = {
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
  memberCount: 12,
  createdAt: new Date('2026-04-25T10:00:00.000Z'),
  updatedAt: new Date('2026-04-25T10:00:00.000Z'),
  viewerMembershipRole: null,
};

describe('Communities Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista comunidades públicas', async () => {
    vi.mocked(communityService.listPublicCommunities).mockResolvedValue([mockCommunity]);

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/communities' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      communities: [
        {
          slug: 'guilda-dos-speedrunners',
          memberCount: 12,
        },
      ],
    });
    await app.close();
  });

  it('retorna detalhe público com viewer autenticado quando token existe', async () => {
    vi.mocked(communityService.getPublicCommunity).mockResolvedValue({
      ...mockCommunity,
      viewerMembershipRole: CommunityMemberRole.MEMBER,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'GET',
      url: '/communities/guilda-dos-speedrunners',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityService.getPublicCommunity).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'member-id-1',
    );
    await app.close();
  });

  it('retorna detalhe direto de comunidade arquivada', async () => {
    vi.mocked(communityService.getPublicCommunity).mockResolvedValue({
      ...mockCommunity,
      status: CommunityStatus.ARCHIVED,
      viewerMembershipRole: null,
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/communities/guilda-dos-speedrunners',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      community: {
        slug: 'guilda-dos-speedrunners',
        status: CommunityStatus.ARCHIVED,
      },
    });
    await app.close();
  });

  it('cria comunidade pública autenticada', async () => {
    vi.mocked(communityService.createPublicCommunity).mockResolvedValue({
      ...mockCommunity,
      viewerMembershipRole: CommunityMemberRole.OWNER,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Guilda dos Speedrunners',
        description: 'Runs, PBs e desafios semanais.',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(communityService.createPublicCommunity).toHaveBeenCalledWith({
      ownerUserId: 'owner-id-1',
      name: 'Guilda dos Speedrunners',
      description: 'Runs, PBs e desafios semanais.',
    });
    await app.close();
  });

  it('retorna 409 ao criar comunidade com slug existente ou corrida de criação', async () => {
    vi.mocked(communityService.createPublicCommunity).mockRejectedValue(
      new CommunityServiceError(
        'COMMUNITY_SLUG_CONFLICT',
        'Já existe uma comunidade com esse nome.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Guilda dos Speedrunners',
      },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('cria comunidade publica com slug unico gerado pelo service', async () => {
    vi.mocked(communityService.createPublicCommunity).mockResolvedValue({
      ...mockCommunity,
      slug: 'guilda-dos-speedrunners-2',
      viewerMembershipRole: CommunityMemberRole.OWNER,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Guilda dos Speedrunners',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      community: {
        slug: 'guilda-dos-speedrunners-2',
      },
    });
    await app.close();
  });

  it('permite entrar em comunidade autenticada', async () => {
    vi.mocked(communityService.joinCommunity).mockResolvedValue({
      ...mockCommunity,
      memberCount: 13,
      viewerMembershipRole: CommunityMemberRole.MEMBER,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/join',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityService.joinCommunity).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'member-id-1',
    );
    await app.close();
  });

  it('retorna 409 quando corrida de membership indica usuário já participante', async () => {
    vi.mocked(communityService.joinCommunity).mockRejectedValue(
      new CommunityServiceError(
        'COMMUNITY_ALREADY_JOINED',
        'Usuário já participa desta comunidade.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/join',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('permite sair de comunidade autenticada', async () => {
    vi.mocked(communityService.leaveCommunity).mockResolvedValue(mockCommunity);

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'DELETE',
      url: '/communities/guilda-dos-speedrunners/membership',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityService.leaveCommunity).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'member-id-1',
    );
    await app.close();
  });

  it('permite owner arquivar comunidade', async () => {
    vi.mocked(communityService.archiveCommunity).mockResolvedValue({
      ...mockCommunity,
      status: CommunityStatus.ARCHIVED,
      viewerMembershipRole: CommunityMemberRole.OWNER,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/communities/guilda-dos-speedrunners/archive',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityService.archiveCommunity).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'owner-id-1',
    );
    expect(response.json()).toMatchObject({
      community: {
        status: CommunityStatus.ARCHIVED,
      },
    });
    await app.close();
  });

  it('bloqueia arquivamento por membro comum', async () => {
    vi.mocked(communityService.archiveCommunity).mockRejectedValue(
      new CommunityServiceError(
        'COMMUNITY_FORBIDDEN',
        'Apenas o owner pode arquivar esta comunidade.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/communities/guilda-dos-speedrunners/archive',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('bloqueia join em comunidade arquivada com erro de dominio', async () => {
    vi.mocked(communityService.joinCommunity).mockRejectedValue(
      new CommunityServiceError(
        'COMMUNITY_ARCHIVED',
        'Comunidade arquivada não aceita novos membros.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/join',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });
});
