import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  otakuShowcaseService,
  OtakuShowcaseServiceError,
  OTAKU_SHOWCASE_MAX_FEATURED,
} from '../../core/services/otaku-showcase.service';

const entryParamsSchema = z.object({
  entryId: z.string().uuid('Item otaku inválido.'),
});

const updateShowcaseSchema = z.object({
  showcaseRank: z
    .number()
    .int()
    .min(1)
    .max(OTAKU_SHOWCASE_MAX_FEATURED)
    .nullable(),
});

function sendOtakuShowcaseServiceError(
  error: OtakuShowcaseServiceError,
  reply: FastifyReply,
): FastifyReply {
  const statusByCode: Record<OtakuShowcaseServiceError['code'], number> = {
    OTAKU_ENTRY_NOT_FOUND: 404,
    OTAKU_SHOWCASE_CONCURRENT_UPDATE: 409,
    OTAKU_SHOWCASE_LIMIT_EXCEEDED: 409,
    OTAKU_SHOWCASE_RANK_INVALID: 400,
  };

  return reply.status(statusByCode[error.code]).send({ message: error.message });
}

export async function otakuRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/library',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const entries = await otakuShowcaseService.listUserLibrary(request.userId);

      return reply.status(200).send({
        entries,
        maxShowcaseItems: OTAKU_SHOWCASE_MAX_FEATURED,
      });
    },
  );

  app.patch<{ Params: { entryId: string } }>(
    '/library/:entryId/showcase',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = entryParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ message: params.error.errors[0]?.message ?? 'Parâmetros inválidos.' });
      }

      const body = updateShowcaseSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ message: body.error.errors[0]?.message ?? 'Dados inválidos.' });
      }

      try {
        const entry = await otakuShowcaseService.updateEntryShowcase(
          request.userId,
          params.data.entryId,
          body.data.showcaseRank,
        );

        return reply.status(200).send({ entry });
      } catch (error) {
        if (error instanceof OtakuShowcaseServiceError) {
          return sendOtakuShowcaseServiceError(error, reply);
        }

        throw error;
      }
    },
  );
}
