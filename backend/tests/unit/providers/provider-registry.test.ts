import { afterEach, describe, expect, it } from 'vitest';
import {
  getProviderDefinition,
  listProviderDefinitions,
} from '@/core/providers/provider-registry';

const originalEnv = { ...process.env };

describe('provider registry', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('descreve providers sem depender de implementacao de rota especifica', () => {
    const discord = getProviderDefinition('DISCORD');

    expect(discord).toMatchObject({
      provider: 'DISCORD',
      displayName: 'Discord',
      dataSource: 'OFFICIAL',
    });
    expect(discord.capabilities).toEqual(
      expect.arrayContaining(['OAUTH_CONNECT', 'SOCIAL_LOGIN']),
    );
  });

  it('diferencia login social de conta conectada por capability', () => {
    const providers = listProviderDefinitions();
    const steam = providers.find((provider) => provider.provider === 'STEAM');
    const google = providers.find((provider) => provider.provider === 'GOOGLE');

    expect(steam?.capabilities).toContain('CONNECTED_ACCOUNT');
    expect(steam?.capabilities).toContain('OPENID_CONNECT');
    expect(steam?.capabilities).not.toContain('SOCIAL_LOGIN');
    expect(steam?.capabilities).not.toContain('OAUTH_CONNECT');
    expect(google?.status).toBe('CONNECTED');
    expect(google?.capabilities).toEqual(
      expect.arrayContaining(['SOCIAL_LOGIN', 'OAUTH_CONNECT']),
    );
  });

  it('mantem MyAnimeList planejado sem declarar OAuth antes do client real', () => {
    delete process.env['MYANIMELIST_CLIENT_ID'];
    delete process.env['MYANIMELIST_CLIENT_SECRET'];
    delete process.env['MYANIMELIST_REDIRECT_URI'];
    delete process.env['MYANIMELIST_ACCOUNT_LINK_REDIRECT_URI'];
    const myAnimeList = getProviderDefinition('MYANIMELIST');

    expect(myAnimeList.status).toBe('UNAVAILABLE');
    expect(myAnimeList.visibleInConnectionCenter).toBe(true);
    expect(myAnimeList.capabilities).toContain('CONNECTED_ACCOUNT');
    expect(myAnimeList.capabilities).not.toContain('OAUTH_CONNECT');
    expect(myAnimeList.capabilities).not.toContain('SOCIAL_LOGIN');
  });

  it('expõe MyAnimeList como OAuth connect quando config segura existe', () => {
    process.env['MYANIMELIST_CLIENT_ID'] = 'mal-client-id';
    process.env['MYANIMELIST_CLIENT_SECRET'] = 'mal-client-secret';
    process.env['MYANIMELIST_REDIRECT_URI'] = 'http://localhost/api/auth/accounts/myanimelist/link/callback';

    const myAnimeList = getProviderDefinition('MYANIMELIST');

    expect(myAnimeList.status).toBe('CONNECTED');
    expect(myAnimeList.dataSource).toBe('OFFICIAL');
    expect(myAnimeList.visibleInConnectionCenter).toBe(true);
    expect(myAnimeList.capabilities).toEqual(
      expect.arrayContaining(['CONNECTED_ACCOUNT', 'OAUTH_CONNECT']),
    );
    expect(myAnimeList.capabilities).not.toContain('SOCIAL_LOGIN');
  });

  it('mantem Epic como provider experimental sem login social', () => {
    const epic = getProviderDefinition('EPIC');

    expect(epic.status).toBe('EXPERIMENTAL');
    expect(epic.dataSource).toBe('EXPERIMENTAL');
    expect(epic.capabilities).toContain('CONNECTED_ACCOUNT');
    expect(epic.capabilities).toContain('TOKEN_CONNECT');
    expect(epic.capabilities).not.toContain('SOCIAL_LOGIN');
    expect(epic.capabilities).not.toContain('OAUTH_CONNECT');
  });

  it('falha explicitamente para provider nao registrado', () => {
    expect(() => getProviderDefinition('TWITCH' as never)).toThrowError(
      'Provider TWITCH não está registrado.',
    );
  });
});
