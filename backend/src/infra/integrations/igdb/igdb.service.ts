import axios from 'axios';
import { redis } from '../../cache/redis';
import {
  createIntegrationError,
  translateUpstreamError,
} from '../integration.errors';

// ─────────────────────────────────────────────────────────────
// IGDB Service — Twitch OAuth + game metadata
// ─────────────────────────────────────────────────────────────

const IGDB_BASE_URL  = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TOKEN_REDIS_KEY  = 'igdb:token';
const IGDB_TIMEOUT_MS = 10_000;

function resolveIgdbCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env['IGDB_CLIENT_ID']?.trim();
  const clientSecret = process.env['IGDB_CLIENT_SECRET']?.trim();

  if (!clientId || !clientSecret) {
    throw createIntegrationError(
      'igdb',
      503,
      'misconfigured',
      'Integração IGDB indisponível no runtime atual.',
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

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

  const credentials = resolveIgdbCredentials();

  let response: { data: TwitchTokenResponse };

  try {
    response = await axios.post<TwitchTokenResponse>(TWITCH_TOKEN_URL, null, {
      params: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials',
      },
      timeout: IGDB_TIMEOUT_MS,
    });
  } catch (error) {
    throw translateUpstreamError(
      'igdb',
      error,
      'Integração IGDB indisponível no momento.',
      { targetUrl: TWITCH_TOKEN_URL },
    );
  }

  const { access_token, expires_in } = response.data;
  await redis.setex(TOKEN_REDIS_KEY, expires_in - 60, access_token);

  return access_token;
}

export const igdbService = {

  async searchGame(name: string): Promise<IgdbGame | null> {
    const token = await getAccessToken();
    const credentials = resolveIgdbCredentials();

    let response: { data: Array<{
      id: number;
      name: string;
      cover?: { id: number; url: string };
      platforms?: Array<{ name: string }>;
      summary?: string;
    }> };

    try {
      response = await axios.post<Array<{
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
            'Client-ID': credentials.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          timeout: IGDB_TIMEOUT_MS,
        },
      );
    } catch (error) {
      throw translateUpstreamError(
        'igdb',
        error,
        'Integração IGDB indisponível no momento.',
        { targetUrl: `${IGDB_BASE_URL}/games` },
      );
    }

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
    const credentials = resolveIgdbCredentials();

    let response: { data: Array<{
      id: number;
      name: string;
      cover?: { id: number; url: string };
      platforms?: Array<{ name: string }>;
      summary?: string;
    }> };

    try {
      response = await axios.post<Array<{
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
            'Client-ID': credentials.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          timeout: IGDB_TIMEOUT_MS,
        },
      );
    } catch (error) {
      throw translateUpstreamError(
        'igdb',
        error,
        'Integração IGDB indisponível no momento.',
        { targetUrl: `${IGDB_BASE_URL}/games` },
      );
    }

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
