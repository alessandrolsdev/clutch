import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { steamService }  from '@/infra/integrations/steam/steam.service';
import { igdbService }   from '@/infra/integrations/igdb/igdb.service';
import { epicService }   from '@/infra/integrations/epic/epic.service';
import { prisma }        from '@/infra/database/client';

// ─────────────────────────────────────────────────────────────
// Integrations Routes
// POST /integrations/steam/connect
// POST /integrations/steam/sync
// GET  /integrations/igdb/search
// POST /integrations/epic/connect
// ─────────────────────────────────────────────────────────────

const steamConnectSchema = z.object({
  steamId: z.string().min(1, 'SteamID é obrigatório'),
});

const epicConnectSchema = z.object({
  authToken: z.string().min(1, 'Token Epic é obrigatório'),
});

export async function integrationRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /integrations/steam/connect ────────────────────
  app.post(
    '/steam/connect',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const result = steamConnectSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const { steamId } = result.data;

      const isValid = await steamService.validateSteamId(steamId);
      if (!isValid) {
        return reply.status(400).send({ message: 'SteamID inválido ou perfil privado.' });
      }

      await prisma.platformIntegration.upsert({
        where:  { userId_platform: { userId, platform: 'STEAM' } },
        create: { userId, platform: 'STEAM', externalId: steamId },
        update: { externalId: steamId, isActive: true },
      });

      const games = await steamService.getOwnedGames(steamId);

      let imported = 0;
      for (const game of games) {
        const igdbData = await igdbService.searchGame(game.name).catch(() => null);

        await prisma.userGameLibrary.upsert({
          where: {
            userId_gameId_platform: {
              userId,
              gameId:   String(game.appid),
              platform: 'STEAM',
            },
          },
          create: {
            userId,
            gameId:      String(game.appid),
            gameName:    game.name,
            coverUrl:    igdbData?.coverUrl ?? null,
            platform:    'STEAM',
            hoursPlayed: game.playtime_forever / 60,
          },
          update: {
            hoursPlayed: game.playtime_forever / 60,
            coverUrl:    igdbData?.coverUrl ?? null,
          },
        });
        imported++;
      }

      return reply.status(200).send({
        message:  `Steam conectado. ${imported} jogos importados.`,
        imported,
      });
    },
  );

  // ── POST /integrations/steam/sync ───────────────────────
  app.post(
    '/steam/sync',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const integration = await prisma.platformIntegration.findUnique({
        where: { userId_platform: { userId, platform: 'STEAM' } },
      });

      if (!integration) {
        return reply.status(404).send({ message: 'Steam não conectado.' });
      }

      const games   = await steamService.getOwnedGames(integration.externalId);
      let synced    = 0;

      for (const game of games) {
        await prisma.userGameLibrary.upsert({
          where: {
            userId_gameId_platform: {
              userId,
              gameId:   String(game.appid),
              platform: 'STEAM',
            },
          },
          create: {
            userId,
            gameId:      String(game.appid),
            gameName:    game.name,
            platform:    'STEAM',
            hoursPlayed: game.playtime_forever / 60,
          },
          update: {
            hoursPlayed: game.playtime_forever / 60,
          },
        });
        synced++;
      }

      return reply.status(200).send({ message: `${synced} jogos sincronizados.`, synced });
    },
  );

  // ── GET /integrations/igdb/search ───────────────────────
  app.get<{ Querystring: { q: string } }>(
    '/igdb/search',
    async (request, reply) => {
      const { q } = request.query;
      if (!q || q.trim().length < 2) {
        return reply.status(400).send({ message: 'Query deve ter pelo menos 2 caracteres.' });
      }

      const game = await igdbService.searchGame(q.trim());
      if (!game) {
        return reply.status(404).send({ message: 'Jogo não encontrado.' });
      }

      return reply.status(200).send(game);
    },
  );

  // ── POST /integrations/epic/connect ─────────────────────
  app.post(
    '/epic/connect',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string | undefined;
      if (!userId) return reply.status(401).send({ message: 'Não autorizado.' });

      const result = epicConnectSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message });
      }

      const { authToken } = result.data;

      const isValid = await epicService.validateToken(authToken);
      if (!isValid) {
        return reply.status(400).send({ message: 'Token Epic inválido ou expirado.' });
      }

      const games = await epicService.getLibrary(authToken).catch(() => {
        throw { statusCode: 503, message: 'Serviço Epic indisponível. Tente novamente.' };
      });

      await prisma.platformIntegration.upsert({
        where:  { userId_platform: { userId, platform: 'EPIC' } },
        create: { userId, platform: 'EPIC', externalId: 'epic', accessToken: authToken },
        update: { accessToken: authToken, isActive: true },
      });

      let imported = 0;
      for (const game of games) {
        await prisma.userGameLibrary.upsert({
          where:  { userId_gameId_platform: { userId, gameId: game.id, platform: 'EPIC' } },
          create: { userId, gameId: game.id, gameName: game.title, coverUrl: game.coverUrl, platform: 'EPIC' },
          update: { gameName: game.title, coverUrl: game.coverUrl },
        });
        imported++;
      }

      return reply.status(200).send({
        message:  `Epic conectado. ${imported} jogos importados.`,
        imported,
      });
    },
  );

}