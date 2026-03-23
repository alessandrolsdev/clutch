import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Mock axios e Redis antes de importar os services
// ─────────────────────────────────────────────────────────────

vi.mock('axios');
vi.mock('@/infra/cache/redis', () => ({
  redis: {
    get:    vi.fn(),
    setex:  vi.fn(),
  },
}));

import axios         from 'axios';
import { redis }     from '@/infra/cache/redis';
import { igdbService }  from '@/infra/integrations/igdb/igdb.service';
import { steamService } from '@/infra/integrations/steam/steam.service';
import { epicService }  from '@/infra/integrations/epic/epic.service';

// ─────────────────────────────────────────────────────────────
// IGDB Service
// ─────────────────────────────────────────────────────────────

describe('igdbService', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('searchGame', () => {
    it('renova token quando Redis miss e retorna jogo', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.setex).mockResolvedValue('OK');

      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          data: { access_token: 'test-token', expires_in: 3600, token_type: 'bearer' },
        })
        .mockResolvedValueOnce({
          data: [{
            id:   1234,
            name: 'Valorant',
            cover: { id: 1, url: '//images.igdb.com/igdb/image/upload/t_thumb/test.jpg' },
            platforms: [{ name: 'PC (Microsoft Windows)' }],
            summary: 'Tactical shooter',
          }],
        });

      const result = await igdbService.searchGame('Valorant');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Valorant');
      expect(result?.coverUrl).toContain('t_cover_big');
    });

    it('usa token do cache Redis quando disponível', async () => {
      vi.mocked(redis.get).mockResolvedValue('cached-token');
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: [{ id: 1, name: 'CS2', platforms: [], summary: null }],
      });

      await igdbService.searchGame('CS2');

      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('retorna null quando jogo não encontrado', async () => {
      vi.mocked(redis.get).mockResolvedValue('cached-token');
      vi.mocked(axios.post).mockResolvedValueOnce({ data: [] });

      const result = await igdbService.searchGame('jogo-inexistente-xyz');

      expect(result).toBeNull();
    });
  });

});

// ─────────────────────────────────────────────────────────────
// Steam Service
// ─────────────────────────────────────────────────────────────

describe('steamService', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('getOwnedGames', () => {
    it('retorna biblioteca quando SteamID é válido', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          response: {
            game_count: 2,
            games: [
              { appid: 730,  name: 'Counter-Strike 2',    playtime_forever: 6000, img_icon_url: '' },
              { appid: 570,  name: 'Dota 2',              playtime_forever: 1200, img_icon_url: '' },
            ],
          },
        },
      });

      const games = await steamService.getOwnedGames('76561198000000000');

      expect(games).toHaveLength(2);
      expect(games[0]?.name).toBe('Counter-Strike 2');
    });

    it('retorna array vazio quando perfil não tem jogos', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { response: { game_count: 0 } },
      });

      const games = await steamService.getOwnedGames('76561198000000000');

      expect(games).toEqual([]);
    });
  });

  describe('validateSteamId', () => {
    it('retorna true quando SteamID é válido', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          response: {
            players: [{ steamid: '76561198000000000', personaname: 'player' }],
          },
        },
      });

      const result = await steamService.validateSteamId('76561198000000000');

      expect(result).toBe(true);
    });

    it('retorna false quando SteamID é inválido', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { response: { players: [] } },
      });

      const result = await steamService.validateSteamId('steamid-invalido');

      expect(result).toBe(false);
    });
  });

});

// ─────────────────────────────────────────────────────────────
// Epic Service
// ─────────────────────────────────────────────────────────────

describe('epicService', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('getLibrary', () => {
    it('retorna biblioteca quando Python service responde', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          games: [
            { id: 'fortnite', title: 'Fortnite', namespace: 'fn', coverUrl: null },
            { id: 'rocket',   title: 'Rocket League', namespace: 'rl', coverUrl: null },
          ],
        },
      });

      const games = await epicService.getLibrary('valid-token');

      expect(games).toHaveLength(2);
      expect(games[0]?.title).toBe('Fortnite');
    });
  });

  describe('validateToken', () => {
    it('retorna true quando token é válido', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { valid: true } });

      const result = await epicService.validateToken('valid-token');

      expect(result).toBe(true);
    });

    it('retorna false quando token é inválido', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Unauthorized'));

      const result = await epicService.validateToken('invalid-token');

      expect(result).toBe(false);
    });
  });

});