import { z } from 'zod';

export const feedPostTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'ACHIEVEMENT',
  'GAME_SESSION',
]);

export const feedPostSchema = z.object({
  id: z.string().min(1),
  contentText: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  type: feedPostTypeSchema,
  gameContext: z
    .object({
      gameName: z.string().nullable(),
      platform: z.string().nullable(),
      capturedAt: z.string().min(1),
    })
    .nullable(),
  createdAt: z.string().min(1),
  author: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    profile: z
      .object({
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        accentColor: z.string().nullable(),
      })
      .nullable(),
  }),
  _count: z.object({
    interactions: z.number(),
    comments: z.number(),
  }),
});

export const feedResponseSchema = z.object({
  posts: z.array(feedPostSchema),
  nextCursor: z.string().nullable(),
});

export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
