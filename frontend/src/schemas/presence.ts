import { z } from 'zod';

export const presenceStatusSchema = z.enum([
  'ONLINE',
  'IN_GAME',
  'AFK',
  'OFFLINE',
]);

export const presenceCredentialResponseSchema = z.object({
  token: z.string().min(1),
});

export const friendPresenceEventPayloadSchema = z.object({
  userId: z.string().min(1),
  status: presenceStatusSchema,
  currentGame: z.string().nullable(),
  platform: z.string().nullable(),
});

export const friendPresenceSocketEventSchema = z.object({
  event: z.literal('FRIEND_PRESENCE'),
  payload: friendPresenceEventPayloadSchema,
  ts: z.number(),
});

export const presencePongSocketEventSchema = z.object({
  event: z.literal('PONG'),
  payload: z.nullable(z.unknown()),
  ts: z.number(),
});

export const presenceSocketEventSchema = z.union([
  friendPresenceSocketEventSchema,
  presencePongSocketEventSchema,
]);

export type PresenceStatus = z.infer<typeof presenceStatusSchema>;
export type PresenceCredentialResponse = z.infer<
  typeof presenceCredentialResponseSchema
>;
export type FriendPresenceEventPayload = z.infer<
  typeof friendPresenceEventPayloadSchema
>;
export type FriendPresenceSocketEvent = z.infer<
  typeof friendPresenceSocketEventSchema
>;
export type PresencePongSocketEvent = z.infer<
  typeof presencePongSocketEventSchema
>;
export type PresenceSocketEvent = z.infer<typeof presenceSocketEventSchema>;
