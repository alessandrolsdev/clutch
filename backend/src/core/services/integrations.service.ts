/* eslint-disable no-unused-vars */
import { prisma } from '../../infra/database/client';
import type {
  PlatformIntegrationDataSource,
} from '@prisma/client';
import { buildExperimentalEpicExternalId } from '../providers/epic-identity';
import {
  createIntegrationError,
  type IntegrationError,
  translateUpstreamError,
} from '../../infra/integrations/integration.errors';
import { epicService, type EpicGame } from '../../infra/integrations/epic/epic.service';
import { igdbService, type IgdbGame } from '../../infra/integrations/igdb/igdb.service';
import { steamService, type SteamGame } from '../../infra/integrations/steam/steam.service';
import { writeBackendRuntimeLog } from '../../config/logging';
import {
  ConnectedAccountConflictError,
  createConnectedAccountService,
} from './connected-account.service';

type PlatformIntegrationPlatform = 'STEAM' | 'EPIC';

type PersistedIntegration = {
  externalId: string;
  accessToken?: string | null;
};

type PersistIntegrationInput = {
  externalId: string;
  accessToken?: string | null;
  dataSource?: PlatformIntegrationDataSource;
};

type SteamIntegrationClient = Pick<typeof steamService, 'validateSteamId' | 'getOwnedGames'>;
type IgdbIntegrationClient = Pick<typeof igdbService, 'searchGame' | 'searchGames'>;
type EpicIntegrationClient = Pick<typeof epicService, 'validateToken' | 'getLibrary'>;

type IntegrationsPersistence = {
  upsertPlatformIntegration(
    userId: string,
    platform: PlatformIntegrationPlatform,
    data: PersistIntegrationInput,
  ): Promise<void>;
  findPlatformIntegration(
    userId: string,
    platform: PlatformIntegrationPlatform,
  ): Promise<PersistedIntegration | null>;
  upsertSteamLibraryGame(
    userId: string,
    game: SteamGame,
    coverUrl: string | null,
  ): Promise<void>;
  upsertEpicLibraryGame(
    userId: string,
    game: EpicGame,
  ): Promise<void>;
};

export type IntegrationsService = ReturnType<typeof createIntegrationsService>;

export function createPrismaIntegrationsPersistence(): IntegrationsPersistence {
  const connectedAccountService = createConnectedAccountService();

  return {
    async upsertPlatformIntegration(userId, platform, data): Promise<void> {
      try {
        await connectedAccountService.connectExternalIdentity({
          userId,
          provider: platform,
          externalId: data.externalId,
          connectionType: 'CONNECTED_ACCOUNT',
          dataSource: data.dataSource ?? 'OFFICIAL',
          accessToken: data.accessToken,
          lastSyncAt: new Date(),
        });
      } catch (error) {
        if (error instanceof ConnectedAccountConflictError) {
          throw createIntegrationError(
            platform.toLowerCase() as 'steam' | 'epic',
            409,
            'conflict',
            'Esta conta externa já está vinculada a outro usuário.',
          );
        }

        throw error;
      }
    },
    async findPlatformIntegration(userId, platform): Promise<PersistedIntegration | null> {
      const integration = await prisma.platformIntegration.findUnique({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
      });

      if (!integration) {
        return null;
      }

      return {
        externalId: integration.externalId,
        accessToken: integration.accessToken,
      };
    },
    async upsertSteamLibraryGame(userId, game, coverUrl): Promise<void> {
      await prisma.userGameLibrary.upsert({
        where: {
          userId_gameId_platform: {
            userId,
            gameId: String(game.appid),
            platform: 'STEAM',
          },
        },
        create: {
          userId,
          gameId: String(game.appid),
          gameName: game.name,
          coverUrl,
          platform: 'STEAM',
          hoursPlayed: game.playtime_forever / 60,
        },
        update: {
          hoursPlayed: game.playtime_forever / 60,
          ...(typeof coverUrl === 'string' && coverUrl.length > 0
            ? { coverUrl }
            : {}),
        },
      });
    },
    async upsertEpicLibraryGame(userId, game): Promise<void> {
      await prisma.userGameLibrary.upsert({
        where: {
          userId_gameId_platform: {
            userId,
            gameId: game.id,
            platform: 'EPIC',
          },
        },
        create: {
          userId,
          gameId: game.id,
          gameName: game.title,
          coverUrl: game.coverUrl,
          platform: 'EPIC',
        },
        update: {
          gameName: game.title,
          ...(typeof game.coverUrl === 'string' && game.coverUrl.length > 0
            ? { coverUrl: game.coverUrl }
            : {}),
        },
      });
    },
  };
}

async function resolveIgdbCover(gameName: string, client: IgdbIntegrationClient): Promise<string | null> {
  try {
    const game = await client.searchGame(gameName);
    return game?.coverUrl ?? null;
  } catch (error) {
    const translatedError = translateUpstreamError(
      'igdb',
      error,
      'Busca IGDB indisponível.',
    );

    writeBackendRuntimeLog(
      'warn',
      'integration_igdb_enrichment_failed',
      'IGDB enrichment failed during Steam import',
      {
        integration: translatedError.integration,
        reason: translatedError.reason,
        status: translatedError.statusCode,
      },
    );

    return null;
  }
}

export function createIntegrationsService(dependencies?: {
  steamClient?: SteamIntegrationClient;
  igdbClient?: IgdbIntegrationClient;
  epicClient?: EpicIntegrationClient;
  persistence?: IntegrationsPersistence;
}): {
  connectSteam: (userId: string, steamId: string) => Promise<{ imported: number; message: string }>;
  syncSteamLibrary: (userId: string) => Promise<{ synced: number; message: string }>;
  searchIgdbGames: (query: string) => Promise<IgdbGame[]>;
  connectEpic: (userId: string, authToken: string) => Promise<{ imported: number; message: string }>;
} {
  const steamClient = dependencies?.steamClient ?? steamService;
  const igdbClient = dependencies?.igdbClient ?? igdbService;
  const epicClient = dependencies?.epicClient ?? epicService;
  const persistence = dependencies?.persistence ?? createPrismaIntegrationsPersistence();

  return {
    async connectSteam(userId: string, steamId: string): Promise<{ imported: number; message: string }> {
      const isValidSteamId = await steamClient.validateSteamId(steamId);

      if (!isValidSteamId) {
        throw createIntegrationError(
          'steam',
          400,
          'invalid_request',
          'SteamID inválido ou perfil privado.',
        );
      }

      await persistence.upsertPlatformIntegration(userId, 'STEAM', { externalId: steamId });

      const games = await steamClient.getOwnedGames(steamId);

      for (const game of games) {
        const coverUrl = await resolveIgdbCover(game.name, igdbClient);
        await persistence.upsertSteamLibraryGame(userId, game, coverUrl);
      }

      return {
        imported: games.length,
        message: `Steam conectado. ${games.length} jogos importados.`,
      };
    },

    async syncSteamLibrary(userId: string): Promise<{ synced: number; message: string }> {
      const integration = await persistence.findPlatformIntegration(userId, 'STEAM');

      if (!integration) {
        throw createIntegrationError(
          'steam',
          404,
          'not_connected',
          'Steam não conectado.',
        );
      }

      const games = await steamClient.getOwnedGames(integration.externalId);

      for (const game of games) {
        const coverUrl = await resolveIgdbCover(game.name, igdbClient);
        await persistence.upsertSteamLibraryGame(userId, game, coverUrl);
      }

      return {
        synced: games.length,
        message: `${games.length} jogos sincronizados.`,
      };
    },

    async searchIgdbGames(query: string): Promise<IgdbGame[]> {
      return igdbClient.searchGames(query, 5);
    },

    async connectEpic(userId: string, authToken: string): Promise<{ imported: number; message: string }> {
      const isValidToken = await epicClient.validateToken(authToken);

      if (!isValidToken) {
        throw createIntegrationError(
          'epic',
          400,
          'invalid_credentials',
          'Token Epic inválido ou expirado.',
        );
      }

      const games = await epicClient.getLibrary(authToken);

      await persistence.upsertPlatformIntegration(userId, 'EPIC', {
        externalId: buildExperimentalEpicExternalId(authToken),
        accessToken: authToken,
        dataSource: 'EXPERIMENTAL',
      });

      for (const game of games) {
        await persistence.upsertEpicLibraryGame(userId, game);
      }

      return {
        imported: games.length,
        message: `Epic conectado. ${games.length} jogos importados.`,
      };
    },
  };
}

export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof Error && error.name === 'IntegrationError';
}
