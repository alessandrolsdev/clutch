import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DISCORD_PRESENCE_INGEST_TOKEN_HEADER,
  hasValidDiscordPresenceIngestToken,
  isDiscordPresenceIngestConfigured,
} from '../../config/discord-presence';
import { sanitizeRequestPath } from '../../config/logging';
import { createIntegrationError } from '../../infra/integrations/integration.errors';
import { isIntegrationError } from '../../core/services/integrations.service';

const steamConnectSchema = z.object({
  steamId: z.string().trim().min(1, 'SteamID é obrigatório'),
});

const epicConnectSchema = z.object({
  authToken: z.string().min(1, 'Token Epic é obrigatório'),
});

const discordCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().optional(),
}).refine(
  (input) => Boolean(input.error) || (Boolean(input.code) && Boolean(input.state)),
  {
    message: 'Callback Discord inválido.',
  },
);

const discordPresenceIngestSchema = z.object({
  externalId: z.string().min(1, 'Discord externalId é obrigatório.'),
  status: z.enum(['ONLINE', 'IN_GAME', 'AFK', 'OFFLINE']),
  currentGame: z.string().max(100).nullable().optional(),
  gameDetails: z.record(z.unknown()).nullable().optional(),
});

function replyWithIntegrationError(
  request: { id: string; method: string; url: string; log: FastifyInstance['log'] },
  error: unknown,
  options: { logFailure?: boolean } = {},
): { statusCode: number; payload: { message: string } } {
  if (isIntegrationError(error)) {
    if (options.logFailure !== false) {
      request.log.warn({
        event: 'integration_request_failed',
        requestId: request.id,
        method: request.method,
        path: sanitizeRequestPath(request.url),
        provider: error.integration,
        reason: error.reason,
        status: error.statusCode,
      }, 'Integration request failed');
    }

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

  // ── POST /integrations/myanimelist/import ───────────────
  app.post(
    '/myanimelist/import',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const resultPayload = await app.integrationsService.importMyAnimeListLists(request.userId);
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
        const games = await app.integrationsService.searchIgdbGames(q.trim());
        return reply.status(200).send({ games });
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error);
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── GET /integrations/discord/auth ──────────────────────
  app.get(
    '/discord/auth',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const resultPayload = await app.discordOAuthService.getAuthorizationUrl({
          userId: request.userId,
          requestId: request.id,
        });

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error, { logFailure: false });
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── GET /integrations/discord/callback ──────────────────
  app.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    '/discord/callback',
    async (request, reply) => {
      const result = discordCallbackSchema.safeParse(request.query);
      if (!result.success) {
        return reply.status(400).send({ message: 'Callback Discord inválido.' });
      }

      try {
        const resultPayload = await app.discordOAuthService.completeCallback({
          code: result.data.code,
          state: result.data.state,
          providerError: result.data.error,
          requestId: request.id,
        });

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const integrationError = replyWithIntegrationError(request, error, { logFailure: false });
        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }
    },
  );

  // ── POST /integrations/discord/presence ────────────────
  app.post(
    '/discord/presence',
    async (request, reply) => {
      if (!isDiscordPresenceIngestConfigured()) {
        const integrationError = replyWithIntegrationError(
          request,
          createIntegrationError(
            'discord',
            503,
            'misconfigured',
            'Ingestão de presença Discord indisponível no runtime atual.',
          ),
          { logFailure: false },
        );

        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }

      if (!hasValidDiscordPresenceIngestToken(request.headers[DISCORD_PRESENCE_INGEST_TOKEN_HEADER])) {
        const integrationError = replyWithIntegrationError(
          request,
          createIntegrationError(
            'discord',
            401,
            'invalid_credentials',
            'Integração Discord não autorizada.',
          ),
          { logFailure: false },
        );

        return reply.status(integrationError.statusCode).send(integrationError.payload);
      }

      const result = discordPresenceIngestSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message ?? 'Dados inválidos.' });
      }

      try {
        const resultPayload = await app.discordPresenceService.ingestPresence({
          externalId: result.data.externalId,
          status: result.data.status,
          currentGame: result.data.currentGame,
          gameDetails: result.data.gameDetails as Record<string, unknown> | null | undefined,
          requestId: request.id,
        });

        return reply.status(200).send(resultPayload);
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
