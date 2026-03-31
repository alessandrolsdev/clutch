import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'POST_LIKE',
  'POST_COMMENT',
  'GAME_INVITE',
  'FRIEND_NOW_PLAYING',
  'SYSTEM',
]);

export const friendRequestNotificationPayloadSchema = z.object({
  requestId: z.string().min(1),
  senderId: z.string().min(1),
});

export const friendAcceptedNotificationPayloadSchema = z.object({
  requestId: z.string().min(1),
  friendId: z.string().min(1),
});

export const postLikeNotificationPayloadSchema = z.object({
  postId: z.string().min(1),
  interactionType: z.enum(['LIKE', 'GG', 'F', 'CLAP', 'HYPE']),
});

export const postCommentNotificationPayloadSchema = z.object({
  postId: z.string().min(1),
  commentId: z.string().min(1),
  parentId: z.string().nullable(),
});

export const notificationRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  actorId: z.string().nullable(),
  type: notificationTypeSchema,
  payload: z.record(z.unknown()),
  isRead: z.boolean(),
  createdAt: z.string().min(1),
});

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationRecordSchema),
  unreadCount: z.number().int().min(0),
});

export const markAllNotificationsReadResponseSchema = z.object({
  message: z.string().min(1),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationRecord = z.infer<typeof notificationRecordSchema>;
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
