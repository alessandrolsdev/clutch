import { z } from 'zod';

export const arenaChallengeStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']);
export const arenaProofTypeSchema = z.enum(['GAME_SESSION', 'ACHIEVEMENT', 'COMMUNITY_EVENT_RSVP']);

export const arenaChallengeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: arenaChallengeStatusSchema,
  ruleType: arenaProofTypeSchema,
  scoreValue: z.number().int().nonnegative(),
  maxSubmissionsPerUser: z.number().int().positive(),
  participantCount: z.number().int().nonnegative(),
  submissionCount: z.number().int().nonnegative(),
  viewerHasJoined: z.boolean(),
  viewerJoinedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const arenaSubmissionSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  userId: z.string(),
  proofType: arenaProofTypeSchema,
  proofId: z.string(),
  score: z.number().int().nonnegative(),
  submittedAt: z.string(),
});

export const arenaLeaderboardEntrySchema = z.object({
  position: z.number().int().positive(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  score: z.number().int().nonnegative(),
  submissionsCount: z.number().int().nonnegative(),
  lastSubmissionAt: z.string(),
});

export const arenaChallengesResponseSchema = z.object({
  challenges: z.array(arenaChallengeSchema),
});

export const arenaChallengeResponseSchema = z.object({
  challenge: arenaChallengeSchema,
});

export const arenaSubmissionResponseSchema = z.object({
  submission: arenaSubmissionSchema,
});

export const arenaLeaderboardResponseSchema = z.object({
  leaderboard: z.array(arenaLeaderboardEntrySchema),
});

export const submitArenaProofRequestSchema = z.object({
  proofType: z.enum(['GAME_SESSION', 'ACHIEVEMENT']),
  proofId: z.string().trim().min(1),
});

export type ArenaChallenge = z.infer<typeof arenaChallengeSchema>;
export type ArenaProofType = z.infer<typeof arenaProofTypeSchema>;
export type ArenaSubmission = z.infer<typeof arenaSubmissionSchema>;
export type ArenaLeaderboardEntry = z.infer<typeof arenaLeaderboardEntrySchema>;
export type SubmitArenaProofValues = z.infer<typeof submitArenaProofRequestSchema>;
