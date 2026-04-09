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
  createIntegrationsService,
} from '@/core/services/integrations.service';
import { IntegrationError } from '@/infra/integrations/integration.errors';
import { epicService } from '@/infra/integrations/epic/epic.service';
import { igdbService } from '@/infra/integrations/igdb/igdb.service';
import { steamService } from '@/infra/integrations/steam/steam.service';

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

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('importa biblioteca Steam e tolera falha do IGDB como enriquecimento opcional', async () => {
    const persistence = {
      upsertPlatformIntegration: vi.fn().mockResolvedValue(undefined),
      findPlatformIntegration: vi.fn(),
      upsertSteamLibraryGame: vi.fn().mockResolvedValue(undefined),
      upsertEpicLibraryGame: vi.fn(),
    };

    const service = createIntegrationsService({
      steamClient: {
        validateSteamId: vi.fn().mockResolvedValue(true),
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
          .mockRejectedValueOnce(new Error('IGDB offline')),
      },
      epicClient: {
        validateToken: vi.fn(),
        getLibrary: vi.fn(),
      },
      persistence,
    });

    const result = await service.connectSteam('user-id-1', '76561198000000000');

    expect(result).toMatchObject({
      imported: 2,
      message: 'Steam conectado. 2 jogos importados.',
    });
    expect(persistence.upsertPlatformIntegration).toHaveBeenCalledWith(
      'user-id-1',
      'STEAM',
      { externalId: '76561198000000000' },
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
      { externalId: 'epic', accessToken: 'valid-token' },
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
