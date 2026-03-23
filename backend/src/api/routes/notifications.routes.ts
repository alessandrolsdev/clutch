import { FastifyInstance } from 'fastify';
import { notificationRepository } from '@/core/repositories/notification.repository';

// ─────────────────────────────────────────────────────────────
// Notifications Routes
// GET   /notifications/:userId
// PATCH /notifications/:id/read
// PATCH /notifications/read-all
// ─────────────────────────────────────────────────────────────

export async function notificationRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /notifications/:userId ───────────────────────────
  app.get<{
    Params:      { userId: string };
    Querystring: { unreadOnly?: string };
  }>(
    '/:userId',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const { userId } = request.params;

      if (requesterId !== userId) {
        return reply.status(403).send({
          message: 'Você não pode ver notificações de outro usuário.',
        });
      }

      const unreadOnly = request.query.unreadOnly === 'true';
      const result     = await notificationRepository.findByUserId(userId, unreadOnly);

      return reply.status(200).send(result);
    },
  );

  // ── PATCH /notifications/read-all ────────────────────────
  // Deve vir ANTES de /:id para não ser capturado como parâmetro
  app.patch(
    '/read-all',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      await notificationRepository.markAllAsRead(userId);

      return reply.status(200).send({ message: 'Todas as notificações marcadas como lidas.' });
    },
  );

  // ── PATCH /notifications/:id/read ────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/read',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const notification = await notificationRepository.findById(request.params.id);

      if (!notification) {
        return reply.status(404).send({ message: 'Notificação não encontrada.' });
      }

      if (notification.userId !== requesterId) {
        return reply.status(403).send({ message: 'Não autorizado.' });
      }

      const updated = await notificationRepository.markAsRead(request.params.id);

      return reply.status(200).send(updated);
    },
  );

}