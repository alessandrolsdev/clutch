import axios from 'axios';
import { redis } from '../../cache/redis';

// ─────────────────────────────────────────────────────────────
// IGDB Service — Twitch OAuth + game metadata
// ─────────────────────────────────────────────────────────────

const IGDB_BASE_URL  = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TOKEN_REDIS_KEY  = 'igdb:token';

interface TwitchTokenResponse {
  access_token: string;
  expires_in:   number;
  token_type:   string;
}

export interface IgdbGame {
  id:       number;
  name:     string;
  coverUrl: string | null;
  platforms: string[];
  summary:  string | null;
}

async function getAccessToken(): Promise<string> {
  const cached = await redis.get(TOKEN_REDIS_KEY);
  if (cached) return cached;

  const response = await axios.post<TwitchTokenResponse>(TWITCH_TOKEN_URL, null, {
    params: {
      client_id:     process.env['IGDB_CLIENT_ID'],
      client_secret: process.env['IGDB_CLIENT_SECRET'],
      grant_type:    'client_credentials',
    },
  });

  const { access_token, expires_in } = response.data;
  await redis.setex(TOKEN_REDIS_KEY, expires_in - 60, access_token);

  return access_token;
}

export const igdbService = {

  async searchGame(name: string): Promise<IgdbGame | null> {
    const token = await getAccessToken();

    const response = await axios.post<Array<{
      id: number;
      name: string;
      cover?: { id: number; url: string };
      platforms?: Array<{ name: string }>;
      summary?: string;
    }>>(
      `${IGDB_BASE_URL}/games`,
      `search "${name}"; fields name,cover.url,platforms.name,summary; limit 1;`,
      {
        headers: {
          'Client-ID':     process.env['IGDB_CLIENT_ID'] ?? '',
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'text/plain',
        },
      },
    );

    const game = response.data[0];
    if (!game) return null;

    return {
      id:        game.id,
      name:      game.name,
      coverUrl:  game.cover?.url
        ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}`
        : null,
      platforms: game.platforms?.map((p) => p.name) ?? [],
      summary:   game.summary ?? null,
    };
  },

  async getGameById(igdbId: number): Promise<IgdbGame | null> {
    const token = await getAccessToken();

    const response = await axios.post<Array<{
      id: number;
      name: string;
      cover?: { id: number; url: string };
      platforms?: Array<{ name: string }>;
      summary?: string;
    }>>(
      `${IGDB_BASE_URL}/games`,
      `where id = ${igdbId}; fields name,cover.url,platforms.name,summary; limit 1;`,
      {
        headers: {
          'Client-ID':     process.env['IGDB_CLIENT_ID'] ?? '',
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'text/plain',
        },
      },
    );

    const game = response.data[0];
    if (!game) return null;

    return {
      id:        game.id,
      name:      game.name,
      coverUrl:  game.cover?.url
        ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}`
        : null,
      platforms: game.platforms?.map((p) => p.name) ?? [],
      summary:   game.summary ?? null,
    };
  },

};
