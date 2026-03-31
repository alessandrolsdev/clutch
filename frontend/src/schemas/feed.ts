import { z } from 'zod';

export const feedPostTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'ACHIEVEMENT',
  'GAME_SESSION',
]);

export const interactionTypeSchema = z.enum([
  'LIKE',
  'GG',
  'F',
  'CLAP',
  'HYPE',
]);

export const commentContentSchema = z
  .string()
  .trim()
  .min(1, 'Digite um comentario antes de enviar.')
  .max(300, 'O comentario aceita no maximo 300 caracteres.');

export const gameContextSchema = z.object({
  gameName: z.string().nullable(),
  platform: z.string().nullable(),
  capturedAt: z.string().min(1),
});

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
  gameContext: gameContextSchema.nullable(),
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

export const createPostCommentRequestSchema = z.object({
  postId: z.string().min(1),
  content: commentContentSchema,
  parentId: z.string().min(1).optional(),
});

export const createPostCommentResponseSchema = z.object({
  id: z.string().min(1),
  postId: z.string().min(1),
  userId: z.string().min(1),
  parentId: z.string().nullable(),
  content: z.string().min(1),
  createdAt: z.string().min(1),
});

export const postCommentReplySchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  parentId: z.string().nullable(),
  createdAt: z.string().min(1),
  author: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    profile: z
      .object({
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
  }),
  replies: z.array(z.never()),
});

export const postCommentSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  parentId: z.string().nullable(),
  createdAt: z.string().min(1),
  author: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    profile: z
      .object({
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
  }),
  replies: z.array(postCommentReplySchema),
});

export const postCommentsResponseSchema = z.array(postCommentSchema);

export const toggleInteractionRequestSchema = z.object({
  type: interactionTypeSchema,
});

export const toggleInteractionResponseSchema = z.object({
  added: z.boolean(),
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

export const deletePostResponseSchema = z.object({
  message: z.string().min(1),
});

export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type FeedGameContext = z.infer<typeof gameContextSchema>;
export type InteractionType = z.infer<typeof interactionTypeSchema>;
export type CreatePostCommentRequest = z.infer<typeof createPostCommentRequestSchema>;
export type CreatePostCommentResponse = z.infer<typeof createPostCommentResponseSchema>;
export type PostComment = z.infer<typeof postCommentSchema>;
export type ToggleInteractionRequest = z.infer<typeof toggleInteractionRequestSchema>;
export type ToggleInteractionResponse = z.infer<typeof toggleInteractionResponseSchema>;
