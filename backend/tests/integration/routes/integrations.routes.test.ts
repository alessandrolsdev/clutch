import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  createIntegrationError,
  type IntegrationError,
} from '@/infra/integrations/integration.errors';

const createMockIntegrationsService = () => ({
  connectSteam: vi.fn(),
  syncSteamLibrary: vi.fn(),
  searchIgdbGame: vi.fn(),
  connectEpic: vi.fn(),
});

describe('Integrations Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(integrationsService.searchIgdbGame).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna 404 quando jogo nao e encontrado', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.searchIgdbGame.mockResolvedValue(null);
      const app = await buildApp({ integrationsService });

      const response = await app.inject({
        method: 'GET',
        url: '/integrations/igdb/search?q=unknown-game',
      });

      expect(response.statusCode).toBe(404);
      expect(integrationsService.searchIgdbGame).toHaveBeenCalledWith('unknown-game');
      await app.close();
    });

    it('traduz timeout de IGDB para 504', async () => {
      const integrationsService = createMockIntegrationsService();
      integrationsService.searchIgdbGame.mockRejectedValue(
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
});
