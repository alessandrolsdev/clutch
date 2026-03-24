import { FastifyInstance } from 'fastify';
import { notificationRepository } from '@/core/repositories/notification.repository';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /notifications/:userId ───────────────────────────
  app.get<{ Params: { userId: string }; Querystring: { unreadOnly?: string } }>(
    '/:userId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (request.userId !== request.params.userId) {
        return reply.status(403).send({ message: 'Você não pode ver notificações de outro usuário.' });
      }

      const unreadOnly = request.query.unreadOnly === 'true';
      const result     = await notificationRepository.findByUserId(request.params.userId, unreadOnly);
      return reply.status(200).send(result);
    },
  );

  // ── PATCH /notifications/read-all ────────────────────────
  app.patch(
    '/read-all',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      await notificationRepository.markAllAsRead(request.userId);
      return reply.status(200).send({ message: 'Todas as notificações marcadas como lidas.' });
    },
  );

  // ── PATCH /notifications/:id/read ────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id/read',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const notification = await notificationRepository.findById(request.params.id);
      if (!notification) return reply.status(404).send({ message: 'Notificação não encontrada.' });

      if (notification.userId !== request.userId) {
        return reply.status(403).send({ message: 'Não autorizado.' });
      }

      const updated = await notificationRepository.markAsRead(request.params.id);
      return reply.status(200).send(updated);
    },
  );

}