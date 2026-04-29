import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
import {
  completeDiscordOAuth,
  connectEpic,
  connectSteam,
  fetchConnectedAccounts,
  startAccountLink,
  startAccountReauth,
  unlinkConnectedAccount,
  IntegrationsRequestError,
  searchIgdbGame,
  startDiscordOAuth,
  syncSteamLibrary,
} from '@/services/integrations';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const connectedAccountPayload = {
  provider: 'GOOGLE',
  displayName: 'Google',
  externalId: 'google-external-id',
  connectionType: 'SOCIAL_LOGIN',
  status: 'CONNECTED',
  dataSource: 'OFFICIAL',
  connected: true,
  needsReauth: false,
  experimental: false,
  canUnlink: true,
  capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
  lastSyncAt: null,
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
};

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
          games: [
            {
              id: 730,
              name: 'Counter-Strike 2',
              coverUrl: 'https://images.ct2.jpg',
              platforms: ['PC'],
              summary: 'Competitive FPS',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await searchIgdbGame('Counter-Strike 2');

    expect(response.games[0]?.name).toBe('Counter-Strike 2');
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/integrations/igdb/search?q=Counter-Strike%202',
      { method: 'GET' },
    );
  });

  it('lista contas conectadas pelo contrato seguro', async () => {
    mockedApiRequest.mockResolvedValue(new Response(
      JSON.stringify({
        providers: [
          {
            provider: 'GOOGLE',
            displayName: 'Google',
            status: 'CONNECTED',
            dataSource: 'OFFICIAL',
            capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
          },
        ],
        accounts: [connectedAccountPayload],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const result = await fetchConnectedAccounts();

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]?.provider).toBe('GOOGLE');
    expect(result.providers[0]?.provider).toBe('GOOGLE');
    expect(JSON.stringify(result)).not.toContain('accessToken');
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/connected-accounts', {
      method: 'GET',
    });
  });

  it('inicia linking de provider OAuth', async () => {
    mockedApiRequest.mockResolvedValue(new Response(
      JSON.stringify({
        provider: 'DISCORD',
        authorizationUrl: 'https://discord.com/oauth2/authorize?state=signed-state',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const result = await startAccountLink('DISCORD');

    expect(result.authorizationUrl).toContain('discord.com');
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/accounts/discord/link/start', {
      method: 'GET',
    });
  });

  it('inicia reauth de provider OAuth', async () => {
    mockedApiRequest.mockResolvedValue(new Response(
      JSON.stringify({
        provider: 'GOOGLE',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const result = await startAccountReauth('GOOGLE');

    expect(result.provider).toBe('GOOGLE');
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/accounts/google/reauth/start', {
      method: 'GET',
    });
  });

  it('desconecta conta conectada', async () => {
    mockedApiRequest.mockResolvedValue(new Response(
      JSON.stringify({
        provider: 'GOOGLE',
        message: 'Google desconectado com sucesso.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const result = await unlinkConnectedAccount('GOOGLE');

    expect(result.message).toBe('Google desconectado com sucesso.');
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/accounts/google', {
      method: 'DELETE',
    });
  });

  it('mapeia erros de dominio sem expor payload sensivel', async () => {
    mockedApiRequest.mockResolvedValue(new Response(
      JSON.stringify({
        message: 'Não é possível remover o último método de login da conta.',
        accessToken: 'should-not-leak',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    await expect(unlinkConnectedAccount('GOOGLE')).rejects.toMatchObject({
      status: 409,
      message: 'Não é possível remover o último método de login da conta.',
    } satisfies Partial<IntegrationsRequestError>);
  });
});
