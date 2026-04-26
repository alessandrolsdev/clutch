import { CommunityEventRsvpStatus, CommunityEventStatus, CommunityMemberRole } from '@prisma/client';
import { communityEventRepository, type CommunityEventSummary } from '../repositories/community-event.repository';
import { communityRepository, type CommunitySummary } from '../repositories/community.repository';

export type CommunityEventServiceErrorCode =
  | 'COMMUNITY_NOT_FOUND'
  | 'COMMUNITY_EVENT_NOT_FOUND'
  | 'COMMUNITY_EVENT_FORBIDDEN'
  | 'COMMUNITY_EVENT_INVALID_START'
  | 'COMMUNITY_EVENT_CANCELLED'
  | 'COMMUNITY_MEMBERSHIP_REQUIRED';

export class CommunityEventServiceError extends Error {
  readonly code: CommunityEventServiceErrorCode;

  constructor(code: CommunityEventServiceErrorCode, message: string) {
    super(message);
    this.name = 'CommunityEventServiceError';
    this.code = code;
  }
}

export type CreateCommunityEventServiceInput = {
  title: string;
  description?: string | null;
  startsAt: Date;
};

async function findActiveCommunity(slug: string): Promise<CommunitySummary> {
  const community = await communityRepository.findPublicActiveBySlug(slug);

  if (!community) {
    throw new CommunityEventServiceError(
      'COMMUNITY_NOT_FOUND',
      'Comunidade pública não encontrada.',
    );
  }

  return community;
}

async function requireOwner(communityId: string, userId: string): Promise<void> {
  const role = await communityRepository.findMembershipRole(communityId, userId);

  if (role !== CommunityMemberRole.OWNER) {
    throw new CommunityEventServiceError(
      'COMMUNITY_EVENT_FORBIDDEN',
      'Apenas o owner pode gerenciar eventos desta comunidade.',
    );
  }
}

async function requireMember(communityId: string, userId: string): Promise<void> {
  const role = await communityRepository.findMembershipRole(communityId, userId);

  if (!role) {
    throw new CommunityEventServiceError(
      'COMMUNITY_MEMBERSHIP_REQUIRED',
      'Apenas membros podem responder RSVP nesta comunidade.',
    );
  }
}

function assertFutureStart(startsAt: Date): void {
  if (startsAt.getTime() <= Date.now()) {
    throw new CommunityEventServiceError(
      'COMMUNITY_EVENT_INVALID_START',
      'O evento precisa começar no futuro.',
    );
  }
}

export const communityEventService = {
  async listEvents(
    slug: string,
    viewerUserId?: string | null,
  ): Promise<CommunityEventSummary[]> {
    const community = await findActiveCommunity(slug);

    return communityEventRepository.findByCommunityId(community.id, viewerUserId);
  },

  async getEvent(
    slug: string,
    eventId: string,
    viewerUserId?: string | null,
  ): Promise<CommunityEventSummary> {
    const community = await findActiveCommunity(slug);
    const event = await communityEventRepository.findById(
      community.id,
      eventId,
      viewerUserId,
    );

    if (!event) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      );
    }

    return event;
  },

  async createEvent(
    slug: string,
    userId: string,
    input: CreateCommunityEventServiceInput,
  ): Promise<CommunityEventSummary> {
    const community = await findActiveCommunity(slug);
    await requireOwner(community.id, userId);
    assertFutureStart(input.startsAt);

    const description = input.description?.trim();

    return communityEventRepository.create({
      communityId: community.id,
      title: input.title.trim(),
      description: description && description.length > 0 ? description : null,
      startsAt: input.startsAt,
      createdByUserId: userId,
    });
  },

  async setRsvp(
    slug: string,
    eventId: string,
    userId: string,
    status: CommunityEventRsvpStatus,
  ): Promise<CommunityEventSummary> {
    const community = await findActiveCommunity(slug);
    await requireMember(community.id, userId);

    const event = await communityEventRepository.findById(community.id, eventId, userId);

    if (!event) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      );
    }

    if (event.status === CommunityEventStatus.CANCELLED) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_CANCELLED',
        'Evento cancelado não aceita RSVP.',
      );
    }

    await communityEventRepository.upsertRsvp(event.id, userId, status);
    const updatedEvent = await communityEventRepository.findById(community.id, eventId, userId);

    if (!updatedEvent) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      );
    }

    return updatedEvent;
  },

  async cancelEvent(
    slug: string,
    eventId: string,
    userId: string,
  ): Promise<CommunityEventSummary> {
    const community = await findActiveCommunity(slug);
    await requireOwner(community.id, userId);

    const existingEvent = await communityEventRepository.findById(community.id, eventId, userId);

    if (!existingEvent) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      );
    }

    if (existingEvent.status === CommunityEventStatus.CANCELLED) {
      return existingEvent;
    }

    const cancelledEvent = await communityEventRepository.cancelEvent(community.id, eventId);

    if (!cancelledEvent) {
      throw new CommunityEventServiceError(
        'COMMUNITY_EVENT_NOT_FOUND',
        'Evento comunitário não encontrado.',
      );
    }

    return {
      ...cancelledEvent,
      viewerRsvp: existingEvent.viewerRsvp,
    };
  },
};
