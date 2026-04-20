import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  createIntegrationError,
} from '@/infra/integrations/integration.errors';

const createMockIntegrationsService = () => ({
  connectSteam: vi.fn(),
  syncSteamLibrary: vi.fn(),
  searchIgdbGames: vi.fn(),
  connectEpic: vi.fn(),
});

const createMockDiscordOAuthService = () => ({
  getAuthorizationUrl: vi.fn(),
  completeCallback: vi.fn(),
});

const createMockDiscordPresenceService = () => ({
  ingestPresence: vi.fn(),
});

describe('Integrations Routes', () => {
  const previousDiscordPresenceToken = process.env['DISCORD_PRESENCE_INGEST_TOKEN'];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['DISCORD_PRESENCE_INGEST_TOKEN'] = 'discord-presence-secret';
  });

  afterEach(() => {
    if (typeof previousDiscordPresenceToken === 'string') {
      process.env['DISCORD_PRESENCE_INGEST_TOKEN'] = previousDiscordPresenceToken;
      return;
    }

    delete process.env['DISCORD_PRESENCE_INGEST_TOKEN'];
  });

  describe('POST /integrations/steam/connect', () => {
    it('retorna 401 sem token', async () => {
      const integrationsService = createMockIntegrationsService();
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        payload: { steamId: '76561198000000000' },
      });

      expect(response.statusCode).toBe(401);
      expect(integrationsService.connectSteam).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 400 com body invalido', async () => {
      const integrationsService = createMockIntegrationsService();
      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(integrationsService.connectSteam).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 200 quando o service conecta a Steam', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.connectSteam.mockResolvedValue({
        imported: 2,
        message: 'Steam conectado. 2 jogos importados.',
      });

      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { steamId: '76561198000000000' },
      });

      expect(response.statusCode).toBe(200);
      expect(integrationsService.connectSteam).toHaveBeenCalledWith(
        'user-id-1',
        '76561198000000000',
      );
      expect(response.json()).toMatchObject({
        imported: 2,
      });
      await app.close();
    });
  });

  describe('POST /integrations/steam/sync', () => {
    it('retorna 404 quando Steam nao esta conectada', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.syncSteamLibrary.mockRejectedValue(
        createIntegrationError('steam', 404, 'not_connected', 'Steam não conectado.'),
      );

      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/steam/sync',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      expect(integrationsService.syncSteamLibrary).toHaveBeenCalledWith('user-id-1');
      await app.close();
    });
  });

  describe('GET /integrations/igdb/search', () => {
    it('retorna 400 com query curta', async () => {
      const integrationsService = createMockIntegrationsService();
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=a',
      });

      expect(response.statusCode).toBe(400);
      expect(integrationsService.searchIgdbGames).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna lista vazia quando nenhum candidato e encontrado', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.searchIgdbGames.mockResolvedValue([]);
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=unknown-game',
      });

      expect(response.statusCode).toBe(200);
      expect(integrationsService.searchIgdbGames).toHaveBeenCalledWith('unknown-game');
      expect(response.json()).toEqual({ games: [] });
      await app.close();
    });

    it('retorna multiplos candidatos quando o service encontra correspondencias ambiguas', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.searchIgdbGames.mockResolvedValue([
        {
          id: 1,
          name: 'DOOM',
          coverUrl: null,
          platforms: ['PC'],
          summary: 'Classic shooter',
        },
        {
          id: 2,
          name: 'DOOM Eternal',
          coverUrl: null,
          platforms: ['PC', 'PlayStation 5'],
          summary: 'Modern shooter',
        },
      ]);
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=DOOM',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        games: [
          { name: 'DOOM' },
          { name: 'DOOM Eternal' },
        ],
      });
      await app.close();
    });

    it('traduz timeout de IGDB para 504', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.searchIgdbGames.mockRejectedValue(
        createIntegrationError('igdb', 504, 'timeout', 'Integração IGDB indisponível no momento.'),
      );
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=Hades',
      });

      expect(response.statusCode).toBe(504);
      expect(response.json()).toMatchObject({
        message: 'Integração IGDB indisponível no momento.',
      });
      await app.close();
    });
  });

  describe('POST /integrations/epic/connect', () => {
    it('retorna 400 com body invalido', async () => {
      const integrationsService = createMockIntegrationsService();
      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(integrationsService.connectEpic).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 503 quando a integracao Epic esta indisponivel', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.connectEpic.mockRejectedValue(
        createIntegrationError('epic', 503, 'unsupported', 'Integração Epic indisponível no runtime atual.'),
      );
      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'valid-token' },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        message: 'Integração Epic indisponível no runtime atual.',
      });
      await app.close();
    });

    it('retorna 504 quando o adapter Epic configurado nao responde a tempo', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.connectEpic.mockRejectedValue(
        createIntegrationError('epic', 504, 'timeout', 'Integração Epic indisponível no momento.'),
      );
      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'valid-token' },
      });

      expect(response.statusCode).toBe(504);
      expect(response.json()).toMatchObject({
        message: 'Integração Epic indisponível no momento.',
      });
      await app.close();
    });

    it('retorna 200 quando o service conecta a Epic', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.connectEpic.mockResolvedValue({
        imported: 1,
        message: 'Epic conectado. 1 jogos importados.',
      });

      const app = await buildApp({ integrationsService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/epic/connect',
        headers: { Authorization: `Bearer ${token}` },
        payload: { authToken: 'valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(integrationsService.connectEpic).toHaveBeenCalledWith('user-id-1', 'valid-token');
      await app.close();
    });
  });

  describe('GET /integrations/discord/auth', () => {
    it('retorna 401 sem token', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const app = await buildApp({ integrationsService, discordOAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/discord/auth',
      });

      expect(response.statusCode).toBe(401);
      expect(discordOAuthService.getAuthorizationUrl).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna URL coerente quando o service inicia o OAuth', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      discordOAuthService.getAuthorizationUrl.mockResolvedValue({
        authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=test-client&state=signed-state',
      });

      const app = await buildApp({ integrationsService, discordOAuthService });
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/discord/auth',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(discordOAuthService.getAuthorizationUrl).toHaveBeenCalledWith({
        userId: 'user-id-1',
        requestId: expect.any(String),
      });
      expect(response.json()).toMatchObject({
        authorizationUrl: expect.stringContaining('https://discord.com/oauth2/authorize'),
      });
      await app.close();
    });
  });

  describe('GET /integrations/discord/callback', () => {
    it('retorna 400 quando callback nao traz dados minimos', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const app = await buildApp({ integrationsService, discordOAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/discord/callback',
      });

      expect(response.statusCode).toBe(400);
      expect(discordOAuthService.completeCallback).not.toHaveBeenCalled();
      await app.close();
    });

    it('persiste com sucesso no callback quando o service conclui o OAuth', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      discordOAuthService.completeCallback.mockResolvedValue({
        message: 'Discord conectado com sucesso.',
        platform: 'DISCORD',
        externalId: 'discord-user-id',
        username: 'clutchdiscord',
        globalName: 'Clutch Discord',
      });

      const app = await buildApp({ integrationsService, discordOAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/discord/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(200);
      expect(discordOAuthService.completeCallback).toHaveBeenCalledWith({
        code: 'oauth-code',
        state: 'signed-state',
        providerError: undefined,
        requestId: expect.any(String),
      });
      expect(response.json()).toMatchObject({
        platform: 'DISCORD',
        externalId: 'discord-user-id',
      });
      await app.close();
    });

    it('traduz falha do provedor de forma coerente', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      discordOAuthService.completeCallback.mockRejectedValue(
        createIntegrationError('discord', 400, 'invalid_request', 'Autorização Discord inválida ou expirada.'),
      );

      const app = await buildApp({ integrationsService, discordOAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/discord/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: 'Autorização Discord inválida ou expirada.',
      });
      await app.close();
    });
  });

  describe('POST /integrations/discord/presence', () => {
    it('retorna 503 quando o runtime nao esta configurado para ingestao', async () => {
      delete process.env['DISCORD_PRESENCE_INGEST_TOKEN'];
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const discordPresenceService = createMockDiscordPresenceService();
      const app = await buildApp({ integrationsService, discordOAuthService, discordPresenceService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/discord/presence',
        payload: {
          externalId: 'discord-user-id',
          status: 'ONLINE',
        },
      });

      expect(response.statusCode).toBe(503);
      expect(discordPresenceService.ingestPresence).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 401 quando o segredo interno nao confere', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const discordPresenceService = createMockDiscordPresenceService();
      const app = await buildApp({ integrationsService, discordOAuthService, discordPresenceService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/discord/presence',
        headers: {
          'x-clutch-discord-ingest-token': 'wrong-secret',
        },
        payload: {
          externalId: 'discord-user-id',
          status: 'ONLINE',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(discordPresenceService.ingestPresence).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 400 quando o payload e invalido', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const discordPresenceService = createMockDiscordPresenceService();
      const app = await buildApp({ integrationsService, discordOAuthService, discordPresenceService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/discord/presence',
        headers: {
          'x-clutch-discord-ingest-token': 'discord-presence-secret',
        },
        payload: {
          externalId: '',
          status: 'ONLINE',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(discordPresenceService.ingestPresence).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 200 quando a presenca Discord e ingerida com sucesso', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const discordPresenceService = createMockDiscordPresenceService();
      discordPresenceService.ingestPresence.mockResolvedValue({
        message: 'Presença Discord atualizada.',
        userId: 'user-id-1',
        externalId: 'discord-user-id',
        status: 'IN_GAME',
        platform: 'DISCORD',
        updatedAt: '2026-04-13T18:40:00.000Z',
      });

      const app = await buildApp({ integrationsService, discordOAuthService, discordPresenceService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/discord/presence',
        headers: {
          'x-clutch-discord-ingest-token': 'discord-presence-secret',
        },
        payload: {
          externalId: 'discord-user-id',
          status: 'IN_GAME',
          currentGame: 'Valorant',
          gameDetails: { activityType: 'PLAYING' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(discordPresenceService.ingestPresence).toHaveBeenCalledWith({
        externalId: 'discord-user-id',
        status: 'IN_GAME',
        currentGame: 'Valorant',
        gameDetails: { activityType: 'PLAYING' },
        requestId: expect.any(String),
      });
      expect(response.json()).toMatchObject({
        userId: 'user-id-1',
        platform: 'DISCORD',
      });
      await app.close();
    });

    it('traduz ausencia de vinculo Discord para 404', async () => {
      const integrationsService = createMockIntegrationsService();
      const discordOAuthService = createMockDiscordOAuthService();
      const discordPresenceService = createMockDiscordPresenceService();
      discordPresenceService.ingestPresence.mockRejectedValue(
        createIntegrationError('discord', 404, 'not_connected', 'Conta Discord não vinculada a um usuário CLUTCH.'),
      );

      const app = await buildApp({ integrationsService, discordOAuthService, discordPresenceService });

      const response = await app.inject({
        method: 'POST',
        url: '/integrations/discord/presence',
        headers: {
          'x-clutch-discord-ingest-token': 'discord-presence-secret',
        },
        payload: {
          externalId: 'discord-user-id',
          status: 'ONLINE',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        message: 'Conta Discord não vinculada a um usuário CLUTCH.',
      });
      await app.close();
    });
  });
});
