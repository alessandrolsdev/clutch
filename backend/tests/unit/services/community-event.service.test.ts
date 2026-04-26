import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommunityEventRsvpStatus,
  CommunityEventStatus,
  CommunityMemberRole,
  CommunityStatus,
  CommunityVisibility,
} from '@prisma/client';
import {
  communityEventService,
} from '@/core/services/community-event.service';
import { communityRepository, type CommunitySummary } from '@/core/repositories/community.repository';
import {
  communityEventRepository,
  type CommunityEventSummary,
} from '@/core/repositories/community-event.repository';

vi.mock('@/core/repositories/community.repository', () => ({
  communityRepository: {
    findPublicActiveBySlug: vi.fn(),
    findMembershipRole: vi.fn(),
  },
}));

vi.mock('@/core/repositories/community-event.repository', () => ({
  communityEventRepository: {
    create: vi.fn(),
    findByCommunityId: vi.fn(),
    findById: vi.fn(),
    upsertRsvp: vi.fn(),
    cancelEvent: vi.fn(),
  },
}));

const community: CommunitySummary = {
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
};

const event: CommunityEventSummary = {
  id: 'event-id-1',
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

describe('communityEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(communityRepository.findPublicActiveBySlug).mockResolvedValue(community);
  });

  it('permite owner criar evento publicado com data futura', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);
    vi.mocked(communityEventRepository.create).mockResolvedValue(event);

    const result = await communityEventService.createEvent(
      'guilda-dos-speedrunners',
      'owner-id-1',
      {
        title: 'Noite de ranked',
        description: 'Fila fechada para subir elo.',
        startsAt: new Date('2099-05-01T23:00:00.000Z'),
      },
    );

    expect(communityEventRepository.create).toHaveBeenCalledWith({
      communityId: 'community-id-1',
      title: 'Noite de ranked',
      description: 'Fila fechada para subir elo.',
      startsAt: new Date('2099-05-01T23:00:00.000Z'),
      createdByUserId: 'owner-id-1',
    });
    expect(result.status).toBe(CommunityEventStatus.PUBLISHED);
  });

  it('bloqueia criação por membro não-owner', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);

    await expect(
      communityEventService.createEvent('guilda-dos-speedrunners', 'member-id-1', {
        title: 'Noite de ranked',
        startsAt: new Date('2099-05-01T23:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_EVENT_FORBIDDEN',
    });
  });

  it('bloqueia criação com data no passado', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);

    await expect(
      communityEventService.createEvent('guilda-dos-speedrunners', 'owner-id-1', {
        title: 'Noite de ranked',
        startsAt: new Date('2020-05-01T23:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_EVENT_INVALID_START',
    });
  });

  it('permite membro responder RSVP em evento publicado', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);
    vi.mocked(communityEventRepository.findById)
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce({
        ...event,
        viewerRsvp: CommunityEventRsvpStatus.GOING,
        rsvpCounts: { going: 1, interested: 0, notGoing: 0 },
      });
    vi.mocked(communityEventRepository.upsertRsvp).mockResolvedValue(undefined);

    const result = await communityEventService.setRsvp(
      'guilda-dos-speedrunners',
      'event-id-1',
      'member-id-1',
      CommunityEventRsvpStatus.GOING,
    );

    expect(communityEventRepository.upsertRsvp).toHaveBeenCalledWith(
      'event-id-1',
      'member-id-1',
      CommunityEventRsvpStatus.GOING,
    );
    expect(result.viewerRsvp).toBe(CommunityEventRsvpStatus.GOING);
  });

  it('bloqueia RSVP em evento cancelado', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.MEMBER);
    vi.mocked(communityEventRepository.findById).mockResolvedValue({
      ...event,
      status: CommunityEventStatus.CANCELLED,
    });

    await expect(
      communityEventService.setRsvp(
        'guilda-dos-speedrunners',
        'event-id-1',
        'member-id-1',
        CommunityEventRsvpStatus.GOING,
      ),
    ).rejects.toMatchObject({
      code: 'COMMUNITY_EVENT_CANCELLED',
    });
  });

  it('permite owner cancelar evento publicado', async () => {
    vi.mocked(communityRepository.findMembershipRole).mockResolvedValue(CommunityMemberRole.OWNER);
    vi.mocked(communityEventRepository.findById).mockResolvedValue(event);
    vi.mocked(communityEventRepository.cancelEvent).mockResolvedValue({
      ...event,
      status: CommunityEventStatus.CANCELLED,
    });

    const result = await communityEventService.cancelEvent(
      'guilda-dos-speedrunners',
      'event-id-1',
      'owner-id-1',
    );

    expect(communityEventRepository.cancelEvent).toHaveBeenCalledWith(
      'community-id-1',
      'event-id-1',
    );
    expect(result.status).toBe(CommunityEventStatus.CANCELLED);
  });
});
