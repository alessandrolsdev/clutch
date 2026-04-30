import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  extractSteamIdFromClaimedId,
  steamOpenIdClient,
  type SteamOpenIdCallbackParams,
} from '@/infra/integrations/steam/steam-openid.client';

const expectedReturnTo = 'http://localhost/api/auth/accounts/steam/link/callback?state=signed-state';

function createValidCallback(overrides: SteamOpenIdCallbackParams = {}): SteamOpenIdCallbackParams {
  return {
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000000',
    'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000000',
    'openid.return_to': expectedReturnTo,
    'openid.response_nonce': '2026-04-30T00:00:00Znonce',
    'openid.assoc_handle': 'assoc-handle',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'signature',
    ...overrides,
  };
}

describe('steamOpenIdClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria authorization URL OpenID para a Steam', () => {
    const authorizationUrl = new URL(steamOpenIdClient.createAuthorizationUrl({
      returnTo: expectedReturnTo,
      realm: 'http://localhost',
    }));

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe('https://steamcommunity.com/openid/login');
    expect(authorizationUrl.searchParams.get('openid.ns')).toBe('http://specs.openid.net/auth/2.0');
    expect(authorizationUrl.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(authorizationUrl.searchParams.get('openid.return_to')).toBe(expectedReturnTo);
    expect(authorizationUrl.searchParams.get('openid.realm')).toBe('http://localhost');
    expect(authorizationUrl.searchParams.get('openid.identity')).toBe('http://specs.openid.net/auth/2.0/identifier_select');
    expect(authorizationUrl.searchParams.get('openid.claimed_id')).toBe('http://specs.openid.net/auth/2.0/identifier_select');
  });

  it('extrai SteamID64 de claimed id oficial', () => {
    expect(extractSteamIdFromClaimedId('http://steamcommunity.com/openid/id/76561198000000000'))
      .toBe('76561198000000000');
    expect(extractSteamIdFromClaimedId('https://steamcommunity.com/openid/id/76561198000000000'))
      .toBe('76561198000000000');
  });

  it('rejeita claimed id de dominio invalido', () => {
    expect(() => extractSteamIdFromClaimedId('https://steamcommunity.example/openid/id/76561198000000000'))
      .toThrowError('Identidade Steam inválida.');
  });

  it('valida callback com a Steam antes de aceitar SteamID64', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n',
    } as never);

    const result = await steamOpenIdClient.verifyCallback(
      createValidCallback(),
      { expectedReturnTo },
    );

    expect(result).toEqual({ steamId: '76561198000000000' });
    expect(axios.post).toHaveBeenCalledWith(
      'https://steamcommunity.com/openid/login',
      expect.stringContaining('openid.mode=check_authentication'),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
  });

  it('rejeita callback quando a Steam nao confirma assinatura', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: 'is_valid:false\n',
    } as never);

    await expect(steamOpenIdClient.verifyCallback(
      createValidCallback(),
      { expectedReturnTo },
    )).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
    });
  });

  it('rejeita return_to divergente', async () => {
    await expect(steamOpenIdClient.verifyCallback(
      createValidCallback({
        'openid.return_to': 'https://evil.example/callback?state=signed-state',
      }),
      { expectedReturnTo },
    )).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
    });
    expect(axios.post).not.toHaveBeenCalled();
  });
});
