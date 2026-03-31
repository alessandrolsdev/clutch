import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationService } from '@/core/services/notification.service';
import { postRepository }     from '@/core/repositories/post.repository';
import { presenceRepository } from '@/core/repositories/presence.repository';
import { userRepository }     from '@/core/repositories/user.repository';

const createPostSchema = z.object({
  contentText: z.string().max(500).optional(),
  mediaUrl:    z.string().url().optional(),
  type:        z.enum(['TEXT', 'IMAGE', 'ACHIEVEMENT', 'GAME_SESSION']).default('TEXT'),
});

const interactionSchema = z.object({
  type: z.enum(['LIKE', 'GG', 'F', 'CLAP', 'HYPE']),
});

const createCommentSchema = z.object({
  postId:   z.string().min(1),
  content:  z.string().min(1).max(300),
  parentId: z.string().optional(),
});

export async function postRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /posts ──────────────────────────────────────────
  app.post(
    '/',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = createPostSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const { contentText, mediaUrl, type } = result.data;
      if (!contentText && !mediaUrl) {
        return reply.status(400).send({ message: 'Post precisa ter texto ou mídia.' });
      }

      const presence    = await presenceRepository.get(request.userId);
      const gameContext = presence.status === 'IN_GAME'
        ? { gameName: presence.currentGame, platform: presence.platform, capturedAt: new Date().toISOString() }
        : null;

      const post = await postRepository.create({
        userId: request.userId, contentText: contentText ?? null,
        mediaUrl: mediaUrl ?? null, type, gameContext,
      });

      return reply.status(201).send(post);
    },
  );

  // ── GET /posts/feed/:userId ──────────────────────────────
  app.get<{ Params: { userId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/feed/:userId',
    async (request, reply) => {
      const user = await userRepository.findById(request.params.userId);
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      const { cursor, limit } = request.query;
      const feed = await postRepository.findFeedByUserId(
        request.params.userId, cursor, limit ? Math.min(parseInt(limit), 50) : 20,
      );

      return reply.status(200).send(feed);
    },
  );

  // ── POST /posts/:id/interactions ─────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/interactions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = interactionSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const post = await postRepository.findById(request.params.id);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      if (post.userId === request.userId) {
        return reply.status(400).send({ message: 'Você não pode reagir ao próprio post.' });
      }

      const { added } = await postRepository.toggleInteraction(request.params.id, request.userId, result.data.type);
      if (added) {
        await notificationService.create({
          userId:  post.userId,
          actorId: request.userId,
          type:    'POST_LIKE',
          payload: {
            postId:          post.id,
            interactionType: result.data.type,
          },
        });
      }

      return reply.status(200).send({ added });
    },
  );

  // ── POST /posts/comments ─────────────────────────────────
  app.post(
    '/comments',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = createCommentSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const post = await postRepository.findById(result.data.postId);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      if (result.data.parentId) {
        const parentComment = await postRepository.findCommentById(result.data.parentId);
        if (!parentComment || parentComment.postId !== post.id) {
          return reply.status(400).send({ message: 'Comentário pai inválido para este post.' });
        }

        if (parentComment.parentId) {
          return reply.status(400).send({ message: 'Apenas um nível de resposta é permitido.' });
        }
      }

      const comment = await postRepository.createComment(
        result.data.postId, request.userId, result.data.content, result.data.parentId,
      );

      if (post.userId !== request.userId) {
        await notificationService.create({
          userId:  post.userId,
          actorId: request.userId,
          type:    'POST_COMMENT',
          payload: {
            postId:    post.id,
            commentId: comment.id,
            parentId:  comment.parentId ?? null,
          },
        });
      }

      return reply.status(201).send(comment);
    },
  );

  // ── GET /posts/comments/:postId ──────────────────────────
  app.get<{ Params: { postId: string } }>(
    '/comments/:postId',
    async (request, reply) => {
      const post = await postRepository.findById(request.params.postId);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      const comments = await postRepository.findCommentsByPostId(request.params.postId);
      return reply.status(200).send(comments);
    },
  );

  // ── DELETE /posts/:id ────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const post = await postRepository.findById(request.params.id);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      if (post.userId !== request.userId) {
        return reply.status(403).send({ message: 'Você não pode deletar este post.' });
      }

      await postRepository.deleteById(request.params.id);
      return reply.status(200).send({ message: 'Post removido.' });
    },
  );

}
