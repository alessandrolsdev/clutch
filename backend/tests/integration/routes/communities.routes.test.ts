import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommunityEventRsvpStatus,
  CommunityEventStatus,
  CommunityMemberRole,
  CommunityStatus,
  CommunityVisibility,
} from '@prisma/client';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  communityService,
  CommunityServiceError,
} from '@/core/services/community.service';
import {
  communityEventService,
  CommunityEventServiceError,
} from '@/core/services/community-event.service';

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

vi.mock('@/core/services/community-event.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/services/community-event.service')>();

  return {
    ...actual,
    communityEventService: {
      listEvents: vi.fn(),
      getEvent: vi.fn(),
      createEvent: vi.fn(),
      setRsvp: vi.fn(),
      cancelEvent: vi.fn(),
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

const mockEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  communityId: 'community-id-1',
  title: 'Noite de ranked',
  description: 'Fila fechada para subir elo.',
  startsAt: new Date('2099-05-01T23:00:00.000Z'),
  status: CommunityEventStatus.PUBLISHED,
  createdAt: new Date('2026-04-25T10:00:00.000Z'),
  updatedAt: new Date('2026-04-25T10:00:00.000Z'),
  createdBy: {
    id: 'owner-id-1',
    username: 'owner',
    displayName: 'Owner',
  },
  viewerRsvp: null,
  rsvpCounts: {
    going: 0,
    interested: 0,
    notGoing: 0,
  },
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

  it('lista eventos da comunidade', async () => {
    vi.mocked(communityEventService.listEvents).mockResolvedValue([mockEvent]);

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'GET',
      url: '/communities/guilda-dos-speedrunners/events',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityEventService.listEvents).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'member-id-1',
    );
    expect(response.json()).toMatchObject({
      events: [
        {
          id: mockEvent.id,
          title: 'Noite de ranked',
          status: CommunityEventStatus.PUBLISHED,
        },
      ],
    });
    await app.close();
  });

  it('permite owner criar evento em comunidade ativa', async () => {
    vi.mocked(communityEventService.createEvent).mockResolvedValue(mockEvent);

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/events',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        title: 'Noite de ranked',
        description: 'Fila fechada para subir elo.',
        startsAt: '2099-05-01T23:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(communityEventService.createEvent).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      'owner-id-1',
      {
        title: 'Noite de ranked',
        description: 'Fila fechada para subir elo.',
        startsAt: new Date('2099-05-01T23:00:00.000Z'),
      },
    );
    await app.close();
  });

  it('bloqueia criação de evento em comunidade arquivada', async () => {
    vi.mocked(communityEventService.createEvent).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_ARCHIVED',
        'Comunidade arquivada não aceita novas ações de eventos.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/events',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        title: 'Noite de ranked',
        startsAt: '2099-05-01T23:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('bloqueia criação de evento sem autenticação', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/events',
      payload: {
        title: 'Noite de ranked',
        startsAt: '2099-05-01T23:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(communityEventService.createEvent).not.toHaveBeenCalled();
    await app.close();
  });

  it('bloqueia criação de evento por não-owner', async () => {
    vi.mocked(communityEventService.createEvent).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_EVENT_FORBIDDEN',
        'Apenas o owner pode gerenciar eventos desta comunidade.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'POST',
      url: '/communities/guilda-dos-speedrunners/events',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        title: 'Noite de ranked',
        startsAt: '2099-05-01T23:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('permite RSVP em evento de comunidade ativa', async () => {
    vi.mocked(communityEventService.setRsvp).mockResolvedValue({
      ...mockEvent,
      viewerRsvp: CommunityEventRsvpStatus.GOING,
      rsvpCounts: { going: 1, interested: 0, notGoing: 0 },
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'PUT',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/rsvp`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        status: CommunityEventRsvpStatus.GOING,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(communityEventService.setRsvp).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      mockEvent.id,
      'member-id-1',
      CommunityEventRsvpStatus.GOING,
    );
    expect(response.json()).toMatchObject({
      event: {
        viewerRsvp: CommunityEventRsvpStatus.GOING,
      },
    });
    await app.close();
  });

  it('bloqueia RSVP em comunidade arquivada', async () => {
    vi.mocked(communityEventService.setRsvp).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_ARCHIVED',
        'Comunidade arquivada não aceita novas ações de eventos.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'PUT',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/rsvp`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        status: CommunityEventRsvpStatus.GOING,
      },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('bloqueia RSVP sem autenticação', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/rsvp`,
      payload: {
        status: CommunityEventRsvpStatus.GOING,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(communityEventService.setRsvp).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejeita status inválido de RSVP', async () => {
    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'PUT',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/rsvp`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        status: 'MAYBE',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(communityEventService.setRsvp).not.toHaveBeenCalled();
    await app.close();
  });

  it('bloqueia RSVP por não-membro', async () => {
    vi.mocked(communityEventService.setRsvp).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_MEMBERSHIP_REQUIRED',
        'Apenas membros podem responder RSVP nesta comunidade.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'outsider-id-1');
    const response = await app.inject({
      method: 'PUT',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/rsvp`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        status: CommunityEventRsvpStatus.GOING,
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('permite owner cancelar evento', async () => {
    vi.mocked(communityEventService.cancelEvent).mockResolvedValue({
      ...mockEvent,
      status: CommunityEventStatus.CANCELLED,
    });

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'PATCH',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/cancel`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(communityEventService.cancelEvent).toHaveBeenCalledWith(
      'guilda-dos-speedrunners',
      mockEvent.id,
      'owner-id-1',
    );
    expect(response.json()).toMatchObject({
      event: {
        status: CommunityEventStatus.CANCELLED,
      },
    });
    await app.close();
  });

  it('impede não-owner de cancelar evento', async () => {
    vi.mocked(communityEventService.cancelEvent).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_EVENT_FORBIDDEN',
        'Apenas o owner pode gerenciar eventos desta comunidade.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'member-id-1');
    const response = await app.inject({
      method: 'PATCH',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/cancel`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('bloqueia cancelamento em comunidade arquivada', async () => {
    vi.mocked(communityEventService.cancelEvent).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_ARCHIVED',
        'Comunidade arquivada não aceita novas ações de eventos.',
      ),
    );

    const app = await buildApp();
    const token = generateTestToken(app, 'owner-id-1');
    const response = await app.inject({
      method: 'PATCH',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}/cancel`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('retorna erro seguro para evento inexistente', async () => {
    vi.mocked(communityEventService.getEvent).mockRejectedValue(
      new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      ),
    );

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/communities/guilda-dos-speedrunners/events/${mockEvent.id}`,
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
