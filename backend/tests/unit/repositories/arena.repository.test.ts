import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaChallengeStatus,
  ArenaProofType,
  PostType,
} from '@prisma/client';
import { arenaRepository } from '@/core/repositories/arena.repository';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    arenaChallenge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    arenaParticipation: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    arenaSubmission: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

const challengeRecord = {
  id: 'challenge-id-1',
  slug: 'semana-da-game-session',
  title: 'Semana da Game Session',
  description: 'Envie GAME_SESSION da semana.',
  startsAt: new Date('2026-05-01T00:00:00.000Z'),
  endsAt: new Date('2026-05-08T00:00:00.000Z'),
  status: ArenaChallengeStatus.ACTIVE,
  ruleType: ArenaProofType.GAME_SESSION,
  scoreValue: 10,
  maxSubmissionsPerUser: 3,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  participations: [
    {
      userId: 'user-id-1',
      joinedAt: new Date('2026-05-01T01:00:00.000Z'),
    },
  ],
  _count: {
    participations: 1,
    submissions: 0,
  },
};

describe('arenaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma));
  });

  it('lista desafios ativos e marca participacao do viewer', async () => {
    vi.mocked(prisma.arenaChallenge.findMany).mockResolvedValue([challengeRecord]);

    const result = await arenaRepository.listActiveChallenges(
      new Date('2026-05-02T00:00:00.000Z'),
      'user-id-1',
    );

    expect(result[0]).toMatchObject({
      slug: 'semana-da-game-session',
      participantCount: 1,
      viewerHasJoined: true,
    });
    expect(prisma.arenaChallenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ArenaChallengeStatus.ACTIVE,
          startsAt: { lte: new Date('2026-05-02T00:00:00.000Z') },
          endsAt: { gt: new Date('2026-05-02T00:00:00.000Z') },
        },
      }),
    );
  });

  it('busca post de prova por id sem reactions ou comments', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: 'post-id-1',
      userId: 'user-id-1',
      type: PostType.GAME_SESSION,
      createdAt: new Date('2026-05-02T10:00:00.000Z'),
      contentText: 'Ranked com squad fechado.',
    } as never);

    const result = await arenaRepository.findProofPost('post-id-1');

    expect(result?.type).toBe(PostType.GAME_SESSION);
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: 'post-id-1' },
      select: {
        id: true,
        userId: true,
        type: true,
        createdAt: true,
        contentText: true,
      },
    });
  });

  it('ordena ranking local por score, data e username', async () => {
    vi.mocked(prisma.arenaSubmission.findMany).mockResolvedValue([
      {
        userId: 'user-id-2',
        score: 10,
        submittedAt: new Date('2026-05-02T12:00:00.000Z'),
        user: {
          username: 'bravo',
          profile: { displayName: 'Bravo' },
        },
      },
      {
        userId: 'user-id-1',
        score: 10,
        submittedAt: new Date('2026-05-02T10:00:00.000Z'),
        user: {
          username: 'alpha',
          profile: { displayName: 'Alpha' },
        },
      },
      {
        userId: 'user-id-2',
        score: 10,
        submittedAt: new Date('2026-05-02T13:00:00.000Z'),
        user: {
          username: 'bravo',
          profile: { displayName: 'Bravo' },
        },
      },
    ] as never);

    const result = await arenaRepository.listLeaderboard('challenge-id-1');

    expect(result).toEqual([
      expect.objectContaining({
        position: 1,
        userId: 'user-id-2',
        score: 20,
        submissionsCount: 2,
      }),
      expect.objectContaining({
        position: 2,
        userId: 'user-id-1',
        score: 10,
        submissionsCount: 1,
      }),
    ]);
  });

  it('cria submissao dentro de transacao serializavel respeitando cap', async () => {
    vi.mocked(prisma.arenaSubmission.count).mockResolvedValue(2);
    vi.mocked(prisma.arenaSubmission.create).mockResolvedValue({
      id: 'submission-id-1',
      challengeId: 'challenge-id-1',
      participationId: 'participation-id-1',
      userId: 'user-id-1',
      proofType: ArenaProofType.GAME_SESSION,
      proofId: 'post-id-1',
      score: 10,
      submittedAt: new Date('2026-05-02T12:00:00.000Z'),
    } as never);

    const result = await arenaRepository.createSubmissionWithinCap({
      challengeId: 'challenge-id-1',
      participationId: 'participation-id-1',
      userId: 'user-id-1',
      proofType: ArenaProofType.GAME_SESSION,
      proofId: 'post-id-1',
      score: 10,
      maxSubmissionsPerUser: 3,
    });

    expect(result.id).toBe('submission-id-1');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(prisma.arenaSubmission.create).toHaveBeenCalledWith({
      data: {
        challengeId: 'challenge-id-1',
        participationId: 'participation-id-1',
        userId: 'user-id-1',
        proofType: ArenaProofType.GAME_SESSION,
        proofId: 'post-id-1',
        score: 10,
      },
    });
  });
});
