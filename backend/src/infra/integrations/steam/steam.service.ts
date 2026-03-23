import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// Steam Service — biblioteca e horas jogadas
// ─────────────────────────────────────────────────────────────

const STEAM_BASE_URL = 'https://api.steampowered.com';

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
    const response = await axios.get<{
      response: {
        game_count: number;
        games:      SteamGame[];
      };
    }>(
      `${STEAM_BASE_URL}/IPlayerService/GetOwnedGames/v1/`,
      {
        params: {
          key:                  process.env['STEAM_API_KEY'],
          steamid:              steamId,
          include_appinfo:      true,
          include_played_free_games: true,
        },
        timeout: 10_000,
      },
    );

    return response.data.response.games ?? [];
  },

  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    const response = await axios.get<{
      response: { players: SteamPlayerSummary[] };
    }>(
      `${STEAM_BASE_URL}/ISteamUser/GetPlayerSummaries/v2/`,
      {
        params: {
          key:      process.env['STEAM_API_KEY'],
          steamids: steamId,
        },
        timeout: 10_000,
      },
    );

    return response.data.response.players[0] ?? null;
  },

  async validateSteamId(steamId: string): Promise<boolean> {
    const player = await steamService.getPlayerSummary(steamId);
    return player !== null;
  },

};