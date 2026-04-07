import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  completeDiscordOAuth,
  connectEpic,
  connectSteam,
  searchIgdbGame,
  startDiscordOAuth,
  syncSteamLibrary,
} from '@/services/integrations';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('integrations service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('connects steam with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Steam conectado. 2 jogos importados.',
          imported: 2,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await connectSteam({ steamId: '76561198000000000' });

    expect(response.imported).toBe(2);
    expect(mockedApiRequest).toHaveBeenCalledWith('/integrations/steam/connect', {
      method: 'POST',
      body: { steamId: '76561198000000000' },
    });
  });

  it('syncs steam library with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: '1 jogos sincronizados.',
          synced: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await syncSteamLibrary();

    expect(response.synced).toBe(1);
    expect(mockedApiRequest).toHaveBeenCalledWith('/integrations/steam/sync', {
      method: 'POST',
    });
  });

  it('connects epic with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Epic conectado. 2 jogos importados.',
          imported: 2,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await connectEpic({ authToken: 'valid-token' });

    expect(response.imported).toBe(2);
    expect(mockedApiRequest).toHaveBeenCalledWith('/integrations/epic/connect', {
      method: 'POST',
      body: { authToken: 'valid-token' },
    });
  });

  it('starts discord oauth with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=123',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await startDiscordOAuth();

    expect(response.authorizationUrl).toBe(
      'https://discord.com/oauth2/authorize?client_id=123',
    );
    expect(mockedApiRequest).toHaveBeenCalledWith('/integrations/discord/auth', {
      method: 'GET',
    });
  });

  it('completes discord oauth with callback query params', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Discord conectado com sucesso.',
          platform: 'DISCORD',
          externalId: 'discord-user-1',
          username: 'clutchplayer',
          globalName: 'CLUTCH Player',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await completeDiscordOAuth({
      code: 'oauth-code',
      state: 'signed-state',
      errorDescription: 'User denied access',
    });

    expect(response.platform).toBe('DISCORD');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/integrations/discord/callback?code=oauth-code&state=signed-state&error_description=User+denied+access',
      { method: 'GET' },
    );
  });

  it('searches the igdb endpoint with the real contract', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 730,
          name: 'Counter-Strike 2',
          coverUrl: 'https://images.ct2.jpg',
          platforms: ['PC'],
          summary: 'Competitive FPS',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await searchIgdbGame('Counter-Strike 2');

    expect(response.name).toBe('Counter-Strike 2');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/integrations/igdb/search?q=Counter-Strike%202',
      { method: 'GET' },
    );
  });
});
