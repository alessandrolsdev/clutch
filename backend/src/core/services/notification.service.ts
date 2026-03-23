import { notificationRepository } from '@/core/repositories/notification.repository';
import { redis } from '@/infra/cache/redis';

// ─────────────────────────────────────────────────────────────
// Notification Service
// Salva no Postgres + publica no Redis para entrega em tempo real
// ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'GAME_INVITE'
  | 'FRIEND_NOW_PLAYING'
  | 'SYSTEM';

export interface CreateNotificationInput {
  userId:   string;
  actorId?: string | null;
  type:     NotificationType;
  payload:  Record<string, unknown>;
}

export const notificationService = {

  async create(input: CreateNotificationInput): Promise<void> {
    // ── Salva no Postgres ──────────────────────────────────
    const notification = await notificationRepository.create({
      userId:  input.userId,
      actorId: input.actorId ?? null,
      type:    input.type,
      payload: input.payload,
    });

    // ── Publica no Redis → Go service entrega via WebSocket ─
    await redis.publish(
      `notifications:${input.userId}`,
      JSON.stringify({
        id:        notification.id,
        type:      notification.type,
        payload:   notification.payload,
        actorId:   notification.actorId,
        isRead:    notification.isRead,
        createdAt: notification.createdAt,
      }),
    ).catch((err: unknown) => {
      // Redis offline não deve derrubar o servidor
      console.warn('[notifications] Redis publish failed:', err);
    });
  },

};