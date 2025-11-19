import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function interactionsRoutes(app: FastifyInstance) {
  app.post('/posts/:id/respect', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({ userId: z.string().uuid() });

    const { id: postId } = paramsSchema.parse(request.params);
    const { userId } = bodySchema.parse(request.body);

    const existingInteraction = await prisma.interaction.findUnique({
      where: { userId_postId_type: { userId, postId, type: 'GG' } }
    });

    if (existingInteraction) {
      await prisma.interaction.delete({ where: { id: existingInteraction.id } });
      return { status: 'removed' };
    } else {
      await prisma.interaction.create({
        data: { userId, postId, type: 'GG' }
      });
      return { status: 'added' };
    }
  });
}