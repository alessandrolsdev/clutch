import { z } from 'zod';

export const profilePresenceStatusSchema = z.enum([
  'ONLINE',
  'IN_GAME',
  'AFK',
  'OFFLINE',
]);

export const profileIntegrationPlatformSchema = z.enum([
  'STEAM',
  'EPIC',
  'DISCORD',
  'XBOX',
  'PSN',
  'RIOT',
  'ANILIST',
  'MYANIMELIST',
]);

export const strongestFriendOffensiveSchema = z.object({
  friendId: z.string().min(1),
  friendUsername: z.string().min(1),
  days: z.number().int().min(0),
  lastQualifiedAt: z.string().min(1),
});

export const socialContinuitySchema = z.object({
  currentStreakDays: z.number().int().min(0),
  activeFriendOffensiveCount: z.number().int().min(0),
  strongestFriendOffensive: strongestFriendOffensiveSchema.nullable(),
});

export const otakuShowcaseItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['ANIME', 'MANGA']),
  title: z.string().min(1),
  coverUrl: z.string().nullable(),
});

export const otakuShowcaseSchema = z
  .object({
    featured: z.array(otakuShowcaseItemSchema),
    consumingNow: z.array(otakuShowcaseItemSchema),
    consumingCount: z.number().int().min(0),
    completedCount: z.number().int().min(0),
  })
  .nullable();

export const profileResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  createdAt: z.string().min(1),
  profile: z.object({
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    accentColor: z.string().nullable(),
    badges: z.array(z.string()),
  }),
  stats: z.object({
    level: z.number(),
    xp: z.number(),
    reputation: z.number(),
    friendCount: z.number(),
    postCount: z.number(),
  }),
  presence: z.object({
    status: profilePresenceStatusSchema,
    currentGame: z.string().nullable(),
    gameDetails: z.record(z.unknown()).nullable(),
    platform: z.string().nullable(),
    updatedAt: z.string().min(1),
  }),
  platformIntegrations: z.array(
    z.object({
      platform: profileIntegrationPlatformSchema,
      metadata: z.record(z.unknown()).nullable(),
    }),
  ),
  gameLibrary: z.array(
    z.object({
      gameName: z.string().min(1),
      coverUrl: z.string().nullable(),
      platform: z.string().min(1),
      hoursPlayed: z.number().nullable(),
      lastPlayedAt: z.string().nullable(),
    }),
  ),
  socialContinuity: socialContinuitySchema,
  otakuShowcase: otakuShowcaseSchema,
});

export const profileUpdateRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'O display name precisa ter pelo menos 1 caractere.')
    .max(50, 'O display name aceita no maximo 50 caracteres.'),
  bio: z
    .string()
    .trim()
    .max(300, 'A bio aceita no maximo 300 caracteres.'),
  avatarUrl: z
    .string()
    .trim()
    .url('Digite uma URL de avatar valida.')
    .or(z.literal('')),
  bannerUrl: z
    .string()
    .trim()
    .url('Digite uma URL de banner valida.')
    .or(z.literal('')),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Use uma cor hex valida, como #7C3AED.'),
});

export const profileUpdateResponseSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  badges: z.array(z.string()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfilePresenceStatus = z.infer<typeof profilePresenceStatusSchema>;
export type ProfileUpdateValues = z.infer<typeof profileUpdateRequestSchema>;
export type ProfileUpdateResponse = z.infer<typeof profileUpdateResponseSchema>;
