import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { socialContinuityService } from '@/core/services/social-continuity.service';

vi.mock('@/core/repositories/friend.repository', () => ({
  friendRepository: {
    findFriendsByUserId: vi.fn(),
  },
}));

vi.mock('@/infra/database/client', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
    },
  },
}));

import { friendRepository } from '@/core/repositories/friend.repository';
import { prisma } from '@/infra/database/client';

describe('socialContinuityService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deriva streak atual e ofensiva ativa a partir de posts e comentarios reais', async () => {
    vi.mocked(friendRepository.findFriendsByUserId).mockResolvedValue([
      {
        id: 'friend-1',
        username: 'duoqueue',
        profile: null,
        presence: null,
      },
      {
        id: 'friend-2',
        username: 'latejoin',
        profile: null,
        presence: null,
      },
    ]);

    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { userId: 'user-1', createdAt: new Date('2026-04-22T10:00:00.000Z') },
      { userId: 'user-1', createdAt: new Date('2026-04-21T10:00:00.000Z') },
      { userId: 'friend-1', createdAt: new Date('2026-04-22T09:00:00.000Z') },
      { userId: 'friend-1', createdAt: new Date('2026-04-21T09:00:00.000Z') },
      { userId: 'friend-2', createdAt: new Date('2026-04-20T09:00:00.000Z') },
    ] as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { userId: 'user-1', createdAt: new Date('2026-04-20T11:00:00.000Z') },
      { userId: 'friend-2', createdAt: new Date('2026-04-21T11:00:00.000Z') },
    ] as never);

    const summary = await socialContinuityService.summarizeUser('user-1');

    expect(summary).toEqual({
      currentStreakDays: 3,
      activeFriendOffensiveCount: 2,
      strongestFriendOffensive: {
        friendId: 'friend-1',
        friendUsername: 'duoqueue',
        days: 2,
        lastQualifiedAt: '2026-04-22T00:00:00.000Z',
      },
    });
  });

  it('zera o resumo quando a atividade mais recente ficou mais antiga que ontem em UTC', async () => {
    vi.mocked(friendRepository.findFriendsByUserId).mockResolvedValue([
      {
        id: 'friend-1',
        username: 'duoqueue',
        profile: null,
        presence: null,
      },
    ]);

    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { userId: 'user-1', createdAt: new Date('2026-04-19T10:00:00.000Z') },
      { userId: 'friend-1', createdAt: new Date('2026-04-19T09:00:00.000Z') },
    ] as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);

    const summary = await socialContinuityService.summarizeUser('user-1');

    expect(summary).toEqual({
      currentStreakDays: 0,
      activeFriendOffensiveCount: 0,
      strongestFriendOffensive: null,
    });
  });
});
