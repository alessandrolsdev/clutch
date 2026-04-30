import axios from 'axios';
import {
  createIntegrationError,
  translateUpstreamError,
} from '../integration.errors';

// ─────────────────────────────────────────────────────────────
// Steam Service — biblioteca e horas jogadas
// ─────────────────────────────────────────────────────────────

const STEAM_BASE_URL = 'https://api.steampowered.com';
const STEAM_TIMEOUT_MS = 10_000;

function resolveSteamApiKey(): string {
  const apiKey = process.env['STEAM_API_KEY']?.trim();

  if (!apiKey) {
    throw createIntegrationError(
      'steam',
      503,
      'misconfigured',
      'Integração Steam indisponível no runtime atual.',
    );
  }

  return apiKey;
}

export interface SteamGame {
  appid:            number;
  name:             string;
  playtime_forever: number;
  img_icon_url:     string;
}

export interface SteamPlayerSummary {
  steamid:      string;
  personaname:  string;
  profileurl:   string;
  avatarfull:   string;
  personastate: number;
  gameid?:      string;
  gameextrainfo?: string;
}

export const steamService = {

  async getOwnedGames(steamId: string): Promise<SteamGame[]> {
    try {
      const response = await axios.get<{
        response?: {
          game_count: number;
          games:      SteamGame[];
        };
      }>(
        `${STEAM_BASE_URL}/IPlayerService/GetOwnedGames/v1/`,
        {
          params: {
            key: resolveSteamApiKey(),
            steamid: steamId,
            include_appinfo: true,
            include_played_free_games: true,
          },
          timeout: STEAM_TIMEOUT_MS,
        },
      );

      return response.data.response?.games ?? [];
    } catch (error) {
      throw translateUpstreamError(
        'steam',
        error,
        'Integração Steam indisponível no momento.',
        { targetUrl: STEAM_BASE_URL },
      );
    }
  },

  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    try {
      const response = await axios.get<{
        response: { players: SteamPlayerSummary[] };
      }>(
        `${STEAM_BASE_URL}/ISteamUser/GetPlayerSummaries/v2/`,
        {
          params: {
            key: resolveSteamApiKey(),
            steamids: steamId,
          },
          timeout: STEAM_TIMEOUT_MS,
        },
      );

      return response.data.response.players[0] ?? null;
    } catch (error) {
      throw translateUpstreamError(
        'steam',
        error,
        'Integração Steam indisponível no momento.',
        { targetUrl: STEAM_BASE_URL },
      );
    }
  },

  async validateSteamId(steamId: string): Promise<boolean> {
    const player = await steamService.getPlayerSummary(steamId);
    return player !== null;
  },

};
