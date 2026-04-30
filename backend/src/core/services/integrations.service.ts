/* eslint-disable no-unused-vars */
import { prisma } from '../../infra/database/client';
import type {
  MediaConsumptionStatus,
  MediaKind,
  PlatformIntegrationDataSource,
  PlatformIntegrationStatus,
} from '@prisma/client';
import { revealSensitiveToken } from '../../config/protected-token';
import { buildExperimentalEpicExternalId } from '../providers/epic-identity';
import {
  createIntegrationError,
  IntegrationError,
  translateUpstreamError,
} from '../../infra/integrations/integration.errors';
import { epicService, type EpicGame } from '../../infra/integrations/epic/epic.service';
import { igdbService, type IgdbGame } from '../../infra/integrations/igdb/igdb.service';
import {
  myAnimeListListClient,
  type MyAnimeListListClient,
  type MyAnimeListListItem,
  type MyAnimeListListStatus,
} from '../../infra/integrations/myanimelist/myanimelist-list.client';
import { steamService, type SteamGame } from '../../infra/integrations/steam/steam.service';
import { writeBackendRuntimeLog } from '../../config/logging';
import {
  ConnectedAccountConflictError,
  createConnectedAccountService,
} from './connected-account.service';

type PlatformIntegrationPlatform = 'STEAM' | 'EPIC' | 'MYANIMELIST';

type PersistedIntegration = {
  externalId: string;
  status: PlatformIntegrationStatus;
  dataSource: PlatformIntegrationDataSource;
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

export type MyAnimeListImportResult = {
  imported: number;
  anime: number;
  manga: number;
  message: string;
};

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
  upsertOtakuMediaEntry?(
    userId: string,
    item: NormalizedMyAnimeListImportItem,
  ): Promise<void>;
  touchPlatformIntegrationLastSyncAt?(
    userId: string,
    platform: PlatformIntegrationPlatform,
    syncedAt: Date,
  ): Promise<void>;
};

type NormalizedMyAnimeListImportItem = {
  externalId: string;
  title: string;
  kind: MediaKind;
  coverUrl: string | null;
  status: MediaConsumptionStatus;
  progress: number | null;
  score: number | null;
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
        status: integration.status,
        dataSource: integration.dataSource,
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
    async upsertOtakuMediaEntry(userId, item): Promise<void> {
      const mediaTitle = await prisma.mediaTitle.upsert({
        where: {
          externalSource_externalId_kind: {
            externalSource: 'MYANIMELIST',
            externalId: item.externalId,
            kind: item.kind,
          },
        },
        create: {
          kind: item.kind,
          canonicalTitle: item.title,
          coverUrl: item.coverUrl,
          externalSource: 'MYANIMELIST',
          externalId: item.externalId,
        },
        update: {
          canonicalTitle: item.title,
          coverUrl: item.coverUrl,
        },
      });

      await prisma.userMediaEntry.upsert({
        where: {
          userId_mediaTitleId: {
            userId,
            mediaTitleId: mediaTitle.id,
          },
        },
        create: {
          userId,
          mediaTitleId: mediaTitle.id,
          status: item.status,
          progress: item.progress,
          score: item.score,
          showcaseRank: null,
        },
        update: {
          status: item.status,
          progress: item.progress,
          score: item.score,
        },
      });
    },
    async touchPlatformIntegrationLastSyncAt(userId, platform, syncedAt): Promise<void> {
      await prisma.platformIntegration.update({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
        data: {
          lastSyncAt: syncedAt,
        },
      });
    },
  };
}

export function mapMyAnimeListStatus(status: MyAnimeListListStatus): MediaConsumptionStatus {
  switch (status) {
    case 'watching':
    case 'reading':
      return 'CONSUMING';
    case 'completed':
      return 'COMPLETED';
    case 'plan_to_watch':
    case 'plan_to_read':
      return 'PLANNING';
    case 'on_hold':
      return 'PAUSED';
    case 'dropped':
      return 'DROPPED';
  }
}

function normalizeMyAnimeListImportItem(item: MyAnimeListListItem): NormalizedMyAnimeListImportItem {
  return {
    externalId: item.id,
    title: item.title,
    kind: item.kind,
    coverUrl: item.coverUrl,
    status: mapMyAnimeListStatus(item.status),
    progress: item.progress,
    score: item.score,
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
  myAnimeListClient?: MyAnimeListListClient;
  persistence?: IntegrationsPersistence;
}): {
  connectSteam: (userId: string, steamId: string) => Promise<{ imported: number; message: string }>;
  syncSteamLibrary: (userId: string) => Promise<{ synced: number; message: string }>;
  searchIgdbGames: (query: string) => Promise<IgdbGame[]>;
  connectEpic: (userId: string, authToken: string) => Promise<{ imported: number; message: string }>;
  importMyAnimeListLists: (userId: string) => Promise<MyAnimeListImportResult>;
} {
  const steamClient = dependencies?.steamClient ?? steamService;
  const igdbClient = dependencies?.igdbClient ?? igdbService;
  const epicClient = dependencies?.epicClient ?? epicService;
  const myAnimeListClient = dependencies?.myAnimeListClient ?? myAnimeListListClient;
  const persistence = dependencies?.persistence ?? createPrismaIntegrationsPersistence();

  return {
    async connectSteam(userId: string, steamId: string): Promise<{ imported: number; message: string }> {
      const normalizedSteamId = steamId.trim();
      const isValidSteamId = await steamClient.validateSteamId(normalizedSteamId);

      if (!isValidSteamId) {
        throw createIntegrationError(
          'steam',
          400,
          'invalid_request',
          'SteamID inválido ou perfil privado.',
        );
      }

      const existingSteamIntegration = await persistence.findPlatformIntegration(userId, 'STEAM');
      const hasOfficialOwnershipProof = existingSteamIntegration?.dataSource === 'OFFICIAL';

      if (hasOfficialOwnershipProof && existingSteamIntegration.externalId !== normalizedSteamId) {
        throw createIntegrationError(
          'steam',
          409,
          'conflict',
          'A conta Steam verificada já usa outro SteamID. Use o fluxo verificado pela Steam para trocar a conta.',
        );
      }

      await persistence.upsertPlatformIntegration(userId, 'STEAM', {
        externalId: normalizedSteamId,
        dataSource: hasOfficialOwnershipProof ? 'OFFICIAL' : 'MANUAL',
      });

      let games: SteamGame[] = [];
      let libraryImportSkipped = false;

      try {
        games = await steamClient.getOwnedGames(normalizedSteamId);
      } catch (error) {
        if (!(error instanceof IntegrationError)) {
          throw error;
        }

        libraryImportSkipped = true;
        writeBackendRuntimeLog(
          'warn',
          'integration_steam_library_import_skipped',
          'Steam connection was persisted, but the initial library import failed.',
          {
            provider: 'steam',
            reason: error.reason,
          },
        );
      }

      for (const game of games) {
        const coverUrl = await resolveIgdbCover(game.name, igdbClient);
        await persistence.upsertSteamLibraryGame(userId, game, coverUrl);
      }

      return {
        imported: games.length,
        message: libraryImportSkipped
          ? 'Steam conectado. Biblioteca indisponivel no momento; tente sincronizar novamente mais tarde.'
          : `Steam conectado. ${games.length} jogos importados.`,
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

    async importMyAnimeListLists(userId: string): Promise<MyAnimeListImportResult> {
      const integration = await persistence.findPlatformIntegration(userId, 'MYANIMELIST');

      if (!integration) {
        throw createIntegrationError(
          'myanimelist',
          404,
          'not_connected',
          'MyAnimeList não conectado.',
        );
      }

      if (integration.status !== 'CONNECTED') {
        throw createIntegrationError(
          'myanimelist',
          409,
          'reauth_required',
          'Reconecte o MyAnimeList antes de importar listas.',
        );
      }

      let accessToken: string | null;

      try {
        accessToken = revealSensitiveToken(integration.accessToken);
      } catch (error) {
        if (error instanceof Error && error.message === 'Token protegido inválido.') {
          throw createIntegrationError(
            'myanimelist',
            409,
            'reauth_required',
            'Reconecte o MyAnimeList antes de importar listas.',
          );
        }

        throw error;
      }

      if (!accessToken) {
        throw createIntegrationError(
          'myanimelist',
          409,
          'reauth_required',
          'Reconecte o MyAnimeList antes de importar listas.',
        );
      }

      let animeItems: MyAnimeListListItem[];
      let mangaItems: MyAnimeListListItem[];

      [animeItems, mangaItems] = await Promise.all([
        myAnimeListClient.fetchAnimeList(accessToken),
        myAnimeListClient.fetchMangaList(accessToken),
      ]);

      const normalizedItems = [...animeItems, ...mangaItems].map(normalizeMyAnimeListImportItem);

      if (!persistence.upsertOtakuMediaEntry || !persistence.touchPlatformIntegrationLastSyncAt) {
        throw createIntegrationError(
          'myanimelist',
          503,
          'misconfigured',
          'Importação MyAnimeList indisponível no runtime atual.',
        );
      }

      for (const item of normalizedItems) {
        await persistence.upsertOtakuMediaEntry(userId, item);
      }

      await persistence.touchPlatformIntegrationLastSyncAt(userId, 'MYANIMELIST', new Date());

      return {
        imported: normalizedItems.length,
        anime: animeItems.length,
        manga: mangaItems.length,
        message: `${normalizedItems.length} itens MyAnimeList importados de forma privada.`,
      };
    },
  };
}

export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof Error && error.name === 'IntegrationError';
}
