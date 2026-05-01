import { CommunityEventRsvpStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { communityEventRepository } from '@/core/repositories/community-event.repository';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    communityEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    communityEventRsvp: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

describe('communityEventRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa upsert por eventId e userId para atualizar RSVP sem duplicar', async () => {
    vi.mocked(prisma.communityEventRsvp.upsert).mockResolvedValue({
      id: 'rsvp-id-1',
      eventId: 'event-id-1',
      userId: 'user-id-1',
      status: CommunityEventRsvpStatus.INTERESTED,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      updatedAt: new Date('2026-05-01T10:00:00.000Z'),
    });

    await communityEventRepository.upsertRsvp(
      'event-id-1',
      'user-id-1',
      CommunityEventRsvpStatus.INTERESTED,
    );

    expect(prisma.communityEventRsvp.upsert).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: 'event-id-1',
          userId: 'user-id-1',
        },
      },
      create: {
        eventId: 'event-id-1',
        userId: 'user-id-1',
        status: CommunityEventRsvpStatus.INTERESTED,
      },
      update: { status: CommunityEventRsvpStatus.INTERESTED },
    });
  });
});
