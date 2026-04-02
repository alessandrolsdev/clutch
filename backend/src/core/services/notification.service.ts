import { redis, REDIS_KEYS } from '../../infra/cache/redis';
import { writeBackendRuntimeLog } from '../../config/logging';
import { notificationRepository } from '../repositories/notification.repository';

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'GAME_INVITE'
  | 'FRIEND_NOW_PLAYING'
  | 'SYSTEM';

export interface CreateNotificationInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  payload: Record<string, unknown>;
}

export const notificationService = {
  async create(input: CreateNotificationInput): Promise<void> {
    const notification = await notificationRepository.create({
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      payload: input.payload,
    });

    await redis
      .publish(
        REDIS_KEYS.notifications(input.userId),
        JSON.stringify({
          id: notification.id,
          type: notification.type,
          payload: notification.payload,
          actorId: notification.actorId,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        }),
      )
      .catch((err: unknown) => {
        writeBackendRuntimeLog(
          'warn',
          'notification_redis_publish_failed',
          'Redis publish failed while broadcasting notification',
          {
            userId: input.userId,
            type: input.type,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        );
      });
  },
};
