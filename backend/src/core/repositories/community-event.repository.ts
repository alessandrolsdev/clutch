import {
  CommunityEventRsvpStatus,
  CommunityEventStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../infra/database/client';

const communityEventSelect = {
  id: true,
  communityId: true,
  title: true,
  description: true,
  startsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          displayName: true,
        },
      },
    },
  },
  rsvps: {
    select: {
      userId: true,
      status: true,
    },
  },
} satisfies Prisma.CommunityEventSelect;

type CommunityEventRecord = Prisma.CommunityEventGetPayload<{
  select: typeof communityEventSelect;
}>;

export type CommunityEventCreatorSummary = {
  id: string;
  username: string;
  displayName: string | null;
};

export type CommunityEventRsvpCounts = {
  going: number;
  interested: number;
  notGoing: number;
};

export type CommunityEventSummary = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  status: CommunityEventStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: CommunityEventCreatorSummary;
  viewerRsvp: CommunityEventRsvpStatus | null;
  rsvpCounts: CommunityEventRsvpCounts;
};

export type CreateCommunityEventInput = {
  communityId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  createdByUserId: string;
};

function toSummary(
  record: CommunityEventRecord,
  viewerUserId?: string | null,
): CommunityEventSummary {
  const rsvpCounts: CommunityEventRsvpCounts = {
    going: 0,
    interested: 0,
    notGoing: 0,
  };
  let viewerRsvp: CommunityEventRsvpStatus | null = null;

  for (const rsvp of record.rsvps) {
    if (rsvp.status === CommunityEventRsvpStatus.GOING) {
      rsvpCounts.going += 1;
    }

    if (rsvp.status === CommunityEventRsvpStatus.INTERESTED) {
      rsvpCounts.interested += 1;
    }

    if (rsvp.status === CommunityEventRsvpStatus.NOT_GOING) {
      rsvpCounts.notGoing += 1;
    }

    if (viewerUserId && rsvp.userId === viewerUserId) {
      viewerRsvp = rsvp.status;
    }
  }

  return {
    id: record.id,
    communityId: record.communityId,
    title: record.title,
    description: record.description,
    startsAt: record.startsAt,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: {
      id: record.createdBy.id,
      username: record.createdBy.username,
      displayName: record.createdBy.profile?.displayName ?? null,
    },
    viewerRsvp,
    rsvpCounts,
  };
}

export const communityEventRepository = {
  async create(input: CreateCommunityEventInput): Promise<CommunityEventSummary> {
    const event = await prisma.communityEvent.create({
      data: {
        communityId: input.communityId,
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt,
        status: CommunityEventStatus.PUBLISHED,
        createdByUserId: input.createdByUserId,
      },
      select: communityEventSelect,
    });

    return toSummary(event, input.createdByUserId);
  },

  async findByCommunityId(
    communityId: string,
    viewerUserId?: string | null,
  ): Promise<CommunityEventSummary[]> {
    const events = await prisma.communityEvent.findMany({
      where: { communityId },
      orderBy: [
        { startsAt: 'asc' },
        { createdAt: 'desc' },
      ],
      select: communityEventSelect,
    });

    return events.map((event) => toSummary(event, viewerUserId));
  },

  async findById(
    communityId: string,
    eventId: string,
    viewerUserId?: string | null,
  ): Promise<CommunityEventSummary | null> {
    const event = await prisma.communityEvent.findFirst({
      where: {
        id: eventId,
        communityId,
      },
      select: communityEventSelect,
    });

    return event ? toSummary(event, viewerUserId) : null;
  },

  async upsertRsvp(
    eventId: string,
    userId: string,
    status: CommunityEventRsvpStatus,
  ): Promise<void> {
    await prisma.communityEventRsvp.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      create: {
        eventId,
        userId,
        status,
      },
      update: { status },
    });
  },

  async cancelEvent(communityId: string, eventId: string): Promise<CommunityEventSummary | null> {
    const result = await prisma.communityEvent.updateMany({
      where: {
        id: eventId,
        communityId,
        status: CommunityEventStatus.PUBLISHED,
      },
      data: {
        status: CommunityEventStatus.CANCELLED,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(communityId, eventId);
  },
};
