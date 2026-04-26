import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { extractBearerToken, type VerifiedJwtPayload } from '../../config/jwt';
import {
  communityService,
  CommunityServiceError,
} from '../../core/services/community.service';
import {
  communityEventService,
  CommunityEventServiceError,
} from '../../core/services/community-event.service';

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(80),
});

const createCommunitySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).optional(),
});

const eventParamsSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  eventId: z.string().trim().min(1).max(80),
});

const createCommunityEventSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(280).optional(),
  startsAt: z.string().datetime(),
});

const communityEventRsvpSchema = z.object({
  status: z.enum(['GOING', 'INTERESTED', 'NOT_GOING']),
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
    COMMUNITY_ALREADY_JOINED: 409,
    COMMUNITY_OWNER_CANNOT_LEAVE: 403,
    COMMUNITY_MEMBERSHIP_NOT_FOUND: 404,
  };

  return reply.status(statusByCode[error.code]).send({ message: error.message });
}

function sendCommunityEventServiceError(
  error: CommunityEventServiceError,
  reply: FastifyReply,
): FastifyReply {
  const statusByCode: Record<CommunityEventServiceError['code'], number> = {
    COMMUNITY_NOT_FOUND: 404,
    COMMUNITY_EVENT_NOT_FOUND: 404,
    COMMUNITY_EVENT_FORBIDDEN: 403,
    COMMUNITY_EVENT_INVALID_START: 400,
    COMMUNITY_EVENT_CANCELLED: 409,
    COMMUNITY_MEMBERSHIP_REQUIRED: 403,
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

  app.get<{ Params: { slug: string } }>('/:slug/events', async (request, reply) => {
    const params = slugParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: params.error.flatten(),
      });
    }

    try {
      const events = await communityEventService.listEvents(
        params.data.slug,
        resolveOptionalViewerUserId(request),
      );

      return { events };
    } catch (error) {
      if (error instanceof CommunityEventServiceError) {
        return sendCommunityEventServiceError(error, reply);
      }

      throw error;
    }
  });

  app.post<{ Params: { slug: string } }>(
    '/:slug/events',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = slugParamsSchema.safeParse(request.params);
      const body = createCommunityEventSchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          message: 'Dados inválidos.',
          errors: body.error.flatten(),
        });
      }

      try {
        const event = await communityEventService.createEvent(
          params.data.slug,
          request.userId,
          {
            title: body.data.title,
            description: body.data.description ?? null,
            startsAt: new Date(body.data.startsAt),
          },
        );

        return reply.status(201).send({ event });
      } catch (error) {
        if (error instanceof CommunityEventServiceError) {
          return sendCommunityEventServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.get<{ Params: { slug: string; eventId: string } }>(
    '/:slug/events/:eventId',
    async (request, reply) => {
      const params = eventParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const event = await communityEventService.getEvent(
          params.data.slug,
          params.data.eventId,
          resolveOptionalViewerUserId(request),
        );

        return { event };
      } catch (error) {
        if (error instanceof CommunityEventServiceError) {
          return sendCommunityEventServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.post<{ Params: { slug: string; eventId: string } }>(
    '/:slug/events/:eventId/rsvp',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = eventParamsSchema.safeParse(request.params);
      const body = communityEventRsvpSchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          message: 'Dados inválidos.',
          errors: body.error.flatten(),
        });
      }

      try {
        const event = await communityEventService.setRsvp(
          params.data.slug,
          params.data.eventId,
          request.userId,
          body.data.status,
        );

        return reply.status(200).send({ event });
      } catch (error) {
        if (error instanceof CommunityEventServiceError) {
          return sendCommunityEventServiceError(error, reply);
        }

        throw error;
      }
    },
  );

  app.delete<{ Params: { slug: string; eventId: string } }>(
    '/:slug/events/:eventId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = eventParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
          errors: params.error.flatten(),
        });
      }

      try {
        const event = await communityEventService.cancelEvent(
          params.data.slug,
          params.data.eventId,
          request.userId,
        );

        return reply.status(200).send({ event });
      } catch (error) {
        if (error instanceof CommunityEventServiceError) {
          return sendCommunityEventServiceError(error, reply);
        }

        throw error;
      }
    },
  );
}
