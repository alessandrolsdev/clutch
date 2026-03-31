import { z } from 'zod';

export const friendPresenceStatusSchema = z.enum([
  'IN_GAME',
  'ONLINE',
  'AFK',
  'OFFLINE',
]);

export const friendSummarySchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  profile: z
    .object({
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      accentColor: z.string().nullable(),
    })
    .nullable(),
  presence: z
    .object({
      status: friendPresenceStatusSchema,
      currentGame: z.string().nullable(),
      platform: z.string().nullable(),
    })
    .nullable(),
});

export const friendsResponseSchema = z.array(friendSummarySchema);

export const pendingFriendRequestSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  sender: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    profile: z
      .object({
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const pendingFriendRequestsResponseSchema = z.array(
  pendingFriendRequestSchema,
);

export const createFriendRequestResponseSchema = z.object({
  id: z.string().min(1),
  status: z.literal('PENDING'),
});

export const friendActionResponseSchema = z.object({
  message: z.string().min(1),
});

export type FriendSummary = z.infer<typeof friendSummarySchema>;
export type PendingFriendRequest = z.infer<typeof pendingFriendRequestSchema>;
export type FriendPresenceStatus = z.infer<typeof friendPresenceStatusSchema>;
export type CreateFriendRequestResponse = z.infer<
  typeof createFriendRequestResponseSchema
>;
