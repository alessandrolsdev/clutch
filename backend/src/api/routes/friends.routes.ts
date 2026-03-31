import { FastifyInstance } from 'fastify';
import { friendRepository } from '@/core/repositories/friend.repository';
import { notificationService } from '@/core/services/notification.service';
import { userRepository }   from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Friends Routes — todas as rotas protegidas por JWT
// ─────────────────────────────────────────────────────────────

const PRESENCE_ORDER: Record<string, number> = {
  IN_GAME: 0, ONLINE: 1, AFK: 2, OFFLINE: 3,
};

export async function friendRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /friends/request/:targetId ─────────────────────
  app.post<{ Params: { targetId: string } }>(
    '/request/:targetId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { targetId } = request.params;

      if (request.userId === targetId) {
        return reply.status(400).send({ message: 'Você não pode enviar um pedido para si mesmo.' });
      }

      const target = await userRepository.findById(targetId);
      if (!target) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      const [alreadyFriends, alreadyRequested] = await Promise.all([
        friendRepository.existsFriendship(request.userId, targetId),
        friendRepository.existsRequest(request.userId, targetId),
      ]);

      if (alreadyFriends || alreadyRequested) {
        return reply.status(409).send({ message: 'Pedido já existe ou vocês já são amigos.' });
      }

      const friendRequest = await friendRepository.createRequest(request.userId, targetId);
      await notificationService.create({
        userId:  targetId,
        actorId: request.userId,
        type:    'FRIEND_REQUEST',
        payload: {
          requestId: friendRequest.id,
          senderId:  request.userId,
        },
      });

      return reply.status(201).send({ id: friendRequest.id, status: friendRequest.status });
    },
  );

  // ── POST /friends/accept/:requestId ─────────────────────
  app.post<{ Params: { requestId: string } }>(
    '/accept/:requestId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const friendRequest = await friendRepository.findRequestById(request.params.requestId);
      if (!friendRequest) return reply.status(404).send({ message: 'Pedido não encontrado.' });

      if (friendRequest.receiverId !== request.userId) {
        return reply.status(403).send({ message: 'Você não tem permissão para aceitar este pedido.' });
      }

      if (friendRequest.status !== 'PENDING') {
        return reply.status(409).send({ message: 'Este pedido não está mais pendente.' });
      }

      await friendRepository.acceptRequest(
        request.params.requestId,
        friendRequest.senderId,
        friendRequest.receiverId,
      );
      await notificationService.create({
        userId:  friendRequest.senderId,
        actorId: request.userId,
        type:    'FRIEND_ACCEPTED',
        payload: {
          requestId: request.params.requestId,
          friendId:  request.userId,
        },
      });

      return reply.status(200).send({ message: 'Amizade confirmada.' });
    },
  );

  // ── DELETE /friends/:friendId ────────────────────────────
  app.delete<{ Params: { friendId: string } }>(
    '/:friendId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const exists = await friendRepository.existsFriendship(request.userId, request.params.friendId);
      if (!exists) return reply.status(404).send({ message: 'Amizade não encontrada.' });

      await friendRepository.removeFriendship(request.userId, request.params.friendId);
      return reply.status(200).send({ message: 'Amizade removida.' });
    },
  );

  // ── GET /friends/requests/:userId ────────────────────────
  app.get<{ Params: { userId: string } }>(
    '/requests/:userId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (request.userId !== request.params.userId) {
        return reply.status(403).send({ message: 'Você não pode ver pedidos de outro usuário.' });
      }

      const requests = await friendRepository.findPendingRequests(request.params.userId);
      return reply.status(200).send(requests);
    },
  );

  // ── GET /friends/:userId ─────────────────────────────────
  app.get<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const user = await userRepository.findById(request.params.userId);
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      const friends = await friendRepository.findFriendsByUserId(request.params.userId);
      const sorted  = friends.sort((a, b) => {
        const sA = PRESENCE_ORDER[a.presence?.status ?? 'OFFLINE'] ?? 3;
        const sB = PRESENCE_ORDER[b.presence?.status ?? 'OFFLINE'] ?? 3;
        return sA - sB;
      });

      return reply.status(200).send(sorted);
    },
  );

}
