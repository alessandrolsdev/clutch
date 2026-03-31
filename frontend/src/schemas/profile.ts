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
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfilePresenceStatus = z.infer<typeof profilePresenceStatusSchema>;
