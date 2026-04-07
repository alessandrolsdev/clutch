import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isIntegrationError } from '../../core/services/integrations.service';

const steamConnectSchema = z.object({
  steamId: z.string().min(1, 'SteamID é obrigatório'),
});

const epicConnectSchema = z.object({
  authToken: z.string().min(1, 'Token Epic é obrigatório'),
});

function replyWithIntegrationError(
  request: { id: string; method: string; url: string; log: FastifyInstance['log'] },
  error: unknown,
): { statusCode: number; payload: { message: string } } {
  if (isIntegrationError(error)) {
    request.log.warn({
      event: 'integration_request_failed',
      requestId: request.id,
      method: request.method,
      path: request.url,
      provider: error.integration,
      reason: error.reason,
      status: error.statusCode,
    }, 'Integration request failed');

    return {
      statusCode: error.statusCode,
      payload: {
        message: error.clientMessage,
      },
    };
  }

  throw error;
}

export async function integrationRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /integrations/steam/connect ────────────────────
  app.post(
    '/steam/connect',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = steamConnectSchema.safeParse(request.body);
      if (!result.success) return reply.status(400).send({ message: result.error.errors[0]?.message });

      try {
        const resultPayload = await app.integrationsService.connectSteam(
          request.userId,
          result.data.steamId,
        );

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error);
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── POST /integrations/steam/sync ───────────────────────
  app.post(
    '/steam/sync',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const resultPayload = await app.integrationsService.syncSteamLibrary(request.userId);
        return reply.status(200).send(resultPayload);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error);
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── GET /integrations/igdb/search ───────────────────────
  app.get<{ Querystring: { q: string } }>(
    '/igdb/search',
    async (request, reply) => {
      const { q } = request.query;
      if (!q || q.trim().length < 2) return reply.status(400).send({ message: 'Query deve ter pelo menos 2 caracteres.' });

      try {
        const game = await app.integrationsService.searchIgdbGame(q.trim());
        if (!game) return reply.status(404).send({ message: 'Jogo não encontrado.' });

        return reply.status(200).send(game);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error);
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── POST /integrations/epic/connect ─────────────────────
  app.post(
    '/epic/connect',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = epicConnectSchema.safeParse(request.body);
      if (!result.success) return reply.status(400).send({ message: result.error.errors[0]?.message });

      try {
        const resultPayload = await app.integrationsService.connectEpic(
          request.userId,
          result.data.authToken,
        );

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error);
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

}
