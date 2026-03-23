import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { postRepository }     from '@/core/repositories/post.repository';
import { presenceRepository } from '@/core/repositories/presence.repository';
import { userRepository }     from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Posts Routes
// POST   /posts
// GET    /posts/feed/:userId
// POST   /posts/:id/interactions
// POST   /comments
// GET    /comments/:postId
// DELETE /posts/:id
// ─────────────────────────────────────────────────────────────

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
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const result = createPostSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const { contentText, mediaUrl, type } = result.data;

      if (!contentText && !mediaUrl) {
        return reply.status(400).send({ message: 'Post precisa ter texto ou mídia.' });
      }

      // Captura o jogo sendo jogado no momento
      const presence    = await presenceRepository.get(userId);
      const gameContext = presence.status === 'IN_GAME'
        ? {
            gameName:    presence.currentGame,
            platform:    presence.platform,
            capturedAt:  new Date().toISOString(),
          }
        : null;

      const post = await postRepository.create({
        userId,
        contentText: contentText ?? null,
        mediaUrl:    mediaUrl    ?? null,
        type,
        gameContext,
      });

      return reply.status(201).send(post);
    },
  );

  // ── GET /posts/feed/:userId ──────────────────────────────
  app.get<{
    Params:      { userId: string };
    Querystring: { cursor?: string; limit?: string };
  }>(
    '/feed/:userId',
    async (request, reply) => {
      const { userId }        = request.params;
      const { cursor, limit } = request.query;

      const user = await userRepository.findById(userId);
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      const feed = await postRepository.findFeedByUserId(
        userId,
        cursor,
        limit ? Math.min(parseInt(limit), 50) : 20,
      );

      return reply.status(200).send(feed);
    },
  );

  // ── POST /posts/:id/interactions ─────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/interactions',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const result = interactionSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const post = await postRepository.findById(request.params.id);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      if (post.userId === userId) {
        return reply.status(400).send({ message: 'Você não pode reagir ao próprio post.' });
      }

      const { added } = await postRepository.toggleInteraction(
        request.params.id,
        userId,
        result.data.type,
      );

      return reply.status(200).send({ added });
    },
  );

  // ── POST /comments ───────────────────────────────────────
  app.post(
    '/comments',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const result = createCommentSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const { postId, content, parentId } = result.data;

      const post = await postRepository.findById(postId);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      const comment = await postRepository.createComment(
        postId,
        userId,
        content,
        parentId,
      );

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
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const post = await postRepository.findById(request.params.id);
      if (!post) return reply.status(404).send({ message: 'Post não encontrado.' });

      if (post.userId !== userId) {
        return reply.status(403).send({ message: 'Você não pode deletar este post.' });
      }

      await postRepository.deleteById(request.params.id);

      return reply.status(200).send({ message: 'Post removido.' });
    },
  );

}