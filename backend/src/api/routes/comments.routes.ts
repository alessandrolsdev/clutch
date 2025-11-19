import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function commentsRoutes(app: FastifyInstance) {

  // 1. CRIAR COMENTÁRIO (POST /posts/:id/comments)
  app.post('/posts/:id/comments', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      userId: z.string().uuid(),
      content: z.string().min(1).max(500)
    });

    const { id: postId } = paramsSchema.parse(request.params);
    const { userId, content } = bodySchema.parse(request.body);

    const comment = await prisma.comment.create({
      data: { userId, postId, content }
    });

    // Retorna o comentário já com os dados do autor para exibir na hora
    const commentWithUser = await prisma.comment.findUnique({
        where: { id: comment.id },
        include: {
            user: {
                select: {
                    username: true,
                    profile: { select: { displayName: true, avatarUrl: true } }
                }
            }
        }
    });

    return reply.status(201).send(commentWithUser);
  });

  // 2. LISTAR COMENTÁRIOS (GET /posts/:id/comments)
  app.get('/posts/:id/comments', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id: postId } = paramsSchema.parse(request.params);

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' }, // Do mais antigo para o novo (timeline de conversa)
      include: {
        user: {
            select: {
                username: true,
                profile: { select: { displayName: true, avatarUrl: true } }
            }
        }
      }
    });

    return comments;
  });
}