import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
vi.mock('@/infra/cache/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

import axios from 'axios';
import { redis } from '@/infra/cache/redis';
import {
  createPrismaIntegrationsPersistence,
  createIntegrationsService,
  mapMyAnimeListStatus,
} from '@/core/services/integrations.service';
import { protectSensitiveToken } from '@/config/protected-token';
import { IntegrationError } from '@/infra/integrations/integration.errors';
import { epicService } from '@/infra/integrations/epic/epic.service';
import { igdbService } from '@/infra/integrations/igdb/igdb.service';
import { steamService } from '@/infra/integrations/steam/steam.service';
import { prisma } from '@/infra/database/client';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    platformIntegration: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    userGameLibrary: {
      upsert: vi.fn(),
    },
    mediaTitle: {
      upsert: vi.fn(),
    },
    userMediaEntry: {
      upsert: vi.fn(),
    },
  },
}));

const originalEnv = { ...process.env };

const mockSteamGames = [
  { appid: 730, name: 'Counter-Strike 2', playtime_forever: 6000, img_icon_url: '' },
  { appid: 570, name: 'Dota 2', playtime_forever: 1200, img_icon_url: '' },
];

const mockEpicGames = [
  { id: 'fortnite', title: 'Fortnite', namespace: 'fn', coverUrl: null },
];

describe('integrations service layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapeia status MyAnimeList para status de consumo CLUTCH', () => {
    expect(mapMyAnimeListStatus('watching')).toBe('CONSUMING');
    expect(mapMyAnimeListStatus('reading')).toBe('CONSUMING');
    expect(mapMyAnimeListStatus('completed')).toBe('COMPLETED');
    expect(mapMyAnimeListStatus('plan_to_watch')).toBe('PLANNING');
    expect(mapMyAnimeListStatus('plan_to_read')).toBe('PLANNING');
    expect(mapMyAnimeListStatus('on_hold')).toBe('PAUSED');
    expect(mapMyAnimeListStatus('dropped')).toBe('DROPPED');
  });

  it('importa listas MyAnimeList conectadas e persiste entradas otaku privadas', async () => {
    const syncedAt = new Date('2026-04-30T16:30:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(syncedAt);
    const persistence = {
      upsertPlatformIntegration: vi.fn(),
      findPlatformIntegration: vi.fn().mockResolvedValue({
        externalId: '12345',
        status: 'CONNECTED',
        dataSource: 'OFFICIAL',
        accessToken: protectSensitiveToken('mal-access-token'),
      }),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn(),
      upsertOtakuMediaEntry: vi.fn().mockResolvedValue(undefined),
      touchPlatformIntegrationLastSyncAt: vi.fn().mockResolvedValue(undefined),
    };
    const myAnimeListClient = {
      fetchAnimeList: vi.fn().mockResolvedValue([
        {
          id: '5114',
          title: 'Fullmetal Alchemist: Brotherhood',
          kind: 'ANIME',
          coverUrl: 'https://cdn.mal/anime.jpg',
          status: 'completed',
          progress: 64,
          score: 10,
        },
      ]),
      fetchMangaList: vi.fn().mockResolvedValue([
        {
          id: '2',
          title: 'Berserk',
          kind: 'MANGA',
          coverUrl: null,
          status: 'reading',
          progress: 12,
          score: 0,
        },
      ]),
    };
    const service = createIntegrationsService({
      steamClient: { validateSteamId: vi.fn(), getOwnedGames: vi.fn() },
      igdbClient: { searchGame: vi.fn(), searchGames: vi.fn() },
      epicClient: { validateToken: vi.fn(), getLibrary: vi.fn() },
      myAnimeListClient,
      persistence,
    });

    const result = await service.importMyAnimeListLists('user-id-1');

    expect(result).toEqual({
      imported: 2,
      anime: 1,
      manga: 1,
      message: '2 itens MyAnimeList importados de forma privada.',
    });
    expect(myAnimeListClient.fetchAnimeList).toHaveBeenCalledWith('mal-access-token');
    expect(myAnimeListClient.fetchMangaList).toHaveBeenCalledWith('mal-access-token');
    expect(persistence.upsertOtakuMediaEntry).toHaveBeenNthCalledWith(1, 'user-id-1', {
      externalId: '5114',
      title: 'Fullmetal Alchemist: Brotherhood',
      kind: 'ANIME',
      coverUrl: 'https://cdn.mal/anime.jpg',
      status: 'COMPLETED',
      progress: 64,
      score: 10,
    });
    expect(persistence.upsertOtakuMediaEntry).toHaveBeenNthCalledWith(2, 'user-id-1', {
      externalId: '2',
      title: 'Berserk',
      kind: 'MANGA',
      coverUrl: null,
      status: 'CONSUMING',
      progress: 12,
      score: 0,
    });
    expect(persistence.touchPlatformIntegrationLastSyncAt).toHaveBeenCalledWith(
      'user-id-1',
      'MYANIMELIST',
      syncedAt,
    );
  });

  it('bloqueia importacao MyAnimeList quando conta precisa reconectar ou token esta ausente', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn(),
      findPlatformIntegration: vi.fn()
        .mockResolvedValueOnce({
          externalId: '12345',
          status: 'NEEDS_REAUTH',
          dataSource: 'OFFICIAL',
          accessToken: protectSensitiveToken('mal-access-token'),
        })
        .mockResolvedValueOnce({
          externalId: '12345',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          accessToken: null,
        }),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn(),
      upsertOtakuMediaEntry: vi.fn(),
      touchPlatformIntegrationLastSyncAt: vi.fn(),
    };
    const service = createIntegrationsService({
      steamClient: { validateSteamId: vi.fn(), getOwnedGames: vi.fn() },
      igdbClient: { searchGame: vi.fn(), searchGames: vi.fn() },
      epicClient: { validateToken: vi.fn(), getLibrary: vi.fn() },
      myAnimeListClient: { fetchAnimeList: vi.fn(), fetchMangaList: vi.fn() },
      persistence,
    });

    await expect(service.importMyAnimeListLists('user-id-1')).rejects.toMatchObject({
      statusCode: 409,
      reason: 'reauth_required',
    });
    await expect(service.importMyAnimeListLists('user-id-1')).rejects.toMatchObject({
      statusCode: 409,
      reason: 'reauth_required',
    });
    expect(persistence.upsertOtakuMediaEntry).not.toHaveBeenCalled();
  });

  it('bloqueia importacao MyAnimeList quando token criptografado esta invalido', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn(),
      findPlatformIntegration: vi.fn().mockResolvedValue({
        externalId: '12345',
        status: 'CONNECTED',
        dataSource: 'OFFICIAL',
        accessToken: 'enc:v1:invalid:protected:token',
      }),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn(),
      upsertOtakuMediaEntry: vi.fn(),
      touchPlatformIntegrationLastSyncAt: vi.fn(),
    };
    const myAnimeListClient = {
      fetchAnimeList: vi.fn(),
      fetchMangaList: vi.fn(),
    };
    const service = createIntegrationsService({
      steamClient: { validateSteamId: vi.fn(), getOwnedGames: vi.fn() },
      igdbClient: { searchGame: vi.fn(), searchGames: vi.fn() },
      epicClient: { validateToken: vi.fn(), getLibrary: vi.fn() },
      myAnimeListClient,
      persistence,
    });

    await expect(service.importMyAnimeListLists('user-id-1')).rejects.toMatchObject({
      statusCode: 409,
      reason: 'reauth_required',
      clientMessage: 'Reconecte o MyAnimeList antes de importar listas.',
    });
    expect(myAnimeListClient.fetchAnimeList).not.toHaveBeenCalled();
    expect(persistence.upsertOtakuMediaEntry).not.toHaveBeenCalled();
  });

  it('persiste MediaTitle e UserMediaEntry via upsert sem expor payload bruto', async () => {
    vi.mocked(prisma.mediaTitle.upsert).mockResolvedValue({
      id: 'media-title-id',
      kind: 'ANIME',
      canonicalTitle: 'Sousou no Frieren',
      coverUrl: 'https://cdn.mal/frieren.jpg',
      externalSource: 'MYANIMELIST',
      externalId: '52991',
      createdAt: new Date('2026-04-30T16:00:00.000Z'),
      updatedAt: new Date('2026-04-30T16:00:00.000Z'),
    });
    vi.mocked(prisma.userMediaEntry.upsert).mockResolvedValue({
      id: 'entry-id',
      userId: 'user-id-1',
      mediaTitleId: 'media-title-id',
      status: 'CONSUMING',
      progress: 4,
      score: 9,
      showcaseRank: null,
      createdAt: new Date('2026-04-30T16:00:00.000Z'),
      updatedAt: new Date('2026-04-30T16:00:00.000Z'),
    });
    const persistence = createPrismaIntegrationsPersistence();
    expect(persistence.upsertOtakuMediaEntry).toBeDefined();

    await persistence.upsertOtakuMediaEntry?.('user-id-1', {
      externalId: '52991',
      title: 'Sousou no Frieren',
      kind: 'ANIME',
      coverUrl: 'https://cdn.mal/frieren.jpg',
      status: 'CONSUMING',
      progress: 4,
      score: 9,
    });

    expect(prisma.mediaTitle.upsert).toHaveBeenCalledWith({
      where: {
        externalSource_externalId_kind: {
          externalSource: 'MYANIMELIST',
          externalId: '52991',
          kind: 'ANIME',
        },
      },
      create: expect.objectContaining({
        externalSource: 'MYANIMELIST',
        externalId: '52991',
      }),
      update: {
        canonicalTitle: 'Sousou no Frieren',
        coverUrl: 'https://cdn.mal/frieren.jpg',
      },
    });
    expect(prisma.userMediaEntry.upsert).toHaveBeenCalledWith({
      where: {
        userId_mediaTitleId: {
          userId: 'user-id-1',
          mediaTitleId: 'media-title-id',
        },
      },
      create: expect.objectContaining({
        showcaseRank: null,
        progress: 4,
        score: 9,
      }),
      update: {
        status: 'CONSUMING',
        progress: 4,
        score: 9,
      },
    });
    expect(JSON.stringify(vi.mocked(prisma.userMediaEntry.upsert).mock.calls)).not.toContain('access-token');
  });

  it('usa chave externa composta para evitar duplicidade e colisao entre anime e manga com mesmo MAL id', async () => {
    vi.mocked(prisma.mediaTitle.upsert)
      .mockResolvedValueOnce({
        id: 'anime-media-title-id',
        kind: 'ANIME',
        canonicalTitle: 'Shared MAL Id Anime',
        coverUrl: null,
        externalSource: 'MYANIMELIST',
        externalId: '100',
        createdAt: new Date('2026-04-30T16:00:00.000Z'),
        updatedAt: new Date('2026-04-30T16:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'manga-media-title-id',
        kind: 'MANGA',
        canonicalTitle: 'Shared MAL Id Manga',
        coverUrl: null,
        externalSource: 'MYANIMELIST',
        externalId: '100',
        createdAt: new Date('2026-04-30T16:00:00.000Z'),
        updatedAt: new Date('2026-04-30T16:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'anime-media-title-id',
        kind: 'ANIME',
        canonicalTitle: 'Shared MAL Id Anime',
        coverUrl: null,
        externalSource: 'MYANIMELIST',
        externalId: '100',
        createdAt: new Date('2026-04-30T16:00:00.000Z'),
        updatedAt: new Date('2026-04-30T16:00:00.000Z'),
      });
    vi.mocked(prisma.userMediaEntry.upsert).mockResolvedValue({
      id: 'entry-id',
      userId: 'user-id-1',
      mediaTitleId: 'anime-media-title-id',
      status: 'CONSUMING',
      progress: 1,
      score: null,
      showcaseRank: null,
      createdAt: new Date('2026-04-30T16:00:00.000Z'),
      updatedAt: new Date('2026-04-30T16:00:00.000Z'),
    });
    const persistence = createPrismaIntegrationsPersistence();

    await persistence.upsertOtakuMediaEntry?.('user-id-1', {
      externalId: '100',
      title: 'Shared MAL Id Anime',
      kind: 'ANIME',
      coverUrl: null,
      status: 'CONSUMING',
      progress: 1,
      score: null,
    });
    await persistence.upsertOtakuMediaEntry?.('user-id-1', {
      externalId: '100',
      title: 'Shared MAL Id Manga',
      kind: 'MANGA',
      coverUrl: null,
      status: 'PLANNING',
      progress: 0,
      score: null,
    });
    await persistence.upsertOtakuMediaEntry?.('user-id-1', {
      externalId: '100',
      title: 'Shared MAL Id Anime',
      kind: 'ANIME',
      coverUrl: null,
      status: 'COMPLETED',
      progress: 12,
      score: 8,
    });

    expect(prisma.mediaTitle.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          externalSource_externalId_kind: {
            externalSource: 'MYANIMELIST',
            externalId: '100',
            kind: 'ANIME',
          },
        },
      }),
    );
    expect(prisma.mediaTitle.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          externalSource_externalId_kind: {
            externalSource: 'MYANIMELIST',
            externalId: '100',
            kind: 'MANGA',
          },
        },
      }),
    );
    expect(prisma.mediaTitle.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          externalSource_externalId_kind: {
            externalSource: 'MYANIMELIST',
            externalId: '100',
            kind: 'ANIME',
          },
        },
      }),
    );
    expect(prisma.userMediaEntry.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId_mediaTitleId: {
            userId: 'user-id-1',
            mediaTitleId: 'anime-media-title-id',
          },
        },
      }),
    );
    expect(prisma.userMediaEntry.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId_mediaTitleId: {
            userId: 'user-id-1',
            mediaTitleId: 'manga-media-title-id',
          },
        },
      }),
    );
    expect(prisma.userMediaEntry.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          userId_mediaTitleId: {
            userId: 'user-id-1',
            mediaTitleId: 'anime-media-title-id',
          },
        },
        create: expect.objectContaining({
          showcaseRank: null,
        }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it('importa biblioteca Steam e tolera falha do IGDB como enriquecimento opcional', async () => {
    const steamClient = {
      validateSteamId: vi.fn().mockResolvedValue(true),
      getOwnedGames: vi.fn().mockResolvedValue(mockSteamGames),
    };
    const persistence = {
      upsertPlatformIntegration: vi.fn().mockResolvedValue(undefined),
      findPlatformIntegration: vi.fn(),
      upsertSteamLibraryGame: vi.fn().mockResolvedValue(undefined),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient,
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn()
          .mockResolvedValueOnce({
            id: 730,
            name: 'Counter-Strike 2',
            coverUrl: 'https://cdn.example/cs2.jpg',
            platforms: ['PC'],
            summary: null,
          })
          .mockRejectedValueOnce(new Error('IGDB offline')),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    const result = await service.connectSteam('user-id-1', ' 76561198000000000 ');

    expect(result).toMatchObject({
      imported: 2,
      message: 'Steam conectado. 2 jogos importados.',
    });
    expect(steamClient.validateSteamId).toHaveBeenCalledWith('76561198000000000');
    expect(steamClient.getOwnedGames).toHaveBeenCalledWith('76561198000000000');
    expect(persistence.upsertPlatformIntegration).toHaveBeenCalledWith(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000', dataSource: 'MANUAL' },
    );
    expect(persistence.upsertSteamLibraryGame).toHaveBeenNthCalledWith(
      1,
      'user-id-1',
      mockSteamGames[0],
      'https://cdn.example/cs2.jpg',
    );
    expect(persistence.upsertSteamLibraryGame).toHaveBeenNthCalledWith(
      2,
      'user-id-1',
      mockSteamGames[1],
      null,
    );
  });

  it('mantem conexao Steam quando importacao inicial da biblioteca falha', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const steamClient = {
      validateSteamId: vi.fn().mockResolvedValue(true),
      getOwnedGames: vi.fn().mockRejectedValue(
        new IntegrationError(
          'steam',
          503,
          'upstream_unavailable',
          'Integração Steam indisponível no momento.',
        ),
      ),
    };
    const persistence = {
      upsertPlatformIntegration: vi.fn().mockResolvedValue(undefined),
      findPlatformIntegration: vi.fn(),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient,
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    const result = await service.connectSteam('user-id-1', '76561198000000000');

    expect(result).toMatchObject({
      imported: 0,
      message: 'Steam conectado. Biblioteca indisponivel no momento; tente sincronizar novamente mais tarde.',
    });
    expect(persistence.upsertPlatformIntegration).toHaveBeenCalledWith(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000', dataSource: 'MANUAL' },
    );
    expect(persistence.upsertSteamLibraryGame).not.toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"integration_steam_library_import_skipped"'),
    );

    stdoutWriteSpy.mockRestore();
  });

  it('preserva ownership oficial quando fallback manual usa o mesmo SteamID verificado', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn().mockResolvedValue(undefined),
      findPlatformIntegration: vi.fn().mockResolvedValue({
        externalId: '76561198000000000',
        dataSource: 'OFFICIAL',
        accessToken: null,
      }),
      upsertSteamLibraryGame: vi.fn().mockResolvedValue(undefined),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn().mockResolvedValue(true),
        getOwnedGames: vi.fn().mockResolvedValue([]),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    await service.connectSteam('user-id-1', '76561198000000000');

    expect(persistence.upsertPlatformIntegration).toHaveBeenCalledWith(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000', dataSource: 'OFFICIAL' },
    );
  });

  it('bloqueia fallback manual que trocaria uma Steam oficial verificada', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn(),
      findPlatformIntegration: vi.fn().mockResolvedValue({
        externalId: '76561198000000000',
        dataSource: 'OFFICIAL',
        accessToken: null,
      }),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn().mockResolvedValue(true),
        getOwnedGames: vi.fn(),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    await expect(
      service.connectSteam('user-id-1', '76561198000000001'),
    ).rejects.toMatchObject({
      statusCode: 409,
      reason: 'conflict',
    });
    expect(persistence.upsertPlatformIntegration).not.toHaveBeenCalled();
  });

  it('traduz Steam nao conectado na sincronizacao', async () => {
    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn(),
        getOwnedGames: vi.fn(),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence: {
        upsertPlatformIntegration: vi.fn(),
        findPlatformIntegration: vi.fn().mockResolvedValue(null),
        upsertSteamLibraryGame: vi.fn(),
        upsertEpicLibraryGame: vi.fn(),
      },
    });

    await expect(service.syncSteamLibrary('user-id-1')).rejects.toMatchObject({
      statusCode: 404,
      reason: 'not_connected',
    });
  });

  it('sincroniza Steam tentando manter capas enriquecidas disponiveis', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn(),
      findPlatformIntegration: vi.fn().mockResolvedValue({
        externalId: '76561198000000000',
        dataSource: 'MANUAL',
      }),
      upsertSteamLibraryGame: vi.fn().mockResolvedValue(undefined),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn(),
        getOwnedGames: vi.fn().mockResolvedValue(mockSteamGames),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn()
          .mockResolvedValueOnce({
            id: 730,
            name: 'Counter-Strike 2',
            coverUrl: 'https://cdn.example/cs2.jpg',
            platforms: ['PC'],
            summary: null,
          })
          .mockResolvedValueOnce(null),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    const result = await service.syncSteamLibrary('user-id-1');

    expect(result).toMatchObject({
      synced: 2,
      message: '2 jogos sincronizados.',
    });
    expect(persistence.upsertSteamLibraryGame).toHaveBeenNthCalledWith(
      1,
      'user-id-1',
      mockSteamGames[0],
      'https://cdn.example/cs2.jpg',
    );
    expect(persistence.upsertSteamLibraryGame).toHaveBeenNthCalledWith(
      2,
      'user-id-1',
      mockSteamGames[1],
      null,
    );
  });

  it('marca Epic como indisponivel quando o adapter nao existe no runtime atual', async () => {
    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn(),
        getOwnedGames: vi.fn(),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn().mockRejectedValue(
          new IntegrationError(
            'epic',
            503,
            'unsupported',
            'Integração Epic indisponível no runtime atual.',
          ),
        ),
        getLibrary: vi.fn(),
      },
      persistence: {
        upsertPlatformIntegration: vi.fn(),
        findPlatformIntegration: vi.fn(),
        upsertSteamLibraryGame: vi.fn(),
        upsertEpicLibraryGame: vi.fn(),
      },
    });

    await expect(service.connectEpic('user-id-1', 'epic-token')).rejects.toMatchObject({
      statusCode: 503,
      reason: 'unsupported',
    });
  });

  it('retorna resultado de sucesso para Epic quando o adapter responde', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn().mockResolvedValue(undefined),
      findPlatformIntegration: vi.fn(),
      upsertSteamLibraryGame: vi.fn(),
      upsertEpicLibraryGame: vi.fn().mockResolvedValue(undefined),
    };

    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn(),
        getOwnedGames: vi.fn(),
      },
      igdbClient: {
        searchGames: vi.fn(),
        searchGame: vi.fn(),
      },
      epicClient: {
        validateToken: vi.fn().mockResolvedValue(true),
        getLibrary: vi.fn().mockResolvedValue(mockEpicGames),
      },
      persistence,
    });

    const result = await service.connectEpic('user-id-1', 'valid-token');

    expect(result).toMatchObject({
      imported: 1,
      message: 'Epic conectado. 1 jogos importados.',
    });
    expect(persistence.upsertPlatformIntegration).toHaveBeenCalledWith(
      'user-id-1',
      'EPIC',
      {
        externalId: expect.stringMatching(/^epic:[a-f0-9]{64}$/u),
        accessToken: 'valid-token',
        dataSource: 'EXPERIMENTAL',
      },
    );
  });
});

describe('igdbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      IGDB_CLIENT_ID: 'test-client',
      IGDB_CLIENT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('renova token quando Redis miss e retorna jogo', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.setex).mockResolvedValue('OK');

    vi.mocked(axios.post)
      .mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600, token_type: 'bearer' },
      } as never)
      .mockResolvedValueOnce({
        data: [{
          id: 1234,
          name: 'Valorant',
          cover: { id: 1, url: '//images.igdb.com/igdb/image/upload/t_thumb/test.jpg' },
          platforms: [{ name: 'PC (Microsoft Windows)' }],
          summary: 'Tactical shooter',
        }],
      } as never);

    const result = await igdbService.searchGame('Valorant');

    expect(result?.name).toBe('Valorant');
    expect(result?.coverUrl).toContain('t_cover_big');
  });

  it('retorna multiplos candidatos quando a consulta e ambigua', async () => {
    vi.mocked(redis.get).mockResolvedValue('cached-token');
    vi.mocked(axios.post).mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'DOOM',
          cover: { id: 1, url: '//images.igdb.com/igdb/image/upload/t_thumb/doom.jpg' },
          platforms: [{ name: 'PC' }],
          summary: 'Classic shooter',
        },
        {
          id: 2,
          name: 'DOOM Eternal',
          cover: { id: 2, url: '//images.igdb.com/igdb/image/upload/t_thumb/doom-eternal.jpg' },
          platforms: [{ name: 'PC' }, { name: 'PlayStation 5' }],
          summary: 'Modern shooter',
        },
      ],
    } as never);

    const result = await igdbService.searchGames('DOOM', 5);

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('DOOM');
    expect(result[1]?.name).toBe('DOOM Eternal');
  });

  it('traduz timeout do IGDB para erro coerente', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(redis.get).mockResolvedValue('cached-token');
    vi.mocked(axios.post).mockRejectedValue({ code: 'ECONNABORTED' });

    await expect(igdbService.searchGame('Hades')).rejects.toMatchObject({
      statusCode: 504,
      reason: 'timeout',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_igdb_timeout"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"provider":"igdb"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"reason":"timeout"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('test-secret');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('Authorization');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('https://');
    stdoutWriteSpy.mockRestore();
  });
});

describe('createPrismaIntegrationsPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserva a cover existente da Steam quando a sincronizacao nao encontra imagem confiavel', async () => {
    vi.mocked(prisma.userGameLibrary.upsert).mockResolvedValue({} as never);
    const persistence = createPrismaIntegrationsPersistence();

    await persistence.upsertSteamLibraryGame(
      'user-id-1',
      mockSteamGames[0]!,
      null,
    );

    expect(prisma.userGameLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          hoursPlayed: mockSteamGames[0]!.playtime_forever / 60,
        },
      }),
    );
  });

  it('preserva a cover existente da Epic quando o adapter retorna cover nula', async () => {
    vi.mocked(prisma.userGameLibrary.upsert).mockResolvedValue({} as never);
    const persistence = createPrismaIntegrationsPersistence();

    await persistence.upsertEpicLibraryGame('user-id-1', mockEpicGames[0]!);

    expect(prisma.userGameLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          gameName: mockEpicGames[0]!.title,
        },
      }),
    );
  });

  it('traduz conflito global de identidade externa para erro de dominio', async () => {
    vi.mocked(prisma.platformIntegration.findUnique).mockResolvedValueOnce({
      id: 'integration-id-1',
      userId: 'other-user-id',
      platform: 'STEAM',
      externalId: '76561198000000000',
      status: 'CONNECTED',
    } as never);
    const persistence = createPrismaIntegrationsPersistence();

    await expect(persistence.upsertPlatformIntegration(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000' },
    )).rejects.toMatchObject({
      statusCode: 409,
      reason: 'conflict',
    });

    expect(prisma.platformIntegration.upsert).not.toHaveBeenCalled();
  });

  it('persiste Steam manual via connected account foundation com dataSource manual', async () => {
    vi.mocked(prisma.platformIntegration.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.platformIntegration.upsert).mockResolvedValue({
      id: 'integration-id-1',
      userId: 'user-id-1',
      platform: 'STEAM',
      externalId: '76561198000000000',
      connectionType: 'CONNECTED_ACCOUNT',
      status: 'CONNECTED',
      dataSource: 'MANUAL',
      metadata: null,
      publicProfileVisible: false,
      createdAt: new Date('2026-04-29T00:00:00.000Z'),
      updatedAt: new Date('2026-04-29T00:00:00.000Z'),
      lastSyncAt: new Date('2026-04-29T00:00:00.000Z'),
    } as never);
    const persistence = createPrismaIntegrationsPersistence();

    await persistence.upsertPlatformIntegration(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000', dataSource: 'MANUAL' },
    );

    expect(prisma.platformIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-id-1',
          platform: 'STEAM',
          externalId: '76561198000000000',
          connectionType: 'CONNECTED_ACCOUNT',
          status: 'CONNECTED',
          dataSource: 'MANUAL',
        }),
      }),
    );
  });
});

describe('steamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      STEAM_API_KEY: 'steam-key',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('retorna biblioteca quando Steam responde', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        response: {
          game_count: 2,
          games: mockSteamGames,
        },
      },
    } as never);

    const games = await steamService.getOwnedGames('76561198000000000');

    expect(games).toHaveLength(2);
  });

  it('trata biblioteca Steam privada ou indisponivel como lista vazia', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        response: {},
      },
    } as never);

    const games = await steamService.getOwnedGames('76561198000000000');

    expect(games).toEqual([]);
  });

  it('traduz timeout da Steam para erro coerente', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(axios.get).mockRejectedValue({ code: 'ECONNABORTED' });

    await expect(steamService.getOwnedGames('76561198000000000')).rejects.toMatchObject({
      statusCode: 504,
      reason: 'timeout',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_steam_timeout"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"provider":"steam"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('steam-key');
    stdoutWriteSpy.mockRestore();
  });
});

describe('epicService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('marca integracao como indisponivel quando a URL e placeholder do runtime antigo', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env = {
      ...originalEnv,
      EPIC_SERVICE_URL: 'http://localhost:8000',
    };

    await expect(epicService.validateToken('valid-token')).rejects.toMatchObject({
      statusCode: 503,
      reason: 'unsupported',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_epic_unavailable"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"reason":"unsupported"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('valid-token');
    stdoutWriteSpy.mockRestore();
  });

  it('rejeita URL invalida do adapter Epic de forma explicita', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env = {
      ...originalEnv,
      EPIC_SERVICE_URL: 'not-a-valid-url',
    };

    await expect(epicService.validateToken('valid-token')).rejects.toMatchObject({
      statusCode: 503,
      reason: 'misconfigured',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_epic_unavailable"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"reason":"misconfigured"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('not-a-valid-url');
    stdoutWriteSpy.mockRestore();
  });

  it('traduz timeout do adapter Epic configurado', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env = {
      ...originalEnv,
      EPIC_SERVICE_URL: 'https://epic-adapter.example.com',
    };
    vi.mocked(axios.get).mockRejectedValue({ code: 'ECONNABORTED' });

    await expect(epicService.getLibrary('valid-token')).rejects.toMatchObject({
      statusCode: 504,
      reason: 'timeout',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_epic_timeout"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"provider":"epic"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('valid-token');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('https://epic-adapter.example.com');
    stdoutWriteSpy.mockRestore();
  });

  it('retorna biblioteca quando o adapter externo responde', async () => {
    process.env = {
      ...originalEnv,
      EPIC_SERVICE_URL: 'https://epic-adapter.example.com',
    };
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        games: mockEpicGames,
      },
    } as never);

    const games = await epicService.getLibrary('valid-token');

    expect(games).toHaveLength(1);
  });
});
