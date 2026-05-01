import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { extractBearerToken, type VerifiedJwtPayload } from '../../config/jwt';
import {
  arenaService,
  ArenaServiceError,
} from '../../core/services/arena.service';

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const challengeIdParamsSchema = z.object({
  challengeId: z.string().trim().min(1),
});

const submitProofSchema = z.object({
  proofType: z.enum(['GAME_SESSION', 'ACHIEVEMENT']),
  proofId: z.string().trim().min(1),
});

function resolveOptionalViewerUserId(request: FastifyRequest): string | null {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    return null;
  }

  try {
    const payload = request.server.verifyAccessToken(token) as VerifiedJwtPayload;
    return payload.id;
  } catch {
    return null;
  }
}

function sendArenaServiceError(
  error: ArenaServiceError,
  reply: FastifyReply,
): FastifyReply {
  const statusByCode: Record<ArenaServiceError['code'], number> = {
    ARENA_CHALLENGE_NOT_FOUND: 404,
    ARENA_CHALLENGE_NOT_ACTIVE: 409,
    ARENA_CHALLENGE_NOT_STARTED: 409,
    ARENA_CHALLENGE_ENDED: 409,
    ARENA_PARTICIPATION_REQUIRED: 403,
    ARENA_PROOF_NOT_FOUND: 404,
    ARENA_PROOF_FORBIDDEN: 403,
    ARENA_PROOF_TYPE_UNSUPPORTED: 400,
    ARENA_PROOF_OUTSIDE_WINDOW: 400,
    ARENA_PROOF_DUPLICATE: 409,
    ARENA_SUBMISSION_CAP_REACHED: 409,
  };

  return reply.status(statusByCode[error.code]).send({ message: error.message });
}

export async function arenaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/challenges', async (request) => {
    const challenges = await arenaService.listActiveChallenges(
      resolveOptionalViewerUserId(request),
    );

    return { challenges };
  });

  app.get<{ Params: { slug: string } }>('/challenges/:slug', async (request, reply) => {
    const params = slugParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: params.error.flatten(),
      });
    }

    try {
      const challenge = await arenaService.getChallenge(
        params.data.slug,
        resolveOptionalViewerUserId(request),
      );

      return { challenge };
    } catch (error) {
      if (error instanceof ArenaServiceError) {
        return sendArenaServiceError(error, reply);
      }

      throw error;
    }
  });

  app.post<{ Params: { challengeId: string } }>(
    '/challenges/:challengeId/join',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = challengeIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const challenge = await arenaService.joinChallenge(
          params.data.challengeId,
          request.userId,
        );

        return reply.status(200).send({ challenge });
      } catch (error) {
        if (error instanceof ArenaServiceError) {
          return sendArenaServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post<{ Params: { challengeId: string } }>(
    '/challenges/:challengeId/submissions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = challengeIdParamsSchema.safeParse(request.params);
      const body = submitProofSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.status(400).send({
          message: 'Dados inválidos.',
          errors: {
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        });
      }

      try {
        const submission = await arenaService.submitProof(
          params.data.challengeId,
          request.userId,
          body.data,
        );

        return reply.status(201).send({ submission });
      } catch (error) {
        if (error instanceof ArenaServiceError) {
          return sendArenaServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get<{ Params: { challengeId: string } }>(
    '/challenges/:challengeId/leaderboard',
    async (request, reply) => {
      const params = challengeIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const leaderboard = await arenaService.listLeaderboard(params.data.challengeId);

        return { leaderboard };
      } catch (error) {
        if (error instanceof ArenaServiceError) {
          return sendArenaServiceError(error, reply);
        }

        throw error;
      }
    },
  );
}
