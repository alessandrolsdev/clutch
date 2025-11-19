import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function postsRoutes(app: FastifyInstance) {

  // 1. CRIAR UM POST
  app.post('/posts', async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
      content: z.string().min(1).max(280),
      type: z.enum(['TEXT', 'IMAGE', 'VIDEO']).default('TEXT')
    });

    const { userId, content, type } = bodySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ message: 'Usuário inválido.' });

    const post = await prisma.post.create({
      data: { userId, contentText: content, type }
    });

    // XP +10
    await prisma.$transaction([
        prisma.userStats.update({
            where: { userId },
            data: { currentXp: { increment: 10 } }
        }),
        prisma.xpLog.create({
            data: { userId, actionType: 'POST_CREATED', xpAmount: 10 }
        })
    ]);

    return reply.status(201).send(post);
  });

  // 2. LISTAR POSTS (COM CONTAGEM DE LIKES)
  app.get('/posts', async (request, reply) => {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } }
          }
        },
        // --- NOVO: Traz a contagem de interações (likes) ---
        _count: {
          select: { interactions: true }
        },
        // --- NOVO: Traz a lista de quem curtiu (para sabermos se NÓS curtimos) ---
        interactions: {
            select: { userId: true }
        }
      }
    });

    return posts;
  });

}