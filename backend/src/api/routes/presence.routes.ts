import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { presenceRepository } from '@/core/repositories/presence.repository';
import { userRepository }     from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Presence Routes
// POST /presence
// GET  /presence/:userId
// ─────────────────────────────────────────────────────────────

const setPresenceSchema = z.object({
  status: z.enum(['ONLINE', 'IN_GAME', 'AFK', 'OFFLINE']),
  currentGame: z.string().max(100).nullable().optional(),
  gameDetails: z.record(z.unknown()).nullable().optional(),
  platform:    z.string().max(50).nullable().optional(),
});

export async function presenceRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /presence ───────────────────────────────────────
  app.post(
    '/',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) {
        return reply.status(401).send({ message: 'Não autorizado.' });
      }

      const result = setPresenceSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          message: result.error.errors[0]?.message ?? 'Dados inválidos.',
        });
      }

      await presenceRepository.set(userId, {
        status:      result.data.status,
        currentGame: result.data.currentGame,
        gameDetails: result.data.gameDetails as Record<string, unknown> | null | undefined,
        platform:    result.data.platform,
      });

      return reply.status(200).send({ message: 'Presença atualizada.' });
    },
  );

  // ── GET /presence/:userId ────────────────────────────────
  app.get<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const { userId } = request.params;

      const user = await userRepository.findById(userId);
      if (!user) {
        return reply.status(404).send({ message: 'Usuário não encontrado.' });
      }

      const presence = await presenceRepository.get(userId);

      return reply.status(200).send(presence);
    },
  );

}