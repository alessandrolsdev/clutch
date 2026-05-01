import {
  ArenaChallengeStatus,
  ArenaProofType,
  PostType,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../infra/database/client';

const arenaChallengeSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  status: true,
  ruleType: true,
  scoreValue: true,
  maxSubmissionsPerUser: true,
  createdAt: true,
  updatedAt: true,
  participations: {
    select: {
      userId: true,
      joinedAt: true,
    },
  },
  _count: {
    select: {
      participations: true,
      submissions: true,
    },
  },
} satisfies Prisma.ArenaChallengeSelect;

type ArenaChallengeRecord = Prisma.ArenaChallengeGetPayload<{
  select: typeof arenaChallengeSelect;
}>;

export type ArenaChallengeSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  status: ArenaChallengeStatus;
  ruleType: ArenaProofType;
  scoreValue: number;
  maxSubmissionsPerUser: number;
  participantCount: number;
  submissionCount: number;
  viewerHasJoined: boolean;
  viewerJoinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ArenaParticipationRecord = {
  id: string;
  challengeId: string;
  userId: string;
  joinedAt: Date;
};

export type ArenaProofPost = {
  id: string;
  userId: string;
  type: PostType;
  createdAt: Date;
  contentText: string | null;
};

export type ArenaSubmissionSummary = {
  id: string;
  challengeId: string;
  userId: string;
  proofType: ArenaProofType;
  proofId: string;
  score: number;
  submittedAt: Date;
};

export type ArenaLeaderboardEntry = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  score: number;
  submissionsCount: number;
  lastSubmissionAt: Date;
};

function toChallengeSummary(
  challenge: ArenaChallengeRecord,
  viewerUserId?: string | null,
): ArenaChallengeSummary {
  const viewerParticipation = viewerUserId
    ? challenge.participations.find((participation) => participation.userId === viewerUserId)
    : undefined;

  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    description: challenge.description,
    startsAt: challenge.startsAt,
    endsAt: challenge.endsAt,
    status: challenge.status,
    ruleType: challenge.ruleType,
    scoreValue: challenge.scoreValue,
    maxSubmissionsPerUser: challenge.maxSubmissionsPerUser,
    participantCount: challenge._count.participations,
    submissionCount: challenge._count.submissions,
    viewerHasJoined: Boolean(viewerParticipation),
    viewerJoinedAt: viewerParticipation?.joinedAt ?? null,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
  };
}

export const arenaRepository = {
  async listActiveChallenges(
    now: Date,
    viewerUserId?: string | null,
  ): Promise<ArenaChallengeSummary[]> {
    const challenges = await prisma.arenaChallenge.findMany({
      where: {
        status: ArenaChallengeStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [
        { endsAt: 'asc' },
        { startsAt: 'asc' },
      ],
      select: arenaChallengeSelect,
    });

    return challenges.map((challenge) => toChallengeSummary(challenge, viewerUserId));
  },

  async findChallengeBySlug(
    slug: string,
    viewerUserId?: string | null,
  ): Promise<ArenaChallengeSummary | null> {
    const challenge = await prisma.arenaChallenge.findUnique({
      where: { slug },
      select: arenaChallengeSelect,
    });

    return challenge ? toChallengeSummary(challenge, viewerUserId) : null;
  },

  async findChallengeById(
    challengeId: string,
    viewerUserId?: string | null,
  ): Promise<ArenaChallengeSummary | null> {
    const challenge = await prisma.arenaChallenge.findUnique({
      where: { id: challengeId },
      select: arenaChallengeSelect,
    });

    return challenge ? toChallengeSummary(challenge, viewerUserId) : null;
  },

  async upsertParticipation(
    challengeId: string,
    userId: string,
  ): Promise<ArenaParticipationRecord> {
    return prisma.arenaParticipation.upsert({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
      create: {
        challengeId,
        userId,
      },
      update: {},
    });
  },

  async findParticipation(
    challengeId: string,
    userId: string,
  ): Promise<ArenaParticipationRecord | null> {
    return prisma.arenaParticipation.findUnique({
      where: {
        challengeId_userId: {
          challengeId,
          userId,
        },
      },
    });
  },

  async findProofPost(proofId: string): Promise<ArenaProofPost | null> {
    return prisma.post.findUnique({
      where: { id: proofId },
      select: {
        id: true,
        userId: true,
        type: true,
        createdAt: true,
        contentText: true,
      },
    });
  },

  async countUserSubmissions(challengeId: string, userId: string): Promise<number> {
    return prisma.arenaSubmission.count({
      where: {
        challengeId,
        userId,
      },
    });
  },

  async findSubmissionByProof(
    challengeId: string,
    proofType: ArenaProofType,
    proofId: string,
  ): Promise<ArenaSubmissionSummary | null> {
    return prisma.arenaSubmission.findUnique({
      where: {
        challengeId_proofType_proofId: {
          challengeId,
          proofType,
          proofId,
        },
      },
    });
  },

  async createSubmission(input: {
    challengeId: string;
    participationId: string;
    userId: string;
    proofType: ArenaProofType;
    proofId: string;
    score: number;
  }): Promise<ArenaSubmissionSummary> {
    return prisma.arenaSubmission.create({
      data: input,
    });
  },

  async listLeaderboard(challengeId: string): Promise<ArenaLeaderboardEntry[]> {
    const submissions = await prisma.arenaSubmission.findMany({
      where: { challengeId },
      select: {
        userId: true,
        score: true,
        submittedAt: true,
        user: {
          select: {
            username: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    const entriesByUserId = new Map<string, Omit<ArenaLeaderboardEntry, 'position'>>();

    for (const submission of submissions) {
      const existing = entriesByUserId.get(submission.userId);

      if (!existing) {
        entriesByUserId.set(submission.userId, {
          userId: submission.userId,
          username: submission.user.username,
          displayName: submission.user.profile?.displayName ?? null,
          score: submission.score,
          submissionsCount: 1,
          lastSubmissionAt: submission.submittedAt,
        });
        continue;
      }

      existing.score += submission.score;
      existing.submissionsCount += 1;

      if (submission.submittedAt > existing.lastSubmissionAt) {
        existing.lastSubmissionAt = submission.submittedAt;
      }
    }

    return Array.from(entriesByUserId.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        const submittedAtDelta = left.lastSubmissionAt.getTime() - right.lastSubmissionAt.getTime();
        if (submittedAtDelta !== 0) {
          return submittedAtDelta;
        }

        return left.username.localeCompare(right.username);
      })
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
      }));
  },
};
