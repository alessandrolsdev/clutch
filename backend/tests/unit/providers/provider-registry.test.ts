import { describe, expect, it } from 'vitest';
import {
  getProviderDefinition,
  listProviderDefinitions,
} from '@/core/providers/provider-registry';

describe('provider registry', () => {
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
    expect(steam?.capabilities).not.toContain('SOCIAL_LOGIN');
    expect(google?.capabilities).toEqual(
      expect.arrayContaining(['SOCIAL_LOGIN', 'OAUTH_CONNECT']),
    );
  });

  it('mantem providers futuros indisponiveis sem remover capabilities declaradas', () => {
    const myAnimeList = getProviderDefinition('MYANIMELIST');

    expect(myAnimeList.status).toBe('UNAVAILABLE');
    expect(myAnimeList.capabilities).toEqual(
      expect.arrayContaining(['CONNECTED_ACCOUNT', 'OAUTH_CONNECT']),
    );
  });
});
