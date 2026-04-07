import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import { createDiscordOAuthService } from '@/core/services/discord-oauth.service';
import { createIntegrationError } from '@/infra/integrations/integration.errors';
import { discordService } from '@/infra/integrations/discord/discord.service';

const originalEnv = { ...process.env };

describe('discordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      DISCORD_CLIENT_ID: 'discord-client-id',
      DISCORD_CLIENT_SECRET: 'discord-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost/api/integrations/discord/callback',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('gera URL de autorizacao coerente com state assinado', () => {
    const { authorizationUrl, state } = discordService.createAuthorizationUrl('user-id-1');
    const parsedUrl = new URL(authorizationUrl);

    expect(parsedUrl.origin).toBe('https://discord.com');
    expect(parsedUrl.pathname).toBe('/oauth2/authorize');
    expect(parsedUrl.searchParams.get('client_id')).toBe('discord-client-id');
    expect(parsedUrl.searchParams.get('response_type')).toBe('code');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost/api/integrations/discord/callback');
    expect(parsedUrl.searchParams.get('scope')).toBe('identify');
    expect(parsedUrl.searchParams.get('state')).toBeTruthy();
    expect(discordService.validateState(state)).toMatchObject({
      userId: 'user-id-1',
    });
  });

  it('falha explicitamente quando a configuracao do Discord esta ausente', () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env = {
      ...originalEnv,
      DISCORD_CLIENT_ID: 'discord-client-id',
      DISCORD_CLIENT_SECRET: '',
      DISCORD_REDIRECT_URI: '',
    };

    let capturedError: unknown;

    try {
      discordService.createAuthorizationUrl('user-id-1');
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toMatchObject({
      statusCode: 503,
      reason: 'misconfigured',
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_discord_unavailable"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('discord-client-secret');
    stdoutWriteSpy.mockRestore();
  });

  it('rejeita state adulterado com erro coerente', () => {
    const { state } = discordService.createAuthorizationUrl('user-id-1');
    const tamperedState = `${state.slice(0, -1)}x`;

    let capturedError: unknown;

    try {
      discordService.validateState(tamperedState);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
    });
  });

  it('traduz code OAuth invalido para erro coerente', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: { status: 400 },
    });

    await expect(discordService.exchangeCode('oauth-code')).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
    });
  });

  it('traduz timeout do Discord para 504 e log seguro', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(axios.post).mockRejectedValue({ code: 'ECONNABORTED' });

    await expect(discordService.exchangeCode('oauth-code')).rejects.toMatchObject({
      statusCode: 504,
      reason: 'timeout',
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_discord_timeout"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"provider":"discord"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('oauth-code');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).not.toContain('discord-client-secret');
    stdoutWriteSpy.mockRestore();
  });
});

describe('createDiscordOAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('retorna URL de autorizacao e registra inicio do fluxo', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const service = createDiscordOAuthService({
      discordClient: {
        createAuthorizationUrl: vi.fn().mockReturnValue({
          authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=test-client&state=signed-state',
          state: 'signed-state',
        }),
        validateState: vi.fn(),
        exchangeCode: vi.fn(),
        getCurrentUser: vi.fn(),
      },
      persistence: {
        upsertDiscordIntegration: vi.fn(),
      },
    });

    const result = await service.getAuthorizationUrl({
      userId: 'user-id-1',
      requestId: 'req-1',
    });

    expect(result).toMatchObject({
      authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=test-client&state=signed-state',
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"event":"integration_discord_oauth_started"');
    expect(stdoutWriteSpy.mock.calls[0]?.[0]).toContain('"requestId":"req-1"');
    stdoutWriteSpy.mockRestore();
  });

  it('persiste integracao DISCORD no callback bem-sucedido', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const persistence = {
      upsertDiscordIntegration: vi.fn().mockResolvedValue(undefined),
    };

    const service = createDiscordOAuthService({
      discordClient: {
        createAuthorizationUrl: vi.fn(),
        validateState: vi.fn().mockReturnValue({
          userId: 'user-id-1',
          issuedAt: Date.now(),
        }),
        exchangeCode: vi.fn().mockResolvedValue({
          accessToken: 'discord-access-token',
          refreshToken: 'discord-refresh-token',
          expiresIn: 3600,
          scope: 'identify',
          tokenType: 'Bearer',
        }),
        getCurrentUser: vi.fn().mockResolvedValue({
          id: 'discord-user-id',
          username: 'clutchdiscord',
          globalName: 'Clutch Discord',
          avatarUrl: 'https://cdn.discordapp.com/avatar.png',
        }),
      },
      persistence,
    });

    const result = await service.completeCallback({
      code: 'oauth-code',
      state: 'signed-state',
      requestId: 'req-1',
    });

    expect(result).toMatchObject({
      platform: 'DISCORD',
      externalId: 'discord-user-id',
      username: 'clutchdiscord',
    });
    expect(persistence.upsertDiscordIntegration).toHaveBeenCalledWith(
      'user-id-1',
      expect.objectContaining({
        externalId: 'discord-user-id',
        accessToken: 'discord-access-token',
        refreshToken: 'discord-refresh-token',
        metadata: expect.objectContaining({
          username: 'clutchdiscord',
          globalName: 'Clutch Discord',
          tokenType: 'Bearer',
          scope: 'identify',
        }),
      }),
    );
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('"event":"integration_discord_link_succeeded"');
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('oauth-code');
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('discord-access-token');
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('discord-refresh-token');
    stdoutWriteSpy.mockRestore();
  });

  it('traduz falha do provedor e registra erro seguro no callback', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const service = createDiscordOAuthService({
      discordClient: {
        createAuthorizationUrl: vi.fn(),
        validateState: vi.fn().mockReturnValue({
          userId: 'user-id-1',
          issuedAt: Date.now(),
        }),
        exchangeCode: vi.fn().mockRejectedValue(
          createIntegrationError(
            'discord',
            400,
            'invalid_request',
            'Autorização Discord inválida ou expirada.',
          ),
        ),
        getCurrentUser: vi.fn(),
      },
      persistence: {
        upsertDiscordIntegration: vi.fn(),
      },
    });

    await expect(service.completeCallback({
      code: 'oauth-code',
      state: 'signed-state',
      requestId: 'req-1',
    })).rejects.toMatchObject({
      statusCode: 400,
      reason: 'invalid_request',
    });

    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('"event":"integration_discord_oauth_failed"');
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('"requestId":"req-1"');
    expect(stdoutWriteSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('oauth-code');
    stdoutWriteSpy.mockRestore();
  });
});
