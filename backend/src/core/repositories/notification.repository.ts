import { Notification } from '@prisma/client';
import { prisma } from '../../infra/database/client';

// ─────────────────────────────────────────────────────────────
// Notification Repository
// ─────────────────────────────────────────────────────────────

export interface NotificationPage {
  notifications: Notification[];
  unreadCount:   number;
}

export const notificationRepository = {

  async findByUserId(
    userId:     string,
    unreadOnly  = false,
  ): Promise<NotificationPage> {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  },

  async findById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({ where: { id } });
  },

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data:  { isRead: true },
    });
  },

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
  },

  async create(data: {
    userId:   string;
    actorId?: string | null;
    type:     string;
    payload:  Record<string, unknown>;
  }): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId:   data.userId,
        actorId:  data.actorId ?? null,
        type:     data.type as never,
        payload:  JSON.parse(JSON.stringify(data.payload)),
      },
    });
  },

};
