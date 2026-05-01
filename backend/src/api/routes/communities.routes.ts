import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { extractBearerToken, type VerifiedJwtPayload } from '../../config/jwt';
import {
  communityService,
  CommunityServiceError,
} from '../../core/services/community.service';

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(80),
});

const createCommunitySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).optional(),
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

function sendCommunityServiceError(
  error: CommunityServiceError,
  reply: FastifyReply,
): FastifyReply {
  const statusByCode: Record<CommunityServiceError['code'], number> = {
    COMMUNITY_NOT_FOUND: 404,
    COMMUNITY_SLUG_CONFLICT: 409,
    COMMUNITY_ARCHIVED: 409,
    COMMUNITY_ALREADY_JOINED: 409,
    COMMUNITY_OWNER_CANNOT_LEAVE: 403,
    COMMUNITY_FORBIDDEN: 403,
    COMMUNITY_MEMBERSHIP_NOT_FOUND: 404,
  };

  return reply.status(statusByCode[error.code]).send({ message: error.message });
}

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const communities = await communityService.listPublicCommunities();

    return { communities };
  });

  app.post(
    '/',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = createCommunitySchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          message: 'Dados inválidos.',
          errors: result.error.flatten(),
        });
      }

      try {
        const community = await communityService.createPublicCommunity({
          ownerUserId: request.userId,
          name: result.data.name,
          description: result.data.description ?? null,
        });

        return reply.status(201).send({ community });
      } catch (error) {
        if (error instanceof CommunityServiceError) {
          return sendCommunityServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const params = slugParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: params.error.flatten(),
      });
    }

    try {
      const community = await communityService.getPublicCommunity(
        params.data.slug,
        resolveOptionalViewerUserId(request),
      );

      return { community };
    } catch (error) {
      if (error instanceof CommunityServiceError) {
        return sendCommunityServiceError(error, reply);
      }

      throw error;
    }
  });

  app.post<{ Params: { slug: string } }>(
    '/:slug/join',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = slugParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const community = await communityService.joinCommunity(params.data.slug, request.userId);

        return reply.status(200).send({ community });
      } catch (error) {
        if (error instanceof CommunityServiceError) {
          return sendCommunityServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.delete<{ Params: { slug: string } }>(
    '/:slug/membership',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = slugParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const community = await communityService.leaveCommunity(params.data.slug, request.userId);

        return reply.status(200).send({ community });
      } catch (error) {
        if (error instanceof CommunityServiceError) {
          return sendCommunityServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.patch<{ Params: { slug: string } }>(
    '/:slug/archive',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = slugParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const community = await communityService.archiveCommunity(params.data.slug, request.userId);

        return reply.status(200).send({ community });
      } catch (error) {
        if (error instanceof CommunityServiceError) {
          return sendCommunityServiceError(error, reply);
        }

        throw error;
      }
    },
  );
}
