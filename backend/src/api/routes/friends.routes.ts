import { FastifyInstance } from 'fastify';
import { friendRepository } from '@/core/repositories/friend.repository';
import { userRepository }   from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Friends Routes
// POST   /friends/request/:targetId
// POST   /friends/accept/:requestId
// DELETE /friends/:friendId
// GET    /friends/:userId
// GET    /friends/requests/:userId
// ─────────────────────────────────────────────────────────────

const PRESENCE_ORDER: Record<string, number> = {
  IN_GAME: 0,
  ONLINE:  1,
  AFK:     2,
  OFFLINE: 3,
};

export async function friendRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /friends/request/:targetId ─────────────────────
  app.post<{ Params: { targetId: string } }>(
    '/request/:targetId',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const { targetId } = request.params;

      if (requesterId === targetId) {
        return reply.status(400).send({
          message: 'Você não pode enviar um pedido de amizade para si mesmo.',
        });
      }

      const target = await userRepository.findById(targetId);
      if (!target) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' });
      }

      const [alreadyFriends, alreadyRequested] = await Promise.all([
        friendRepository.existsFriendship(requesterId, targetId),
        friendRepository.existsRequest(requesterId, targetId),
      ]);

      if (alreadyFriends || alreadyRequested) {
        return reply.status(409).send({
          message: 'Pedido já existe ou vocês já são amigos.',
        });
      }

      const friendRequest = await friendRepository.createRequest(requesterId, targetId);

      return reply.status(201).send({
        id:     friendRequest.id,
        status: friendRequest.status,
      });
    },
  );

  // ── POST /friends/accept/:requestId ─────────────────────
  app.post<{ Params: { requestId: string } }>(
    '/accept/:requestId',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const { requestId } = request.params;

      const friendRequest = await friendRepository.findRequestById(requestId);

      if (!friendRequest) {
        return reply.status(404).send({ message: 'Pedido não encontrado.' });
      }

      if (friendRequest.receiverId !== requesterId) {
        return reply.status(403).send({
          message: 'Você não tem permissão para aceitar este pedido.',
        });
      }

      if (friendRequest.status !== 'PENDING') {
        return reply.status(409).send({
          message: 'Este pedido não está mais pendente.',
        });
      }

      await friendRepository.acceptRequest(
        requestId,
        friendRequest.senderId,
        friendRequest.receiverId,
      );

      return reply.status(200).send({ message: 'Amizade confirmada.' });
    },
  );

  // ── DELETE /friends/:friendId ────────────────────────────
  app.delete<{ Params: { friendId: string } }>(
    '/:friendId',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const { friendId } = request.params;

      const exists = await friendRepository.existsFriendship(requesterId, friendId);
      if (!exists) {
        return reply.status(404).send({ message: 'Amizade não encontrada.' });
      }

      await friendRepository.removeFriendship(requesterId, friendId);

      return reply.status(200).send({ message: 'Amizade removida.' });
    },
  );

  // ── GET /friends/requests/:userId ────────────────────────
  // Deve vir ANTES de /:userId para não ser capturado como parâmetro
  app.get<{ Params: { userId: string } }>(
    '/requests/:userId',
    async (request, reply) => {
      const requesterId = request.headers['x-user-id'] as string | undefined;
      if (!requesterId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const { userId } = request.params;

      if (requesterId !== userId) {
        return reply.status(403).send({
          message: 'Você não pode ver pedidos de outro usuário.',
        });
      }

      const requests = await friendRepository.findPendingRequests(userId);

      return reply.status(200).send(requests);
    },
  );

  // ── GET /friends/:userId ─────────────────────────────────
  app.get<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const user = await userRepository.findById(request.params.userId);
      if (!user) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' });
      }

      const friends = await friendRepository.findFriendsByUserId(request.params.userId);

      const sorted = friends.sort((a, b) => {
        const statusA = PRESENCE_ORDER[a.presence?.status ?? 'OFFLINE'] ?? 3;
        const statusB = PRESENCE_ORDER[b.presence?.status ?? 'OFFLINE'] ?? 3;
        return statusA - statusB;
      });

      return reply.status(200).send(sorted);
    },
  );

}