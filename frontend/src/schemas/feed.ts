import { z } from 'zod';

export const feedPostTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'ACHIEVEMENT',
  'GAME_SESSION',
]);

export const createPostRequestSchema = z
  .object({
    contentText: z.string().trim().max(500, 'O post aceita no maximo 500 caracteres.'),
    mediaUrl: z
      .string()
      .trim()
      .url('Digite uma URL de midia valida.')
      .or(z.literal('')),
    type: feedPostTypeSchema,
  })
  .superRefine((value, context) => {
    const hasText = value.contentText.trim().length > 0;
    const hasMedia = value.mediaUrl.trim().length > 0;

    if (!hasText && !hasMedia) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Adicione texto ou uma URL de midia para publicar.',
        path: ['contentText'],
      });
    }
  });

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

export const createPostResponseSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  contentText: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  type: feedPostTypeSchema,
  gameContext: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().min(1),
});

export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
